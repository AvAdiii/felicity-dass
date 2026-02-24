import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { Event } from '../models/Event.js';
import { Registration } from '../models/Registration.js';
import { MerchandiseOrder } from '../models/MerchandiseOrder.js';
import { Ticket } from '../models/Ticket.js';
import { AttendanceLog } from '../models/AttendanceLog.js';
import { PasswordResetRequest } from '../models/PasswordResetRequest.js';
import { buildTicketPayload, createTicketId } from '../utils/ticket.js';
import { sendEmail } from '../utils/email.js';
import { publicUser } from '../utils/serialize.js';
import { is_valid_phone_number, normalize_phone_number } from '../utils/validation.js';
import { normalize_organizer_category, organizer_category_options } from '../utils/categories.js';

const router = Router();

router.use(requireAuth);

router.get('/list', async (req, res, next) => {
  try {
    const organizers = await User.find({ role: 'organizer', disabled: false })
      .select('organizerName category description contactEmail')
      .sort({ organizerName: 1 });

    return res.json({ organizers });
  } catch (err) {
    return next(err);
  }
});

router.get('/:organizerId/details', async (req, res, next) => {
  try {
    const organizer = await User.findOne({
      _id: req.params.organizerId,
      role: 'organizer',
      disabled: false
    }).select('organizerName category description contactEmail');

    if (!organizer) {
      return res.status(404).json({ message: 'Organizer not found' });
    }

    const now = new Date();
    const [upcoming, past] = await Promise.all([
      Event.find({ organizer: organizer._id, startDate: { $gte: now }, status: { $ne: 'DRAFT' } }).sort({ startDate: 1 }),
      Event.find({ organizer: organizer._id, startDate: { $lt: now }, status: { $ne: 'DRAFT' } }).sort({ startDate: -1 })
    ]);

    return res.json({ organizer, upcoming, past });
  } catch (err) {
    return next(err);
  }
});

router.get('/me/profile', allowRoles('organizer'), async (req, res) => {
  return res.json({ user: publicUser(req.user) });
});

router.put('/me/profile', allowRoles('organizer'), async (req, res, next) => {
  try {
    if (Object.prototype.hasOwnProperty.call(req.body, 'contactNumber')) {
      if (!is_valid_phone_number(req.body.contactNumber)) {
        return res.status(400).json({ message: 'Contact number must be exactly 10 digits' });
      }
      req.body.contactNumber = normalize_phone_number(req.body.contactNumber);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'category')) {
      const normalized_category = normalize_organizer_category(req.body.category);
      const same_as_existing = String(req.body.category || '').trim() === String(req.user.category || '').trim();
      if (!normalized_category && !same_as_existing) {
        return res.status(400).json({
          message: `Invalid organizer category. Use one of: ${organizer_category_options.join(', ')}`
        });
      }
      req.body.category = normalized_category || req.user.category;
    }

    const allowed = ['organizerName', 'category', 'description', 'contactEmail', 'contactNumber', 'discordWebhookUrl'];
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        req.user[key] = req.body[key];
      }
    }

    await req.user.save();
    return res.json({ message: 'Organizer profile updated', user: publicUser(req.user) });
  } catch (err) {
    return next(err);
  }
});

