import mongoose from 'mongoose';

const registration_schema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    participant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['REGISTERED', 'COMPLETED', 'CANCELLED', 'REJECTED'],
      default: 'REGISTERED'
    },
    teamName: { type: String, trim: true },
    responses: { type: mongoose.Schema.Types.Mixed, default: {} },
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' },
    registrationDate: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

registration_schema.index({ event: 1, participant: 1 }, { unique: true });
registration_schema.index({ participant: 1, status: 1 });

export const Registration = mongoose.model('Registration', registration_schema);
