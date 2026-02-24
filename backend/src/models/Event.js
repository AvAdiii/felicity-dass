import mongoose from 'mongoose';

const form_field_schema = new mongoose.Schema(
  {
    fieldId: { type: String, required: true },
    label: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['text', 'textarea', 'dropdown', 'checkbox', 'file', 'number', 'email'],
      default: 'text'
    },
    options: [{ type: String, trim: true }],
    required: { type: Boolean, default: false },
    order: { type: Number, default: 0 }
  },
  { _id: false }
);

const merchandise_item_schema = new mongoose.Schema(
  {
    sku: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    size: { type: String, trim: true },
    color: { type: String, trim: true },
    variant: { type: String, trim: true },
    price: { type: Number, default: 0, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    purchaseLimit: { type: Number, default: 1, min: 1 }
  },
  { _id: false }
);

const event_schema = new mongoose.Schema(
  {
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    type: { type: String, enum: ['NORMAL', 'MERCHANDISE'], required: true },
    eligibility: [{ type: String, trim: true }],
    registrationDeadline: { type: Date, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    registrationLimit: { type: Number, default: 1, min: 1 },
    registrationFee: { type: Number, default: 0, min: 0 },
    teamBased: { type: Boolean, default: false },
    maxTeamSize: { type: Number, default: 1, min: 1 },
    tags: [{ type: String, trim: true }],

    customForm: [form_field_schema],
    formLocked: { type: Boolean, default: false },

    merchandise: {
      items: [merchandise_item_schema]
    },

    status: {
      type: String,
      enum: ['DRAFT', 'PUBLISHED', 'ONGOING', 'CLOSED', 'COMPLETED'],
      default: 'DRAFT'
    }
  },
  { timestamps: true }
);

event_schema.index({ name: 'text', description: 'text', tags: 'text' });
event_schema.index({ organizer: 1, status: 1 });
event_schema.index({ type: 1, registrationDeadline: 1 });

export const Event = mongoose.model('Event', event_schema);