router.get('/me/dashboard', allowRoles('organizer'), async (req, res, next) => {
  try {
    const events = await Event.find({ organizer: req.user._id }).sort({ createdAt: -1 });
    const completedEventIds = events.filter((ev) => ev.status === 'COMPLETED').map((ev) => ev._id);

    const [regStats, orderStats, attendanceStats] = await Promise.all([
      Registration.aggregate([
        { $match: { event: { $in: completedEventIds } } },
        {
          $group: {
            _id: '$event',
            registrations: { $sum: 1 }
          }
        }
      ]),
      MerchandiseOrder.aggregate([
        { $match: { event: { $in: completedEventIds }, status: 'APPROVED' } },
        {
          $group: {
            _id: '$event',
            sales: { $sum: '$quantity' },
            revenue: { $sum: '$amount' }
          }
        }
      ]),
      AttendanceLog.aggregate([
        { $match: { event: { $in: completedEventIds }, status: { $in: ['SCANNED', 'MANUAL_OVERRIDE'] } } },
        {
          $group: {
            _id: '$event',
            attendance: { $addToSet: '$participant' }
          }
        }
      ])
    ]);

    const regMap = new Map(regStats.map((x) => [x._id.toString(), x.registrations]));
    const orderMap = new Map(orderStats.map((x) => [x._id.toString(), x]));
    const attendanceMap = new Map(attendanceStats.map((x) => [x._id.toString(), x.attendance.length]));

    const analytics = events
      .filter((ev) => ev.status === 'COMPLETED')
      .map((ev) => ({
        eventId: ev._id,
        eventName: ev.name,
        registrations: regMap.get(ev._id.toString()) || 0,
        sales: orderMap.get(ev._id.toString())?.sales || 0,
        revenue: orderMap.get(ev._id.toString())?.revenue || 0,
        attendance: attendanceMap.get(ev._id.toString()) || 0
      }));

    return res.json({
      events: events.map((ev) => ({
        id: ev._id,
        name: ev.name,
        type: ev.type,
        status: ev.status
      })),
      analytics
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/me/ongoing-events', allowRoles('organizer'), async (req, res, next) => {
  try {
    const events = await Event.find({ organizer: req.user._id, status: 'ONGOING' }).sort({ startDate: 1 });
    return res.json({ events });
  } catch (err) {
    return next(err);
  }
});

router.post('/me/events', allowRoles('organizer'), async (req, res, next) => {
  try {
    const {
      name,
      description,
      type,
      eligibility,
      registrationDeadline,
      startDate,
      endDate,
      registrationLimit,
      registrationFee,
      teamBased,
      maxTeamSize,
      tags,
      customForm,
      merchandise,
      status
    } = req.body;

    const requested_status = status || 'DRAFT';
    if (!['DRAFT', 'PUBLISHED'].includes(requested_status)) {
      return res.status(400).json({ message: 'New events can only be created as DRAFT or PUBLISHED' });
    }

    const timeline_error = validate_event_timeline({
      registrationDeadline,
      startDate,
      endDate
    });
    if (timeline_error) {
      return res.status(400).json({ message: timeline_error });
    }

    const normalized_team_based = type === 'NORMAL' ? to_boolean(teamBased) : false;
    const normalized_max_team_size = normalized_team_based ? Number(maxTeamSize || 2) : 1;
    const team_error = validate_team_configuration({
      eventType: type,
      teamBased: normalized_team_based,
      maxTeamSize: normalized_max_team_size
    });
    if (team_error) {
      return res.status(400).json({ message: team_error });
    }

    const normalized_merchandise =
      type === 'MERCHANDISE'
        ? { items: Array.isArray(merchandise?.items) ? merchandise.items : [] }
        : { items: [] };

    const normalized_custom_form = type === 'NORMAL' ? normalize_custom_form_definition(customForm) : [];
    const custom_form_error = validate_custom_form_definition({
      eventType: type,
      customForm: normalized_custom_form
    });
    if (custom_form_error) {
      return res.status(400).json({ message: custom_form_error });
    }

    const candidate_for_publish_check = {
      organizer: req.user._id,
      name,
      description,
      type,
      registrationDeadline,
      startDate,
      endDate,
      registrationLimit,
      teamBased: normalized_team_based,
      maxTeamSize: normalized_max_team_size,
      customForm: normalized_custom_form,
      merchandise: normalized_merchandise
    };

    if (requested_status === 'PUBLISHED') {
      const missing = validateEventForPublish(candidate_for_publish_check);
      if (missing.length) {
        return res.status(400).json({ message: `Cannot publish. Missing: ${missing.join(', ')}` });
      }
    }

    const event = await Event.create({
      organizer: req.user._id,
      name,
      description,
      type,
      eligibility: Array.isArray(eligibility) ? eligibility : [],
      registrationDeadline,
      startDate,
      endDate,
      registrationLimit,
      registrationFee,
      teamBased: normalized_team_based,
      maxTeamSize: normalized_max_team_size,
      tags: Array.isArray(tags) ? tags : [],
      customForm: normalized_custom_form,
      merchandise: normalized_merchandise,
      status: requested_status
    });

    if (event.status === 'PUBLISHED' && req.user.discordWebhookUrl) {
      await postDiscordWebhook(req.user.discordWebhookUrl, event);
    }

    return res.status(201).json({ message: 'Event created', event });
  } catch (err) {
    return next(err);
  }
});

router.patch('/me/events/:eventId', allowRoles('organizer'), async (req, res, next) => {
  try {
    const event = await Event.findOne({ _id: req.params.eventId, organizer: req.user._id });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const originalStatus = event.status;
    const nextStatus = req.body.status || event.status;
    const blocked_keys = find_blocked_edit_keys({
      status: originalStatus,
      payload: req.body
    });
    if (blocked_keys.length) {
      return res
        .status(400)
        .json({ message: `These fields cannot be edited when event is ${originalStatus}: ${blocked_keys.join(', ')}` });
    }

    if (originalStatus === 'DRAFT') {
      applyDraftEdits(event, req.body);
      if (nextStatus === 'PUBLISHED') {
        const missing = validateEventForPublish(event);
        if (missing.length) {
          return res.status(400).json({ message: `Cannot publish. Missing: ${missing.join(', ')}` });
        }
        event.status = 'PUBLISHED';
      } else if (nextStatus !== 'DRAFT') {
        return res.status(400).json({ message: 'Draft events can only stay DRAFT or move to PUBLISHED' });
      }
    } else if (originalStatus === 'PUBLISHED') {
      if (Object.prototype.hasOwnProperty.call(req.body, 'description')) {
        if (!String(req.body.description || '').trim()) {
          return res.status(400).json({ message: 'Description cannot be empty for published event' });
        }
        event.description = req.body.description;
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'registrationDeadline')) {
        const next_deadline = new Date(req.body.registrationDeadline);
        if (Number.isNaN(next_deadline.getTime())) {
          return res.status(400).json({ message: 'Invalid registration deadline' });
        }
        if (new Date(req.body.registrationDeadline) < new Date(event.registrationDeadline)) {
          return res.status(400).json({ message: 'Published event deadline can only be extended' });
        }
        event.registrationDeadline = req.body.registrationDeadline;
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'registrationLimit')) {
        const next_limit = Number(req.body.registrationLimit);
        if (!Number.isInteger(next_limit) || next_limit < 1) {
          return res.status(400).json({ message: 'Registration limit must be an integer of at least 1' });
        }
        if (next_limit < event.registrationLimit) {
          return res.status(400).json({ message: 'Published event registration limit can only increase' });
        }
        event.registrationLimit = next_limit;
      }
      if (req.body.action === 'close_registrations' || nextStatus === 'CLOSED') {
        event.status = 'CLOSED';
      } else if (nextStatus === 'ONGOING') {
        event.status = 'ONGOING';
      } else if (nextStatus !== 'PUBLISHED') {
        return res.status(400).json({ message: 'Published events can only move to ONGOING or CLOSED' });
      }
    } else if (['ONGOING', 'COMPLETED', 'CLOSED'].includes(originalStatus)) {
      if (nextStatus && nextStatus !== originalStatus) {
        if (['CLOSED', 'COMPLETED'].includes(nextStatus)) {
          event.status = nextStatus;
        } else {
          return res.status(400).json({ message: 'Only closing/completing status updates allowed now' });
        }
      }
    }

    if (event.formLocked && Array.isArray(req.body.customForm)) {
      // Keeping this check explicit so organizers understand why edits fail.
      return res.status(400).json({ message: 'Custom form is locked after first registration' });
    }

    const timeline_error = validate_event_timeline({
      registrationDeadline: event.registrationDeadline,
      startDate: event.startDate,
      endDate: event.endDate
    });
    if (timeline_error) {
      return res.status(400).json({ message: timeline_error });
    }

    const team_error = validate_team_configuration({
      eventType: event.type,
      teamBased: event.teamBased,
      maxTeamSize: event.maxTeamSize
    });
    if (team_error) {
      return res.status(400).json({ message: team_error });
    }

    const custom_form_error = validate_custom_form_definition({
      eventType: event.type,
      customForm: event.customForm
    });
    if (custom_form_error) {
      return res.status(400).json({ message: custom_form_error });
    }

    await event.save();

    if (originalStatus !== 'PUBLISHED' && event.status === 'PUBLISHED' && req.user.discordWebhookUrl) {
      await postDiscordWebhook(req.user.discordWebhookUrl, event);
    }

    return res.json({ message: 'Event updated', event });
  } catch (err) {
    return next(err);
  }
});

router.get('/me/events/:eventId', allowRoles('organizer'), async (req, res, next) => {
  try {
    const event = await Event.findOne({ _id: req.params.eventId, organizer: req.user._id });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const analytics = await buildEventAnalytics(event._id);
    const participantRows = await eventParticipants(event._id);

    return res.json({ event, analytics, participants: participantRows });
  } catch (err) {
    return next(err);
  }
});

router.get('/me/events/:eventId/participants', allowRoles('organizer'), async (req, res, next) => {
  try {
    const event = await Event.findOne({ _id: req.params.eventId, organizer: req.user._id });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const rows = await eventParticipants(event._id, req.query.search);
    return res.json({ participants: rows });
  } catch (err) {
    return next(err);
  }
});

router.get('/me/events/:eventId/participants/export', allowRoles('organizer'), async (req, res, next) => {
  try {
    const event = await Event.findOne({ _id: req.params.eventId, organizer: req.user._id });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const rows = await eventParticipants(event._id, req.query.search);
    const headers = ['Name', 'Email', 'Reg Date', 'Payment', 'Team', 'Attendance'];
    const csvLines = [headers.join(',')];

    for (const row of rows) {
      csvLines.push(
        [
          csvEscape(row.name),
          csvEscape(row.email),
          csvEscape(row.regDate ? new Date(row.regDate).toISOString() : ''),
          csvEscape(row.payment),
          csvEscape(row.team || ''),
          csvEscape(row.attendance)
        ].join(',')
      );
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${event.name.replace(/\s+/g, '_')}_participants.csv"`);
    return res.send(csvLines.join('\n'));
  } catch (err) {
    return next(err);
  }
});

router.get('/me/events/:eventId/orders', allowRoles('organizer'), async (req, res, next) => {
  try {
    const event = await Event.findOne({ _id: req.params.eventId, organizer: req.user._id });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const query = { event: event._id };
    if (req.query.status) {
      query.status = req.query.status;
    }

    const orders = await MerchandiseOrder.find(query)
      .populate('participant', 'firstName lastName email')
      .sort({ createdAt: -1 });

    return res.json({ orders });
  } catch (err) {
    return next(err);
  }
});

router.patch('/me/orders/:orderId/review', allowRoles('organizer'), async (req, res, next) => {
  try {
    const { action, comment } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Action must be approve/reject' });
    }

    const order = await MerchandiseOrder.findById(req.params.orderId)
      .populate('event')
      .populate('participant', 'firstName lastName email');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (order.status !== 'PENDING_APPROVAL') {
      return res.status(400).json({ message: 'Order is not pending approval' });
    }

    order.reviewComment = comment || '';
    order.reviewedBy = req.user._id;
    order.reviewedAt = new Date();

    if (action === 'reject') {
      order.status = 'REJECTED';
      await order.save();
      await sendEmail({
        to: order.participant.email,
        subject: `Merchandise order rejected - ${order.event.name}`,
        text: `Your order was rejected. Comment: ${comment || 'No comment'}`
      });

      return res.json({ message: 'Order rejected', order });
    }

    const item = order.event.merchandise?.items?.find((x) => x.sku === order.itemSku);
    if (!item) {
      return res.status(404).json({ message: 'Merchandise item not found in event' });
    }

    if (item.stock < order.quantity) {
      return res.status(400).json({ message: 'Stock exhausted while approving this order' });
    }

    item.stock -= order.quantity;
    order.status = 'APPROVED';

    const ticketId = createTicketId();
    const qr = await buildTicketPayload({
      eventId: order.event._id.toString(),
      participantId: order.participant._id.toString(),
      ticketId
    });

    const ticket = await Ticket.create({
      ticketId,
      event: order.event._id,
      participant: order.participant._id,
      order: order._id,
      qrPayload: qr.payload,
      qrData: qr.qrData
    });

    order.ticket = ticket._id;

    await order.event.save();
    await order.save();

    await sendEmail({
      to: order.participant.email,
      subject: `Order approved - ${order.event.name}`,
      text: `Your order has been approved. Ticket ID: ${ticket.ticketId}`
    });

    return res.json({ message: 'Order approved and ticket generated', order, ticket });
  } catch (err) {
    return next(err);
  }
});

router.post('/me/password-reset-requests', allowRoles('organizer'), async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ message: 'Reason is required (minimum 5 chars)' });
    }

    const pending = await PasswordResetRequest.findOne({
      organizer: req.user._id,
      status: 'PENDING'
    });

    if (pending) {
      return res.status(400).json({ message: 'A pending request already exists' });
    }

    const request = await PasswordResetRequest.create({
      organizer: req.user._id,
      reason
    });

    return res.status(201).json({ message: 'Password reset request submitted', request });
  } catch (err) {
    return next(err);
  }
});

