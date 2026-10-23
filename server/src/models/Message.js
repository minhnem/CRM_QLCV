import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Message must have a sender'],
    },
    channelType: {
      type: String,
      enum: ['department', 'project'],
      required: true,
    },
    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'channelRefModel',
    },
    content: {
      type: String,
      required: [true, 'Message content cannot be empty'],
      trim: true,
    },
    attachments: [
      {
        name: { type: String, default: '' },
        url: { type: String, default: '' },
        fileType: { type: String, default: 'file' }, // image, doc, file, link
        size: { type: Number, default: 0 },
      },
    ],
    taskRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
    },
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isMentionAll: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual for dynamic ref model
messageSchema.virtual('channelRefModel').get(function () {
  return this.channelType === 'department' ? 'Department' : 'Project';
});

// Compound Index for lightning-fast cursor queries
messageSchema.index({ channelType: 1, channelId: 1, createdAt: -1 });

export const Message = mongoose.model('Message', messageSchema);
