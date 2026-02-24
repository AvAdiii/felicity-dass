import mongoose from 'mongoose';

const merchandise_order_schema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    participant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    itemSku: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    amount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['CREATED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED'],
      default: 'CREATED'
    },
    paymentProofUrl: { type: String },
    reviewComment: { type: String, trim: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' }
  },
  { timestamps: true }
);

merchandise_order_schema.index({ event: 1, participant: 1, itemSku: 1, status: 1 });

export const MerchandiseOrder = mongoose.model('MerchandiseOrder', merchandise_order_schema);