router.get('/me/password-reset-requests', allowRoles('organizer'), async (req, res, next) => {
  try {
    const history = await PasswordResetRequest.find({ organizer: req.user._id })
      .populate('handledBy', 'email')
      .sort({ createdAt: -1 });

    return res.json({ history });
  } catch (err) {
    return next(err);
  }
});

function applyDraftEdits(event, payload) {
  const editable = [
    'name',
    'description',
    'type',
    'eligibility',
    'registrationDeadline',
    'startDate',
    'endDate',
    'registrationLimit',
    'registrationFee',
    'teamBased',
    'maxTeamSize',
    'tags',
    'customForm',
    'merchandise'
  ];

  for (const key of editable) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      event[key] = payload[key];
    }
  }

  if (event.type === 'NORMAL') {
    event.merchandise = { items: [] };
  }

  if (!event.merchandise || !Array.isArray(event.merchandise.items)) {
    event.merchandise = { items: [] };
  }

  if (event.type !== 'NORMAL') {
    event.teamBased = false;
    event.maxTeamSize = 1;
    event.customForm = [];
  } else {
    event.teamBased = to_boolean(event.teamBased);
    event.maxTeamSize = event.teamBased ? Number(event.maxTeamSize || 2) : 1;
    event.customForm = normalize_custom_form_definition(event.customForm);
  }
}

