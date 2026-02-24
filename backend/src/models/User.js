import mongoose from 'mongoose';

const password_history_schema = new mongoose.Schema(
  {
    changedAt: { type: Date, default: Date.now },
    reason: { type: String },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { _id: false }
);

const user_schema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['participant', 'organizer', 'admin'],
      required: true
    },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },

    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    participantType: { type: String, enum: ['IIIT', 'NON_IIIT'] },
    collegeName: { type: String, trim: true },
    contactNumber: { type: String, trim: true },
    organizerName: { type: String, trim: true },
    category: { type: String, trim: true },
    description: { type: String, trim: true },
    contactEmail: { type: String, trim: true, lowercase: true },
    discordWebhookUrl: { type: String, trim: true },

    preferences: {
      interests: [{ type: String, trim: true }],
      followedOrganizers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    },

    onboardingCompleted: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    archived: { type: Boolean, default: false },
    authTokenVersion: { type: Number, default: 0 },
    passwordResetHistory: [password_history_schema]
  },
  { timestamps: true }
);

user_schema.index({ role: 1, organizerName: 1 });
user_schema.index({ role: 1, email: 1 });

export const User = mongoose.model('User', user_schema);
