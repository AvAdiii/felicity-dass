import mongoose from 'mongoose';

const participant_password_reset_token_schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

participant_password_reset_token_schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
participant_password_reset_token_schema.index({ user: 1, usedAt: 1 });

export const ParticipantPasswordResetToken = mongoose.model(
  'ParticipantPasswordResetToken',
  participant_password_reset_token_schema
);