function find_blocked_edit_keys({ status, payload }) {
  const keys = Object.keys(payload || {}).filter((key) => key !== '_id' && key !== 'id');
  if (status === 'DRAFT') {
    return [];
  }

  if (status === 'PUBLISHED') {
    const allowed = new Set(['description', 'registrationDeadline', 'registrationLimit', 'status', 'action']);
    return keys.filter((key) => !allowed.has(key));
  }

  const status_only_allowed = new Set(['status', 'action']);
  return keys.filter((key) => !status_only_allowed.has(key));
}

function normalize_custom_form_definition(customForm) {
  const fields = Array.isArray(customForm) ? customForm : [];
  return fields.map((field, idx) => ({
    fieldId: String(field.fieldId || `field_${idx}`).trim(),
    label: String(field.label || '').trim(),
    type: String(field.type || 'text').trim().toLowerCase(),
    required: Boolean(field.required),
    options: Array.isArray(field.options)
      ? field.options.map((opt) => String(opt).trim()).filter(Boolean)
      : [],
    order: Number.isInteger(Number(field.order)) ? Number(field.order) : idx
  }));
}

function parse_date(date_value) {
  const parsed_date = new Date(date_value);
  if (Number.isNaN(parsed_date.getTime())) {
    return null;
  }

  return parsed_date;
}

