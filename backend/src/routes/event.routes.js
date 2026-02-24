import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import dayjs from 'dayjs';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { Event } from '../models/Event.js';
import { Registration } from '../models/Registration.js';
import { MerchandiseOrder } from '../models/MerchandiseOrder.js';
import { Ticket } from '../models/Ticket.js';
import { buildTicketPayload, createTicketId } from '../utils/ticket.js';
import { sendEmail } from '../utils/email.js';
import { publicEvent } from '../utils/serialize.js';
import {
  buildICS,
  buildGoogleCalendarLink,
  buildOutlookCalendarLink
} from '../utils/calendar.js';

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const paymentProofUploadDir = path.resolve(__dirname, '../uploads/payment-proofs');
const registrationFileUploadDir = path.resolve(__dirname, '../uploads/registration-files');
fs.mkdirSync(paymentProofUploadDir, { recursive: true });
fs.mkdirSync(registrationFileUploadDir, { recursive: true });

function safe_extension_from_name(file_name) {
  const ext = path.extname(String(file_name || '')).toLowerCase();
  if (!ext) return '';
  return /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : '';
}

function extension_from_mime(mime_type) {
  if (mime_type === 'image/png') return '.png';
  if (mime_type === 'image/jpeg') return '.jpg';
  if (mime_type === 'image/webp') return '.webp';
  if (mime_type === 'image/gif') return '.gif';
  return '';
}

function normalize_download_name(file_name, fallback) {
  const source = String(file_name || '').trim() || String(fallback || '').trim() || 'payment-proof';
  const safe = source.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  const with_default = safe || 'payment-proof';
  const ext = safe_extension_from_name(with_default);
  return ext ? with_default : `${with_default}.png`;
}

const paymentProofStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, paymentProofUploadDir),
  filename: (_req, file, cb) => {
    const ext = safe_extension_from_name(file.originalname) || extension_from_mime(file.mimetype);
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `proof-${suffix}${ext}`);
  }
});

const paymentProofUpload = multer({
  storage: paymentProofStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (String(file.mimetype || '').startsWith('image/')) {
      cb(null, true);
      return;
    }
    cb(new Error('Payment proof must be an image'));
  }
});

const registrationFileUpload = multer({
  dest: registrationFileUploadDir,
  limits: { fileSize: 8 * 1024 * 1024, files: 12 }
});

async function createTicket({ event, participantId, registrationId, orderId }) {
  const ticketId = createTicketId();
  const { payload, qrData } = await buildTicketPayload({
    eventId: event._id.toString(),
    participantId: participantId.toString(),
    ticketId
  });

  const ticket = await Ticket.create({
    ticketId,
    event: event._id,
    participant: participantId,
    registration: registrationId,
    order: orderId,
    qrPayload: payload,
    qrData
  });

  return ticket;
}

async function getOccupiedSpots(eventId) {
  const registrations = await Registration.countDocuments({
    event: eventId,
    status: { $in: ['REGISTERED', 'COMPLETED'] }
  });

  const approvedOrders = await MerchandiseOrder.aggregate([
    {
      $match: {
        event: eventId,
        status: 'APPROVED'
      }
    },
    {
      $group: {
        _id: '$event',
        qty: { $sum: '$quantity' }
      }
    }
  ]);

  return registrations + (approvedOrders[0]?.qty || 0);
}

function eventIsRegistrable(event) {
  const now = new Date();
  if (new Date(event.registrationDeadline) < now) {
    return { ok: false, reason: 'Registration deadline has passed' };
  }
  if (['CLOSED', 'COMPLETED'].includes(event.status)) {
    return { ok: false, reason: 'Event registration is closed' };
  }
  if (event.status === 'DRAFT') {
    return { ok: false, reason: 'Event is not published yet' };
  }
  return { ok: true };
}

