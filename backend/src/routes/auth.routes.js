import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User } from '../models/User.js';
import { ParticipantPasswordResetToken } from '../models/ParticipantPasswordResetToken.js';
import { requireAuth } from '../middleware/auth.js';
import { createToken } from '../utils/auth.js';
import { publicUser } from '../utils/serialize.js';
import { is_valid_phone_number, normalize_phone_number } from '../utils/validation.js';
import { sendEmail } from '../utils/email.js';

const router = Router();
const min_password_len = 6;

function escape_regex(input) {
  return String(input || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isIIITEmail(email) {
  const baseDomain = (process.env.IIIT_EMAIL_DOMAIN || 'iiit.ac.in').toLowerCase();
  const emailDomain = String(email || '').toLowerCase().split('@')[1] || '';
  const escapedBaseDomain = escape_regex(baseDomain);
  const domainPattern = new RegExp(
    `^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)?${escapedBaseDomain}$`,
    'i'
  );

  return domainPattern.test(emailDomain);
}

function hash_reset_token(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function build_reset_link({ email, token }) {
  const origin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
  const query = new URLSearchParams({ email, token }).toString();
  return `${origin}/reset-password?${query}`;
}

router.post('/signup-participant', async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      participantType,
      collegeName,
      contactNumber
    } = req.body;

    if (!firstName || !lastName || !email || !password || !participantType) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!contactNumber) {
      return res.status(400).json({ message: 'Contact number is required' });
    }

    if (!['IIIT', 'NON_IIIT'].includes(participantType)) {
      return res.status(400).json({ message: 'Invalid participant type' });
    }

    if (!is_valid_phone_number(contactNumber)) {
      return res.status(400).json({ message: 'Contact number must be exactly 10 digits' });
    }

    if (participantType === 'IIIT' && !isIIITEmail(email)) {
      return res
        .status(400)
        .json({
          message: `IIIT participants must use ${process.env.IIIT_EMAIL_DOMAIN || 'iiit.ac.in'} or one subdomain (like students.iiit.ac.in)`
        });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const normalizedCollegeName = participantType === 'IIIT' ? 'IIIT Hyderabad' : collegeName;

    const user = await User.create({
      role: 'participant',
      email: email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      participantType,
      collegeName: normalizedCollegeName,
      contactNumber: normalize_phone_number(contactNumber),
      preferences: {
        interests: [],
        followedOrganizers: []
      },
      onboardingCompleted: false
    });

    const token = createToken(user);
    return res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    return next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || user.disabled) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = createToken(user);
    return res.json({ token, user: publicUser(user) });
  } catch (err) {
    return next(err);
  }
});

router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const normalized_email = String(email).toLowerCase().trim();
    const generic_response = 'If a participant account exists for this email, a reset link has been sent.';

    const participant = await User.findOne({
      email: normalized_email,
      role: 'participant',
      disabled: false
    });

    if (!participant) {
      return res.json({ message: generic_response });
    }

    const raw_token = crypto.randomBytes(32).toString('hex');
    const token_hash = hash_reset_token(raw_token);
    const ttl_min = Number(process.env.PARTICIPANT_RESET_TOKEN_TTL_MINUTES || 30);
    const expires_at = new Date(Date.now() + ttl_min * 60 * 1000);

    await ParticipantPasswordResetToken.deleteMany({ user: participant._id, usedAt: null });
    await ParticipantPasswordResetToken.create({
      user: participant._id,
      tokenHash: token_hash,
      expiresAt: expires_at
    });

    const reset_link = build_reset_link({ email: participant.email, token: raw_token });

    await sendEmail({
      to: participant.email,
      subject: 'Felicity Connect Password Reset',
      text: [
        `Hi ${participant.firstName || 'Participant'},`,
        '',
        'A password reset was requested for your participant account.',
        `Reset link: ${reset_link}`,
        `This link expires in ${ttl_min} minutes.`,
        '',
        'If you did not request this, you can ignore this email.'
      ].join('\n')
    });

    return res.json({ message: generic_response });
  } catch (err) {
    return next(err);
  }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) {
      return res.status(400).json({ message: 'Email, token and new password are required' });
    }

    if (String(newPassword).length < min_password_len) {
      return res.status(400).json({ message: `Password must be at least ${min_password_len} characters` });
    }

    const participant = await User.findOne({
      email: String(email).toLowerCase().trim(),
      role: 'participant',
      disabled: false
    });
    if (!participant) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    const token_hash = hash_reset_token(token);
    const reset_row = await ParticipantPasswordResetToken.findOne({
      user: participant._id,
      tokenHash: token_hash,
      usedAt: null,
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    if (!reset_row) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    const is_same_password = await bcrypt.compare(newPassword, participant.passwordHash);
    if (is_same_password) {
      return res.status(400).json({ message: 'New password must be different from current password' });
    }

    participant.passwordHash = await bcrypt.hash(newPassword, 10);
    participant.authTokenVersion = Number(participant.authTokenVersion || 0) + 1;
    participant.passwordResetHistory.push({ reason: 'participant_email_reset', changedBy: participant._id });
    await participant.save();

    reset_row.usedAt = new Date();
    await reset_row.save();
    await ParticipantPasswordResetToken.deleteMany({ user: participant._id, usedAt: null });

    await sendEmail({
      to: participant.email,
      subject: 'Felicity Connect Password Updated',
      text: [
        `Hi ${participant.firstName || 'Participant'},`,
        '',
        'Your password has been updated successfully.',
        'If this was not you, contact support/admin immediately.'
      ].join('\n')
    });

    return res.json({ message: 'Password reset successful. Please login with your new password.' });
  } catch (err) {
    return next(err);
  }
});

router.get('/me', requireAuth, async (req, res) => {
  return res.json({ user: publicUser(req.user) });
});

router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Both current and new passwords are required' });
    }

    if (String(newPassword).length < min_password_len) {
      return res.status(400).json({ message: `Password must be at least ${min_password_len} characters` });
    }

    const ok = await bcrypt.compare(currentPassword, req.user.passwordHash);
    if (!ok) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    req.user.passwordHash = await bcrypt.hash(newPassword, 10);
    req.user.authTokenVersion = Number(req.user.authTokenVersion || 0) + 1;
    req.user.passwordResetHistory.push({ reason: 'self_change', changedBy: req.user._id });
    await req.user.save();

    return res.json({ message: 'Password changed successfully' });
  } catch (err) {
    return next(err);
  }
});

export default router;