function validate_event_timeline({ registrationDeadline, startDate, endDate }) {
  const registration_deadline = parse_date(registrationDeadline);
  const start_date = parse_date(startDate);
  const end_date = parse_date(endDate);

  if (!registration_deadline || !start_date || !end_date) {
    return 'Invalid event date-time values.';
  }

  if (!(registration_deadline < start_date)) {
    return 'Registration deadline must be earlier than event start time.';
  }

  if (!(start_date < end_date)) {
    return 'Event start time must be earlier than event end time.';
  }

  return '';
}

function to_boolean(value) {
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  return Boolean(value);
}

function validate_team_configuration({ eventType, teamBased, maxTeamSize }) {
  if (eventType !== 'NORMAL') {
    return '';
  }

  if (!teamBased) {
    return '';
  }

  const parsed_size = Number(maxTeamSize);
  if (!Number.isInteger(parsed_size) || parsed_size < 2) {
    return 'For team-based events, max team size must be an integer of at least 2.';
  }

  return '';
}

function validate_custom_form_definition({ eventType, customForm }) {
  if (eventType !== 'NORMAL') {
    return '';
  }

  if (!Array.isArray(customForm)) {
    return 'Custom form must be an array of fields';
  }

  const allowed_types = new Set(['text', 'textarea', 'dropdown', 'checkbox', 'file', 'number', 'email']);
  const seen_field_ids = new Set();

  for (const field of customForm) {
    const field_id = String(field.fieldId || '').trim();
    const label = String(field.label || '').trim();
    const type = String(field.type || '').trim().toLowerCase();
    const options = Array.isArray(field.options) ? field.options.filter((opt) => String(opt || '').trim()) : [];

    if (!field_id) {
      return 'Each custom form field must have a fieldId';
    }
    if (seen_field_ids.has(field_id)) {
      return `Duplicate custom form fieldId: ${field_id}`;
    }
    seen_field_ids.add(field_id);

    if (!label) {
      return `Each custom form field must have a label (fieldId: ${field_id})`;
    }

    if (!allowed_types.has(type)) {
      return `Unsupported custom form field type: ${type}`;
    }

    if ((type === 'dropdown' || type === 'checkbox') && field.required && options.length === 0) {
      return `Required ${type} field "${label}" must include at least one option`;
    }
  }

  return '';
}