function normalize_team_name(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

async function get_event_team_options(event_id, max_team_size) {
  const rows = await Registration.aggregate([
    {
      $match: {
        event: event_id,
        status: { $in: ['REGISTERED', 'COMPLETED'] },
        teamName: { $type: 'string', $ne: '' }
      }
    },
    {
      $group: {
        _id: { $toLower: '$teamName' },
        teamName: { $first: '$teamName' },
        memberCount: { $sum: 1 }
      }
    },
    { $sort: { teamName: 1 } }
  ]);

  return rows.map((row) => {
    const member_count = Number(row.memberCount || 0);
    const available_spots = Math.max(0, Number(max_team_size || 1) - member_count);
    return {
      teamKey: row._id,
      teamName: row.teamName,
      memberCount: member_count,
      availableSpots: available_spots,
      isFull: available_spots <= 0
    };
  });
}

function remove_uploaded_registration_files(files) {
  for (const file of files || []) {
    if (!file?.path) continue;
    fs.unlink(file.path, () => {
      // Intentionally no-op: cleanup best effort only.
    });
  }
}

function remove_payment_proof_file(rel_path) {
  if (!rel_path) return;
  const absolute = path.resolve(__dirname, '..', rel_path);
  if (!absolute.startsWith(paymentProofUploadDir)) return;

  fs.unlink(absolute, () => {
    // Intentionally no-op: cleanup best effort only.
  });
}

function parse_registration_payload(body) {
  if (body?.payload && typeof body.payload === 'string') {
    const parsed = JSON.parse(body.payload);
    return parsed && typeof parsed === 'object' ? parsed : {};
  }

  return body && typeof body === 'object' ? body : {};
}

function normalize_checkbox_values(raw_value) {
  if (Array.isArray(raw_value)) {
    return raw_value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof raw_value === 'string') {
    const trimmed = raw_value.trim();
    if (!trimmed) return [];
    if (trimmed.includes(',')) {
      return trimmed
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [trimmed];
  }

  if (raw_value === true || raw_value === 1 || raw_value === '1') {
    return ['true'];
  }

  return [];
}

function is_valid_email_value(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function normalize_registration_responses({ event, rawResponses, uploadedFilesByFieldId }) {
  const normalized = {};

  for (const field of event.customForm || []) {
    const field_id = String(field.fieldId || '').trim();
    if (!field_id) {
      continue;
    }

    const raw_value = rawResponses?.[field_id];

    if (field.type === 'file') {
      const uploaded_file = uploadedFilesByFieldId.get(field_id);
      if (field.required && !uploaded_file) {
        return { error: `Field is required: ${field.label}` };
      }

      if (uploaded_file) {
        normalized[field_id] = {
          originalName: uploaded_file.originalname,
          filePath: `uploads/registration-files/${uploaded_file.filename}`,
          mimeType: uploaded_file.mimetype,
          size: uploaded_file.size
        };
      } else {
        normalized[field_id] = null;
      }
      continue;
    }

    if (field.type === 'checkbox') {
      const selected = normalize_checkbox_values(raw_value);
      const options = Array.isArray(field.options) ? field.options : [];

      if (options.length) {
        const invalid = selected.filter((value) => !options.includes(value));
        if (invalid.length) {
          return { error: `Invalid checkbox option for field: ${field.label}` };
        }
        if (field.required && selected.length === 0) {
          return { error: `Field is required: ${field.label}` };
        }
        normalized[field_id] = selected;
      } else {
        const checked = selected.length > 0 || raw_value === true || raw_value === 'true';
        if (field.required && !checked) {
          return { error: `Field is required: ${field.label}` };
        }
        normalized[field_id] = checked;
      }
      continue;
    }

    const text_value = raw_value == null ? '' : String(raw_value).trim();

    if (field.required && text_value === '') {
      return { error: `Field is required: ${field.label}` };
    }

    if (text_value === '') {
      normalized[field_id] = '';
      continue;
    }

    if (field.type === 'dropdown') {
      const options = Array.isArray(field.options) ? field.options : [];
      if (options.length && !options.includes(text_value)) {
        return { error: `Invalid dropdown option for field: ${field.label}` };
      }
      normalized[field_id] = text_value;
      continue;
    }

    if (field.type === 'number') {
      const parsed = Number(text_value);
      if (Number.isNaN(parsed)) {
        return { error: `Invalid numeric value for field: ${field.label}` };
      }
      normalized[field_id] = parsed;
      continue;
    }

    if (field.type === 'email') {
      if (!is_valid_email_value(text_value)) {
        return { error: `Invalid email value for field: ${field.label}` };
      }
      normalized[field_id] = text_value.toLowerCase();
      continue;
    }

    normalized[field_id] = raw_value == null ? '' : String(raw_value);
  }

  return { normalized };
}

router.get('/events', requireAuth, async (req, res, next) => {
  try {
    const {
      search,
      type,
      eligibility,
      from,
      to,
      followedOnly,
      organizerId,
      sortBy = 'startDate'
    } = req.query;

    const filter = {
      status: { $in: ['PUBLISHED', 'ONGOING', 'CLOSED', 'COMPLETED'] }
    };

    if (type) {
      filter.type = type;
    }

    if (organizerId) {
      filter.organizer = organizerId;
    }

    if (eligibility) {
      filter.eligibility = { $in: [eligibility] };
    }

    if (from || to) {
      filter.startDate = {};
      if (from) filter.startDate.$gte = new Date(from);
      if (to) filter.startDate.$lte = new Date(to);
    }

    if (followedOnly === 'true' && req.user.role === 'participant') {
      const followed = req.user.preferences?.followedOrganizers || [];
      filter.organizer = { $in: followed };
    }

    let events = await Event.find(filter).populate('organizer', 'organizerName category').lean();

    if (search) {
      const q = search.toLowerCase();
      events = events
        .map((event) => {
          const hay = `${event.name} ${event.organizer?.organizerName || ''}`.toLowerCase();
          const score = hay.includes(q) ? 2 : fuzzyScore(hay, q);
          return { event, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.event);
    }

    if (sortBy === 'trending') {
      const trendingIds = await trendingEventIds();
      const rank = new Map(trendingIds.map((id, idx) => [id.toString(), idx]));
      events.sort((a, b) => (rank.get(a._id.toString()) ?? 999) - (rank.get(b._id.toString()) ?? 999));
    } else {
      events.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    }

    const enriched = await Promise.all(
      events.map(async (event) => {
        const occupied = await getOccupiedSpots(event._id);
        return {
          ...publicEvent(event),
          occupiedSpots: occupied,
          availableSpots: Math.max(0, event.registrationLimit - occupied)
        };
      })
    );

    return res.json({ events: enriched });
  } catch (err) {
    return next(err);
  }
});

router.get('/events/trending', requireAuth, async (req, res, next) => {
  try {
    const ids = await trendingEventIds();
    const events = await Event.find({ _id: { $in: ids } }).populate('organizer', 'organizerName').lean();
    const byId = new Map(events.map((event) => [event._id.toString(), event]));
    const ordered = ids.map((id) => byId.get(id.toString())).filter(Boolean);

    return res.json({ events: ordered.map((event) => publicEvent(event)) });
  } catch (err) {
    return next(err);
  }
});

router.get('/events/:eventId', requireAuth, async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId).populate('organizer', 'organizerName category description contactEmail');
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const occupied = await getOccupiedSpots(event._id);
    const check = eventIsRegistrable(event);

    let alreadyRegistered = false;
    let existingOrder = null;
    let teamOptions = [];

    if (req.user.role === 'participant') {
      if (event.type === 'NORMAL') {
        alreadyRegistered = !!(await Registration.findOne({
          event: event._id,
          participant: req.user._id
        }));
        if (event.teamBased) {
          teamOptions = await get_event_team_options(event._id, event.maxTeamSize);
        }
      } else {
        existingOrder = await MerchandiseOrder.findOne({
          event: event._id,
          participant: req.user._id
        })
          .populate('ticket', 'ticketId')
          .sort({ createdAt: -1 });
      }
    }

    return res.json({
      event: publicEvent(event.toObject()),
      occupiedSpots: occupied,
      availableSpots: Math.max(0, event.registrationLimit - occupied),
      registrationOpen: check.ok,
      blockingReason: check.ok ? null : check.reason,
      alreadyRegistered,
      existingOrder,
      teamOptions
    });
  } catch (err) {
    return next(err);
  }
});

router.post(
  '/events/:eventId/register',
  requireAuth,
  allowRoles('participant'),
  registrationFileUpload.any(),
  async (req, res, next) => {
    const uploaded_files = Array.isArray(req.files) ? req.files : [];
    const fail = (status, message) => {
      remove_uploaded_registration_files(uploaded_files);
      return res.status(status).json({ message });
    };

    try {
      const event = await Event.findById(req.params.eventId);
      if (!event) {
        return fail(404, 'Event not found');
      }
      if (event.type !== 'NORMAL') {
        return fail(400, 'Use merchandise purchase flow for this event');
      }

      const parsed_body = (() => {
        try {
          return parse_registration_payload(req.body);
        } catch (err) {
          return null;
        }
      })();

      if (!parsed_body) {
        return fail(400, 'Invalid registration payload');
      }

      const check = eventIsRegistrable(event);
      if (!check.ok) {
        return fail(400, check.reason);
      }

      const occupied = await getOccupiedSpots(event._id);
      if (occupied >= event.registrationLimit) {
        return fail(400, 'Registration limit reached');
      }

      const existing = await Registration.findOne({ event: event._id, participant: req.user._id });
      if (existing) {
        return fail(409, 'Already registered for this event');
      }

      let final_team_name = undefined;
      if (event.teamBased) {
        const team_action = parsed_body.teamAction;
        const requested_team_name = normalize_team_name(parsed_body.teamName);
        const team_options = await get_event_team_options(event._id, event.maxTeamSize);
        const team_map = new Map(team_options.map((item) => [item.teamKey, item]));
        const requested_team_key = requested_team_name.toLowerCase();

        if (!['create', 'join'].includes(team_action)) {
          return fail(400, 'Choose whether to create a team or join an existing team');
        }

        if (!requested_team_name) {
          return fail(400, 'Team name is required for team-based events');
        }

        if (team_action === 'create') {
          if (team_map.has(requested_team_key)) {
            return fail(409, 'Team already exists. Choose join team instead.');
          }
          final_team_name = requested_team_name;
        } else {
          const team = team_map.get(requested_team_key);
          if (!team) {
            return fail(400, 'Selected team does not exist');
          }
          if (team.isFull) {
            return fail(400, 'Selected team is full');
          }
          final_team_name = team.teamName;
        }
      }

      const file_map = new Map();
      for (const file of uploaded_files) {
        if (typeof file.fieldname !== 'string') continue;
        if (!file.fieldname.startsWith('file_')) continue;
        const field_id = file.fieldname.slice('file_'.length);
        if (!field_id) continue;
        file_map.set(field_id, file);
      }

      const allowed_file_fields = new Set(
        (event.customForm || [])
          .filter((field) => field.type === 'file')
          .map((field) => String(field.fieldId || '').trim())
          .filter(Boolean)
      );
      for (const [field_id, file] of file_map.entries()) {
        if (!allowed_file_fields.has(field_id)) {
          remove_uploaded_registration_files([file]);
          file_map.delete(field_id);
        }
      }

      const raw_responses =
        parsed_body.responses && typeof parsed_body.responses === 'object' ? parsed_body.responses : {};
      const response_parse = normalize_registration_responses({
        event,
        rawResponses: raw_responses,
        uploadedFilesByFieldId: file_map
      });
      if (response_parse.error) {
        return fail(400, response_parse.error);
      }

      const registration = await Registration.create({
        event: event._id,
        participant: req.user._id,
        teamName: final_team_name,
        responses: response_parse.normalized,
        status: 'REGISTERED'
      });

      const ticket = await createTicket({
        event,
        participantId: req.user._id,
        registrationId: registration._id
      });

      registration.ticket = ticket._id;
      await registration.save();

      if (!event.formLocked) {
        event.formLocked = true;
        await event.save();
      }

      await sendEmail({
        to: req.user.email,
        subject: `Felicity Connect Ticket - ${event.name}`,
        text: [
          `Hi ${req.user.firstName || 'Participant'},`,
          '',
          `Your registration is confirmed for ${event.name}.`,
          `Ticket ID: ${ticket.ticketId}`,
          `Event Time: ${new Date(event.startDate).toLocaleString()} - ${new Date(event.endDate).toLocaleString()}`,
          final_team_name ? `Team: ${final_team_name}` : null
        ]
          .filter(Boolean)
          .join('\n')
      });

      return res.status(201).json({
        message: 'Registration successful',
        registration,
        ticket
      });
    } catch (err) {
      return next(err);
    }
  }
);

router.post('/events/:eventId/purchase', requireAuth, allowRoles('participant'), async (req, res, next) => {
  try {
    const { itemSku, quantity } = req.body;

    const event = await Event.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.type !== 'MERCHANDISE') {
      return res.status(400).json({ message: 'This event is not merchandise' });
    }

    const check = eventIsRegistrable(event);
    if (!check.ok) {
      return res.status(400).json({ message: check.reason });
    }

    const item = event.merchandise?.items?.find((it) => it.sku === itemSku);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const existingOpen = await MerchandiseOrder.findOne({
      event: event._id,
      participant: req.user._id,
      status: { $in: ['CREATED', 'PENDING_APPROVAL'] }
    }).sort({ createdAt: -1 });
    if (existingOpen) {
      return res.status(409).json({
        message: 'You already have an open merchandise order. Upload payment proof or wait for review.',
        order: existingOpen
      });
    }

    const qty = Number(quantity || 1);
    if (qty < 1 || qty > item.purchaseLimit) {
      return res.status(400).json({ message: `Quantity must be between 1 and ${item.purchaseLimit}` });
    }

    const priorQtyAgg = await MerchandiseOrder.aggregate([
      {
        $match: {
          event: event._id,
          participant: req.user._id,
          itemSku,
          status: { $in: ['CREATED', 'PENDING_APPROVAL', 'APPROVED'] }
        }
      },
      {
        $group: {
          _id: '$participant',
          totalQty: { $sum: '$quantity' }
        }
      }
    ]);

    const priorQty = priorQtyAgg[0]?.totalQty || 0;
    if (priorQty + qty > item.purchaseLimit) {
      return res
        .status(400)
        .json({ message: `Per-participant purchase limit exceeded for this item (max ${item.purchaseLimit})` });
    }

    if (item.stock < qty) {
      return res.status(400).json({ message: 'Out of stock for selected quantity' });
    }

    const order = await MerchandiseOrder.create({
      event: event._id,
      participant: req.user._id,
      itemSku,
      quantity: qty,
      amount: item.price * qty,
      status: 'CREATED'
    });

    return res.status(201).json({
      message: 'Order created. Upload payment proof to submit for organizer approval.',
      order
    });
  } catch (err) {
    return next(err);
  }
});

router.post(
  '/orders/:orderId/upload-proof',
  requireAuth,
  allowRoles('participant'),
  paymentProofUpload.single('proof'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Payment proof image is required' });
      }

      const order = await MerchandiseOrder.findById(req.params.orderId).populate('event');
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      if (order.participant.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Cannot modify this order' });
      }

      if (!['CREATED', 'REJECTED'].includes(order.status)) {
        return res.status(400).json({ message: 'Payment proof cannot be uploaded in this state' });
      }

      remove_payment_proof_file(order.paymentProofUrl);

      const relPath = `uploads/payment-proofs/${req.file.filename}`;
      order.paymentProofUrl = relPath;
      order.paymentProofOriginalName = req.file.originalname || '';
      order.paymentProofMimeType = req.file.mimetype || '';
      order.status = 'PENDING_APPROVAL';
      order.reviewComment = '';
      order.reviewedBy = null;
      order.reviewedAt = null;
      await order.save();

      return res.json({ message: 'Payment proof uploaded and submitted for approval', order });
    } catch (err) {
      return next(err);
    }
  }
);

