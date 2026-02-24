import mongoose from 'mongoose';

const reaction_schema = new mongoose.Schema(
  {
    emoji: { type: String, required: true },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  { _id: false }
);

const discussion_message_schema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorRole: { type: String, enum: ['participant', 'organizer', 'admin'], required: true },
    content: { type: String, required: true, trim: true, maxlength: 600 },
    parentMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'DiscussionMessage' },
    reactions: [reaction_schema],
    isPinned: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

discussion_message_schema.index({ event: 1, createdAt: -1 });

export const DiscussionMessage = mongoose.model('DiscussionMessage', discussion_message_schema);