function validateEventForPublish(event) {
  const missing = [];
  if (!event.name) missing.push('name');
  if (!event.description) missing.push('description');
  if (!event.type) missing.push('type');
  if (!event.registrationDeadline) missing.push('registrationDeadline');
  if (!event.startDate) missing.push('startDate');
  if (!event.endDate) missing.push('endDate');
  if (!event.registrationLimit) missing.push('registrationLimit');
  if (!event.organizer) missing.push('organizer');

  if (event.type === 'NORMAL' && (!event.customForm || event.customForm.length === 0)) {
    missing.push('customForm (at least one field for NORMAL event)');
  }

  if (event.type === 'MERCHANDISE' && (!event.merchandise?.items || event.merchandise.items.length === 0)) {
    missing.push('merchandise.items');
  }

  if (event.type === 'NORMAL' && event.teamBased && (!Number.isInteger(event.maxTeamSize) || event.maxTeamSize < 2)) {
    missing.push('maxTeamSize (at least 2 for team-based events)');
  }

  return missing;
}

async function buildEventAnalytics(eventId) {
  const [registrationCount, salesAgg, attendanceAgg, teamCount] = await Promise.all([
    Registration.countDocuments({ event: eventId }),
    MerchandiseOrder.aggregate([
      { $match: { event: eventId, status: 'APPROVED' } },
      { $group: { _id: '$event', sales: { $sum: '$quantity' }, revenue: { $sum: '$amount' } } }
    ]),
    AttendanceLog.aggregate([
      { $match: { event: eventId, status: { $in: ['SCANNED', 'MANUAL_OVERRIDE'] } } },
      { $group: { _id: '$event', attendees: { $addToSet: '$participant' } } }
    ]),
    Registration.aggregate([
      { $match: { event: eventId, teamName: { $ne: null } } },
      { $group: { _id: '$teamName' } },
      { $count: 'count' }
    ])
  ]);

  return {
    registrations: registrationCount,
    sales: salesAgg[0]?.sales || 0,
    revenue: salesAgg[0]?.revenue || 0,
    attendance: attendanceAgg[0]?.attendees?.length || 0,
    teamCompletion: teamCount[0]?.count || 0
  };
}

async function eventParticipants(eventId, search = '') {
  const [regs, orders] = await Promise.all([
    Registration.find({ event: eventId })
      .populate('participant', 'firstName lastName email')
      .populate('ticket')
      .sort({ createdAt: -1 }),
    MerchandiseOrder.find({ event: eventId, status: 'APPROVED' })
      .populate('participant', 'firstName lastName email')
      .populate('ticket')
      .sort({ createdAt: -1 })
  ]);

  const attendance = await AttendanceLog.find({
    event: eventId,
    status: { $in: ['SCANNED', 'MANUAL_OVERRIDE'] }
  });

  const attended = new Set(attendance.map((row) => row.participant?.toString()));

  const rows = [
    ...regs.map((row) => ({
      name: `${row.participant?.firstName || ''} ${row.participant?.lastName || ''}`.trim(),
      email: row.participant?.email,
      regDate: row.createdAt,
      payment: 'N/A',
      team: row.teamName || '',
      attendance: attended.has(row.participant?._id?.toString()) ? 'Present' : 'Absent',
      ticketId: row.ticket?.ticketId || null
    })),
    ...orders.map((row) => ({
      name: `${row.participant?.firstName || ''} ${row.participant?.lastName || ''}`.trim(),
      email: row.participant?.email,
      regDate: row.createdAt,
      payment: `Paid (${row.amount})`,
      team: '',
      attendance: attended.has(row.participant?._id?.toString()) ? 'Present' : 'Absent',
      ticketId: row.ticket?.ticketId || null
    }))
  ];

  if (!search) return rows;

  const q = search.toLowerCase();
  return rows.filter((row) => `${row.name} ${row.email}`.toLowerCase().includes(q));
}

function csvEscape(value) {
  const str = String(value || '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function postDiscordWebhook(url, event) {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `New Event Published: **${event.name}** (${event.type})\nStarts: ${new Date(event.startDate).toLocaleString()}`
      })
    });
  } catch (err) {
    console.error('[Discord webhook failed]', err.message);
  }
}

export default router;