router.get('/orders/:orderId/payment-proof', requireAuth, async (req, res, next) => {
  try {
    const order = await MerchandiseOrder.findById(req.params.orderId).populate('event', 'organizer');
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const user_id = req.user._id.toString();
    const is_owner = order.participant.toString() === user_id;
    const is_admin = req.user.role === 'admin';
    const is_event_organizer = req.user.role === 'organizer' && order.event?.organizer?.toString() === user_id;

    if (!is_owner && !is_admin && !is_event_organizer) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (!order.paymentProofUrl) {
      return res.status(404).json({ message: 'Payment proof not found' });
    }

    const absolute = path.resolve(__dirname, '..', order.paymentProofUrl);
    if (!absolute.startsWith(paymentProofUploadDir)) {
      return res.status(400).json({ message: 'Invalid payment proof path' });
    }

    if (!fs.existsSync(absolute)) {
      return res.status(404).json({ message: 'Payment proof file is missing' });
    }

    const suggested_name = normalize_download_name(order.paymentProofOriginalName, path.basename(absolute));
    return res.download(absolute, suggested_name);
  } catch (err) {
    return next(err);
  }
});

router.get('/orders/me', requireAuth, allowRoles('participant'), async (req, res, next) => {
  try {
    const orders = await MerchandiseOrder.find({ participant: req.user._id })
      .populate('event', 'name type organizer startDate endDate')
      .populate('ticket')
      .sort({ createdAt: -1 });

    return res.json({ orders });
  } catch (err) {
    return next(err);
  }
});

