import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Event } from '../models/Event.js';
import { Registration } from '../models/Registration.js';
import { MerchandiseOrder } from '../models/MerchandiseOrder.js';
import { DiscussionMessage } from '../models/DiscussionMessage.js';

const router = Router();

router.use(requireAuth);

router.get('/:eventId/messages', async (req, res, next) => {
  try {
    const access = await canAccessDiscussion(req.user, req.params.eventId, false);
    if (!access.ok) {
      return res.status(403).json({ message: access.message });
    }

    const messages = await DiscussionMessage.find({ event: req.params.eventId, isDeleted: false })
      .populate('author', 'firstName lastName organizerName role')
      .sort({ isPinned: -1, createdAt: 1 });

    return res.json({ messages });
  } catch (err) {
    return next(err);
  }
});

router.post('/:eventId/messages', async (req, res, next) => {
  try {
    const { content, parentMessage, isAnnouncement } = req.body;
    if (!content || content.trim().length < 1) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    const access = await canAccessDiscussion(req.user, req.params.eventId, true);
    if (!access.ok) {
      return res.status(403).json({ message: access.message });
    }

    const finalContent =
      isAnnouncement && req.user.role === 'organizer' ? `[Announcement] ${content.trim()}` : content.trim();

    const message = await DiscussionMessage.create({
      event: req.params.eventId,
      author: req.user._id,
      authorRole: req.user.role,
      content: finalContent,
      parentMessage: parentMessage || null,
      reactions: []
    });

    const populated = await DiscussionMessage.findById(message._id).populate(
      'author',
      'firstName lastName organizerName role'
    );

    req.app.locals.io.to(`event:${req.params.eventId}`).emit('discussion:new_message', {
      eventId: req.params.eventId,
      message: populated
    });

    req.app.locals.io.to(`event:${req.params.eventId}`).emit('discussion:notification', {
      eventId: req.params.eventId,
      text: 'New discussion message posted'
    });

    return res.status(201).json({ message: populated });
  } catch (err) {
    return next(err);
  }
});

router.patch('/messages/:messageId/pin', async (req, res, next) => {
  try {
    const message = await DiscussionMessage.findById(req.params.messageId).populate('event');
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const canModerate =
      req.user.role === 'admin' ||
      (req.user.role === 'organizer' && message.event.organizer.toString() === req.user._id.toString());

    if (!canModerate) {
      return res.status(403).json({ message: 'Only organizer/admin can pin messages' });
    }

    message.isPinned = !message.isPinned;
    await message.save();

    req.app.locals.io.to(`event:${message.event._id.toString()}`).emit('discussion:message_pinned', {
      messageId: message._id,
      isPinned: message.isPinned
    });

    return res.json({ message: 'Pin status updated', data: message });
  } catch (err) {
    return next(err);
  }
});

router.delete('/messages/:messageId', async (req, res, next) => {
  try {
    const message = await DiscussionMessage.findById(req.params.messageId).populate('event');
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const canDeleteOwn = message.author.toString() === req.user._id.toString();
    const canModerate =
      req.user.role === 'admin' ||
      (req.user.role === 'organizer' && message.event.organizer.toString() === req.user._id.toString());

    if (!canDeleteOwn && !canModerate) {
      return res.status(403).json({ message: 'Not allowed to delete this message' });
    }

    message.isDeleted = true;
    message.content = '[deleted]';
    await message.save();

    req.app.locals.io.to(`event:${message.event._id.toString()}`).emit('discussion:message_deleted', {
      messageId: message._id
    });

    return res.json({ message: 'Message deleted' });
  } catch (err) {
    return next(err);
  }
});

router.post('/messages/:messageId/react', async (req, res, next) => {
  try {
    const { emoji } = req.body;
    if (!emoji) {
      return res.status(400).json({ message: 'Emoji is required' });
    }

    const message = await DiscussionMessage.findById(req.params.messageId);
    if (!message || message.isDeleted) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const access = await canAccessDiscussion(req.user, message.event.toString(), false);
    if (!access.ok) {
      return res.status(403).json({ message: access.message });
    }

    let reaction = message.reactions.find((r) => r.emoji === emoji);
    if (!reaction) {
      reaction = { emoji, users: [] };
      message.reactions.push(reaction);
      reaction = message.reactions.find((r) => r.emoji === emoji);
    }

    const idx = reaction.users.findIndex((id) => id.toString() === req.user._id.toString());
    if (idx >= 0) {
      reaction.users.splice(idx, 1);
    } else {
      reaction.users.push(req.user._id);
    }

    await message.save();

    req.app.locals.io.to(`event:${message.event.toString()}`).emit('discussion:reaction_updated', {
      messageId: message._id,
      reactions: message.reactions
    });

    return res.json({ message: 'Reaction updated', reactions: message.reactions });
  } catch (err) {
    return next(err);
  }
});

async function canAccessDiscussion(user, eventId, posting = false) {
  const event = await Event.findById(eventId);
  if (!event) {
    return { ok: false, message: 'Event not found' };
  }

  if (user.role === 'admin') {
    return { ok: true, event };
  }

  if (user.role === 'organizer') {
    if (event.organizer.toString() !== user._id.toString()) {
      return { ok: false, message: 'Organizer can access only their own event discussion' };
    }
    return { ok: true, event };
  }

  const [reg, order] = await Promise.all([
    Registration.findOne({ event: eventId, participant: user._id }),
    MerchandiseOrder.findOne({
      event: eventId,
      participant: user._id,
      status: { $in: ['PENDING_APPROVAL', 'APPROVED'] }
    })
  ]);

  if (!reg && !order) {
    return { ok: false, message: posting ? 'Register first to post in discussion' : 'Register first to view discussion' };
  }

  return { ok: true, event };
}

export default router;
