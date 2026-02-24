import mongoose from 'mongoose';

const password_reset_request_schema = new mongoose.Schema(
  {
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, trim: true, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING'
    },
    adminComment: { type: String, trim: true },
    generatedPasswordPlain: { type: String },
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    handledAt: { type: Date }
  },
  { timestamps: true }
);

password_reset_request_schema.index({ organizer: 1, status: 1 });

export const PasswordResetRequest = mongoose.model('PasswordResetRequest', password_reset_request_schema);
