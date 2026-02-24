import { Router } from 'express';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { Registration } from '../models/Registration.js';
import { MerchandiseOrder } from '../models/MerchandiseOrder.js';
import { User } from '../models/User.js';
import { Event } from '../models/Event.js';
import { Ticket } from '../models/Ticket.js';
import { publicUser } from '../utils/serialize.js';
import { is_valid_phone_number, normalize_phone_number } from '../utils/validation.js';
import { sanitize_participant_interests } from '../utils/categories.js';

const router = Router();

router.use(requireAuth, allowRoles('participant'));

router.get('/dashboard', async (req, res, next) => {
  try {
    const now = new Date();

    const upcomingRegistrations = await Registration.find({
      participant: req.user._id,
      status: { $in: ['REGISTERED'] }
    })
      .populate({
        path: 'event',
        match: { startDate: { $gte: now } },
        populate: { path: 'organizer', select: 'organizerName' }
      })
      .populate('ticket')
      .sort({ createdAt: -1 });

    const upcomingOrders = await MerchandiseOrder.find({
      participant: req.user._id,
      status: { $in: ['CREATED', 'PENDING_APPROVAL', 'APPROVED'] }
    })
      .populate({
        path: 'event',
        match: { startDate: { $gte: now } },
        populate: { path: 'organizer', select: 'organizerName' }
      })
      .populate('ticket')
      .sort({ createdAt: -1 });

    const upcoming = [
      ...upcomingRegistrations
        .filter((row) => row.event)
        .map((row) => ({
          source: 'NORMAL',
          eventName: row.event.name,
          eventType: row.event.type,
          organizer: row.event.organizer?.organizerName,
          schedule: {
            start: row.event.startDate,
            end: row.event.endDate
          },
          participationStatus: row.status,
          teamName: row.teamName,
          ticketId: row.ticket?.ticketId || null
        })),
      ...upcomingOrders
        .filter((row) => row.event)
        .map((row) => ({
          source: 'MERCHANDISE',
          eventName: row.event.name,
          eventType: row.event.type,
          organizer: row.event.organizer?.organizerName,
          schedule: {
            start: row.event.startDate,
            end: row.event.endDate
          },
          participationStatus: row.status,
          teamName: null,
          ticketId: row.ticket?.ticketId || null
        }))
    ];

    const history = await buildHistory(req.user._id);

    return res.json({
      upcoming,
      history
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/history', async (req, res, next) => {
  try {
    const history = await buildHistory(req.user._id);
    return res.json({ history });
  } catch (err) {
    return next(err);
  }
});

router.get('/profile', async (req, res) => {
  return res.json({ user: publicUser(req.user) });
});

router.put('/profile', async (req, res, next) => {
  try {
    if (Object.prototype.hasOwnProperty.call(req.body, 'contactNumber')) {
      if (!is_valid_phone_number(req.body.contactNumber)) {
        return res.status(400).json({ message: 'Contact number must be exactly 10 digits' });
      }
      req.body.contactNumber = normalize_phone_number(req.body.contactNumber);
    }

    const allowed = ['firstName', 'lastName', 'contactNumber', 'collegeName'];
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        req.user[key] = req.body[key];
      }
    }

    if (Array.isArray(req.body.interests) || Array.isArray(req.body.followedOrganizers)) {
      req.user.preferences = {
        interests: Array.isArray(req.body.interests)
          ? sanitize_participant_interests(req.body.interests)
          : req.user.preferences?.interests || [],
        followedOrganizers: Array.isArray(req.body.followedOrganizers)
          ? req.body.followedOrganizers
          : req.user.preferences?.followedOrganizers || []
      };
      req.user.onboardingCompleted = true;
    }

    await req.user.save();
    return res.json({ message: 'Profile updated', user: publicUser(req.user) });
  } catch (err) {
    return next(err);
  }
});

router.put('/preferences', async (req, res, next) => {
  try {
    const interests = sanitize_participant_interests(Array.isArray(req.body.interests) ? req.body.interests : []);
    const followedOrganizers = Array.isArray(req.body.followedOrganizers)
      ? req.body.followedOrganizers
      : req.user.preferences?.followedOrganizers || [];

    req.user.preferences = {
      interests,
      followedOrganizers
    };
    req.user.onboardingCompleted = true;
    await req.user.save();

    return res.json({ message: 'Preferences updated', preferences: req.user.preferences });
  } catch (err) {
    return next(err);
  }
});

router.post('/follow/:organizerId', async (req, res, next) => {
  try {
    const organizer = await User.findOne({ _id: req.params.organizerId, role: 'organizer', disabled: false });
    if (!organizer) {
      return res.status(404).json({ message: 'Organizer not found' });
    }

    const existing = new Set((req.user.preferences?.followedOrganizers || []).map((id) => id.toString()));
    existing.add(organizer._id.toString());
    req.user.preferences.followedOrganizers = [...existing];
    await req.user.save();

    return res.json({ message: 'Followed organizer', followedOrganizers: req.user.preferences.followedOrganizers });
  } catch (err) {
    return next(err);
  }
});

router.delete('/follow/:organizerId', async (req, res, next) => {
  try {
    req.user.preferences.followedOrganizers = (req.user.preferences?.followedOrganizers || []).filter(
      (id) => id.toString() !== req.params.organizerId
    );
    await req.user.save();

    return res.json({ message: 'Unfollowed organizer', followedOrganizers: req.user.preferences.followedOrganizers });
  } catch (err) {
    return next(err);
  }
});

async function buildHistory(participantId) {
  const regs = await Registration.find({ participant: participantId })
    .populate({ path: 'event', populate: { path: 'organizer', select: 'organizerName' } })
    .populate('ticket')
    .sort({ createdAt: -1 });

  const orders = await MerchandiseOrder.find({ participant: participantId })
    .populate({ path: 'event', populate: { path: 'organizer', select: 'organizerName' } })
    .populate('ticket')
    .sort({ createdAt: -1 });

  const normal = regs
    .filter((row) => row.event?.type === 'NORMAL')
    .map((row) => regToRecord(row));

  const merchandise = orders.map((row) => orderToRecord(row));

  const completed = [
    ...regs.filter((row) => row.status === 'COMPLETED').map((row) => regToRecord(row)),
    ...orders.filter((row) => row.status === 'APPROVED').map((row) => orderToRecord(row))
  ];

  const cancelledRejected = [
    ...regs
      .filter((row) => ['CANCELLED', 'REJECTED'].includes(row.status))
      .map((row) => regToRecord(row)),
    ...orders.filter((row) => ['REJECTED', 'CANCELLED'].includes(row.status)).map((row) => orderToRecord(row))
  ];

  return {
    normal,
    merchandise,
    completed,
    cancelledRejected
  };
}

function regToRecord(row) {
  return {
    eventName: row.event?.name,
    eventType: row.event?.type,
    organizer: row.event?.organizer?.organizerName,
    participationStatus: row.status,
    teamName: row.teamName || null,
    ticketId: row.ticket?.ticketId || null,
    createdAt: row.createdAt
  };
}

function orderToRecord(row) {
  return {
    eventName: row.event?.name,
    eventType: row.event?.type,
    organizer: row.event?.organizer?.organizerName,
    participationStatus: row.status,
    teamName: null,
    ticketId: row.ticket?.ticketId || null,
    createdAt: row.createdAt
  };
}

export default router;
