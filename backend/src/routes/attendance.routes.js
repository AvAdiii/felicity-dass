import { Router } from 'express';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { Event } from '../models/Event.js';
import { Ticket } from '../models/Ticket.js';
import { AttendanceLog } from '../models/AttendanceLog.js';
import { Registration } from '../models/Registration.js';
import { MerchandiseOrder } from '../models/MerchandiseOrder.js';
import { User } from '../models/User.js';

const router = Router();

router.use(requireAuth, allowRoles('organizer'));

router.post('/scan', async (req, res, next) => {
  try {
    const { eventId, qrPayload } = req.body;
    if (!eventId || !qrPayload) {
      return res.status(400).json({ message: 'eventId and qrPayload are required' });
    }

    const event = await Event.findOne({ _id: eventId, organizer: req.user._id });
    if (!event) {
      return res.status(404).json({ message: 'Event not found for organizer' });
    }

    let parsed;
    try {
      parsed = JSON.parse(qrPayload);
    } catch (err) {
      await AttendanceLog.create({
        event: event._id,
        scannedBy: req.user._id,
        status: 'INVALID',
        payload: String(qrPayload),
        note: 'Invalid QR payload JSON'
      });
      return res.status(400).json({ message: 'Invalid QR payload' });
    }

    const ticketId = parsed?.t;
    if (!ticketId) {
      await AttendanceLog.create({
        event: event._id,
        scannedBy: req.user._id,
        status: 'INVALID',
        payload: String(qrPayload),
        note: 'Missing ticket id in payload'
      });
      return res.status(400).json({ message: 'Ticket id missing in QR payload' });
    }

    const ticket = await Ticket.findOne({ ticketId, event: event._id }).populate('participant', 'firstName lastName email');
    if (!ticket) {
      await AttendanceLog.create({
        event: event._id,
        scannedBy: req.user._id,
        status: 'INVALID',
        payload: String(qrPayload),
        note: 'Ticket not found for event'
      });
      return res.status(404).json({ message: 'Ticket not found for this event' });
    }

    const alreadyScanned = await AttendanceLog.findOne({
      event: event._id,
      participant: ticket.participant._id,
      status: { $in: ['SCANNED', 'MANUAL_OVERRIDE'] }
    });

    if (alreadyScanned) {
      await AttendanceLog.create({
        event: event._id,
        ticket: ticket._id,
        participant: ticket.participant._id,
        scannedBy: req.user._id,
        status: 'DUPLICATE',
        payload: String(qrPayload),
        note: 'Duplicate scan rejected'
      });

      return res.status(409).json({
        message: 'Duplicate scan. Attendance already marked.',
        participant: ticket.participant,
        ticketId: ticket.ticketId
      });
    }

    ticket.status = 'USED';
    await ticket.save();

    const log = await AttendanceLog.create({
      event: event._id,
      ticket: ticket._id,
      participant: ticket.participant._id,
      scannedBy: req.user._id,
      status: 'SCANNED',
      payload: String(qrPayload)
    });

    return res.json({
      message: 'Attendance marked',
      participant: ticket.participant,
      ticketId: ticket.ticketId,
      timestamp: log.createdAt
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/manual-override', async (req, res, next) => {
  try {
    const { eventId, ticketId, participantEmail, note } = req.body;
    if (!eventId || (!ticketId && !participantEmail)) {
      return res.status(400).json({ message: 'eventId + (ticketId or participantEmail) required' });
    }

    const event = await Event.findOne({ _id: eventId, organizer: req.user._id });
    if (!event) {
      return res.status(404).json({ message: 'Event not found for organizer' });
    }

    let participant = null;
    let ticket = null;

    if (ticketId) {
      ticket = await Ticket.findOne({ ticketId, event: event._id }).populate('participant', 'firstName lastName email');
      participant = ticket?.participant || null;
    } else {
      participant = await User.findOne({ email: participantEmail.toLowerCase(), role: 'participant' });
    }

    if (!participant) {
      return res.status(404).json({ message: 'Participant not found for override' });
    }

    const log = await AttendanceLog.create({
      event: event._id,
      ticket: ticket?._id,
      participant: participant._id,
      scannedBy: req.user._id,
      status: 'MANUAL_OVERRIDE',
      note: note || 'Manual override by organizer'
    });

    return res.json({
      message: 'Manual override recorded',
      participant: {
        id: participant._id,
        name: `${participant.firstName || ''} ${participant.lastName || ''}`.trim(),
        email: participant.email
      },
      timestamp: log.createdAt
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/:eventId/dashboard', async (req, res, next) => {
  try {
    const event = await Event.findOne({ _id: req.params.eventId, organizer: req.user._id });
    if (!event) {
      return res.status(404).json({ message: 'Event not found for organizer' });
    }

    const participants = await buildParticipantPool(event._id);
    const logs = await AttendanceLog.find({ event: event._id })
      .populate('participant', 'firstName lastName email')
      .sort({ createdAt: -1 });

    const scannedLogs = logs.filter((log) => ['SCANNED', 'MANUAL_OVERRIDE'].includes(log.status));
    const scannedParticipantIds = new Set(scannedLogs.map((log) => log.participant?._id?.toString()).filter(Boolean));

    const scanned = participants.filter((p) => scannedParticipantIds.has(p.id.toString()));
    const notScanned = participants.filter((p) => !scannedParticipantIds.has(p.id.toString()));

    return res.json({
      event: { id: event._id, name: event.name },
      summary: {
        totalParticipants: participants.length,
        scanned: scanned.length,
        notScanned: notScanned.length
      },
      scanned,
      notScanned,
      recentLogs: logs.slice(0, 50)
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/:eventId/export', async (req, res, next) => {
  try {
    const event = await Event.findOne({ _id: req.params.eventId, organizer: req.user._id });
    if (!event) {
      return res.status(404).json({ message: 'Event not found for organizer' });
    }

    const participants = await buildParticipantPool(event._id);
    const logs = await AttendanceLog.find({
      event: event._id,
      status: { $in: ['SCANNED', 'MANUAL_OVERRIDE'] }
    }).sort({ createdAt: -1 });

    const latest = new Map();
    for (const log of logs) {
      const pid = log.participant?.toString();
      if (!pid || latest.has(pid)) continue;
      latest.set(pid, log);
    }

    const lines = ['Name,Email,Status,Timestamp,Method'];

    for (const person of participants) {
      const row = latest.get(person.id.toString());
      lines.push(
        [
          csvEscape(person.name),
          csvEscape(person.email),
          csvEscape(row ? 'Present' : 'Absent'),
          csvEscape(row ? row.createdAt.toISOString() : ''),
          csvEscape(row ? row.status : '')
        ].join(',')
      );
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${event.name.replace(/\s+/g, '_')}_attendance.csv"`);
    return res.send(lines.join('\n'));
  } catch (err) {
    return next(err);
  }
});

async function buildParticipantPool(eventId) {
  const [regs, orders] = await Promise.all([
    Registration.find({ event: eventId, status: { $in: ['REGISTERED', 'COMPLETED'] } }).populate(
      'participant',
      'firstName lastName email'
    ),
    MerchandiseOrder.find({ event: eventId, status: 'APPROVED' }).populate('participant', 'firstName lastName email')
  ]);

  const map = new Map();

  for (const row of [...regs, ...orders]) {
    const participant = row.participant;
    if (!participant) continue;
    map.set(participant._id.toString(), {
      id: participant._id,
      name: `${participant.firstName || ''} ${participant.lastName || ''}`.trim(),
      email: participant.email
    });
  }

  return [...map.values()];
}

function csvEscape(value) {
  const str = String(value || '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default router;
