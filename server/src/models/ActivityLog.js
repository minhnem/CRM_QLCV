import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      required: true, // e.g., 'CREATED_TASK', 'UPDATED_TASK_STATUS', 'DELETED_TASK'
    },
    targetType: {
      type: String,
      enum: ['task', 'project', 'user', 'system'],
      default: 'task',
    },
    targetId: {
      type: String,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
