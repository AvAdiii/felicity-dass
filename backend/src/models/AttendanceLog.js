import mongoose from 'mongoose';

const attendance_log_schema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' },
    participant: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    scannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['SCANNED', 'DUPLICATE', 'INVALID', 'MANUAL_OVERRIDE'],
      required: true
    },
    payload: { type: String },
    note: { type: String }
  },
  { timestamps: true }
);

attendance_log_schema.index({ event: 1, participant: 1, status: 1 });

export const AttendanceLog = mongoose.model('AttendanceLog', attendance_log_schema);