router.get('/tickets/:ticketId', requireAuth, async (req, res, next) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId })
      .populate('event')
      .populate('participant', 'firstName lastName email')
      .populate('registration')
      .populate('order');

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const isOwner = ticket.participant?._id?.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    const isOrganizer = req.user.role === 'organizer' && ticket.event.organizer.toString() === req.user._id.toString();

    if (!isOwner && !isAdmin && !isOrganizer) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    return res.json({ ticket });
  } catch (err) {
    return next(err);
  }
});

router.get('/tickets/:ticketId/calendar-links', requireAuth, async (req, res, next) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId }).populate('event');

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const isOwner = ticket.participant.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const event = ticket.event;
    const payload = {
      uid: ticket.ticketId,
      title: event.name,
      description: event.description,
      location: 'IIIT Campus',
      startDate: event.startDate,
      endDate: event.endDate
    };

    return res.json({
      googleLink: buildGoogleCalendarLink(payload),
      outlookLink: buildOutlookCalendarLink(payload)
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/tickets/:ticketId/calendar.ics', requireAuth, async (req, res, next) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId }).populate('event');

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const isOwner = ticket.participant.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const event = ticket.event;
    const ics = buildICS({
      uid: ticket.ticketId,
      title: event.name,
      description: event.description,
      location: 'IIIT Campus',
      startDate: event.startDate,
      endDate: event.endDate
    });

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${ticket.ticketId}.ics"`);
    return res.send(ics);
  } catch (err) {
    return next(err);
  }
});

function fuzzyScore(haystack, needle) {
  if (!needle) return 1;
  if (haystack.includes(needle)) return 2;

  let i = 0;
  for (const ch of haystack) {
    if (needle[i] === ch) i += 1;
    if (i === needle.length) return 1;
  }

  return 0;
}

async function trendingEventIds() {
  const since = dayjs().subtract(24, 'hour').toDate();

  const regAgg = await Registration.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $group: { _id: '$event', count: { $sum: 1 } } }
  ]);

  const orderAgg = await MerchandiseOrder.aggregate([
    {
      $match: {
        createdAt: { $gte: since },
        status: { $in: ['CREATED', 'PENDING_APPROVAL', 'APPROVED'] }
      }
    },
    { $group: { _id: '$event', count: { $sum: '$quantity' } } }
  ]);

  const score = new Map();
  for (const row of regAgg) {
    score.set(row._id.toString(), (score.get(row._id.toString()) || 0) + row.count);
  }
  for (const row of orderAgg) {
    score.set(row._id.toString(), (score.get(row._id.toString()) || 0) + row.count);
  }

  return [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);
}

export default router;
