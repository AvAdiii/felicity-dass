import mongoose from 'mongoose';

const ticket_schema = new mongoose.Schema(
  {
    ticketId: { type: String, unique: true, required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    participant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    registration: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration' },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'MerchandiseOrder' },
    qrPayload: { type: String, required: true },
    qrData: { type: String, required: true },
    status: { type: String, enum: ['ACTIVE', 'USED', 'CANCELLED'], default: 'ACTIVE' }
  },
  { timestamps: true }
);

ticket_schema.index({ event: 1, participant: 1 });

export const Ticket = mongoose.model('Ticket', ticket_schema);
