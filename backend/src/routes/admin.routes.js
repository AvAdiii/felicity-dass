import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { Event } from '../models/Event.js';
import { PasswordResetRequest } from '../models/PasswordResetRequest.js';
import { generateRandomPassword } from '../utils/password.js';
import { is_valid_phone_number, normalize_phone_number } from '../utils/validation.js';
import { normalize_organizer_category, organizer_category_options } from '../utils/categories.js';

const router = Router();

router.use(requireAuth, allowRoles('admin'));

router.get('/dashboard', async (req, res, next) => {
  try {
    const [participants, organizers, events, pendingResetRequests] = await Promise.all([
      User.countDocuments({ role: 'participant' }),
      User.countDocuments({ role: 'organizer' }),
      Event.countDocuments(),
      PasswordResetRequest.countDocuments({ status: 'PENDING' })
    ]);

    return res.json({
      participants,
      organizers,
      events,
      pendingResetRequests
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/organizers', async (req, res, next) => {
  try {
    const { organizerName, category, description, contactEmail, contactNumber } = req.body;
    if (!organizerName || !category || !description || !contactEmail) {
      return res.status(400).json({ message: 'Missing required organizer fields' });
    }

    const normalized_category = normalize_organizer_category(category);
    if (!normalized_category) {
      return res.status(400).json({
        message: `Invalid organizer category. Use one of: ${organizer_category_options.join(', ')}`
      });
    }

    if (contactNumber && !is_valid_phone_number(contactNumber)) {
      return res.status(400).json({ message: 'Organizer contact number must be exactly 10 digits' });
    }

    const email = await generateOrganizerLoginEmail(organizerName);
    const plainPassword = generateRandomPassword(10);
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const organizer = await User.create({
      role: 'organizer',
      email,
      passwordHash,
      organizerName,
      category: normalized_category,
      description,
      contactEmail,
      contactNumber: contactNumber ? normalize_phone_number(contactNumber) : undefined,
      disabled: false,
      archived: false
    });

    return res.status(201).json({
      message: 'Organizer account created',
      organizer,
      credentials: {
        email,
        password: plainPassword
      }
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/organizers', async (req, res, next) => {
  try {
    const organizers = await User.find({ role: 'organizer' }).sort({ createdAt: -1 });
    return res.json({ organizers });
  } catch (err) {
    return next(err);
  }
});

router.patch('/organizers/:organizerId', async (req, res, next) => {
  try {
    const { action } = req.body;
    const organizer = await User.findOne({ _id: req.params.organizerId, role: 'organizer' });
    if (!organizer) {
      return res.status(404).json({ message: 'Organizer not found' });
    }

    if (action === 'disable') {
      organizer.disabled = true;
      await organizer.save();
      return res.json({ message: 'Organizer disabled' });
    }

    if (action === 'enable') {
      organizer.disabled = false;
      await organizer.save();
      return res.json({ message: 'Organizer enabled' });
    }

    if (action === 'archive') {
      organizer.archived = true;
      organizer.disabled = true;
      await organizer.save();
      return res.json({ message: 'Organizer archived' });
    }

    if (action === 'delete') {
      await Event.deleteMany({ organizer: organizer._id });
      await organizer.deleteOne();
      return res.json({ message: 'Organizer permanently deleted' });
    }

    return res.status(400).json({ message: 'Invalid action. Use disable/enable/archive/delete' });
  } catch (err) {
    return next(err);
  }
});

router.get('/password-reset-requests', async (req, res, next) => {
  try {
    const status = req.query.status;
    const query = {};
    if (status) {
      query.status = status;
    }

    const requests = await PasswordResetRequest.find(query)
      .populate('organizer', 'organizerName email')
      .populate('handledBy', 'email')
      .sort({ createdAt: -1 });

    return res.json({ requests });
  } catch (err) {
    return next(err);
  }
});

router.patch('/password-reset-requests/:requestId', async (req, res, next) => {
  try {
    const { action, comment } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Action must be approve/reject' });
    }

    const resetReq = await PasswordResetRequest.findById(req.params.requestId).populate('organizer');
    if (!resetReq) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (resetReq.status !== 'PENDING') {
      return res.status(400).json({ message: 'Request already handled' });
    }

    resetReq.status = action === 'approve' ? 'APPROVED' : 'REJECTED';
    resetReq.adminComment = comment || '';
    resetReq.handledBy = req.user._id;
    resetReq.handledAt = new Date();

    if (action === 'approve') {
      const generatedPassword = generateRandomPassword(10);
      resetReq.generatedPasswordPlain = generatedPassword;

      resetReq.organizer.passwordHash = await bcrypt.hash(generatedPassword, 10);
      resetReq.organizer.authTokenVersion = Number(resetReq.organizer.authTokenVersion || 0) + 1;
      resetReq.organizer.passwordResetHistory.push({
        reason: 'admin_approved_reset',
        changedBy: req.user._id
      });
      await resetReq.organizer.save();
    }

    await resetReq.save();

    return res.json({
      message: `Request ${action}d`,
      request: resetReq,
      generatedPassword: resetReq.generatedPasswordPlain || null
    });
  } catch (err) {
    return next(err);
  }
});

async function generateOrganizerLoginEmail(organizerName) {
  const base = organizerName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 30);

  let candidate = `${base || 'organizer'}@org.felicity.local`;
  let counter = 1;

  while (await User.exists({ email: candidate })) {
    candidate = `${base || 'organizer'}${counter}@org.felicity.local`;
    counter += 1;
  }

  return candidate;
}

export default router;
