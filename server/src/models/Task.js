import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please provide task title'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Task must belong to a project'],
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      index: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
    },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['todo', 'in_progress', 'review', 'done'],
      default: 'todo',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    startDate: {
      type: Date,
    },
    dueDate: {
      type: Date,
    },
    estimatedHours: {
      type: Number,
      default: 0,
    },
    actualHours: {
      type: Number,
      default: 0,
    },
    order: {
      type: Number,
      default: 0,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    // Người kiểm duyệt công việc (Reviewer)
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // Thông tin nộp bài (Deliverables)
    submission: {
      url: {
        type: String,
        default: '',
        trim: true,
      },
      note: {
        type: String,
        default: '',
        trim: true,
      },
      submittedAt: {
        type: Date,
      },
      submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    },
    // Nhận xét kiểm duyệt mới nhất
    reviewFeedback: {
      action: {
        type: String,
        enum: ['approved', 'changes_requested'],
      },
      comment: {
        type: String,
        default: '',
        trim: true,
      },
      reviewedAt: {
        type: Date,
      },
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    },
    // Lịch sử các lần duyệt và phản hồi
    reviewHistory: [
      {
        reviewer: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        action: {
          type: String,
        },
        comment: {
          type: String,
          default: '',
        },
        deliverableUrl: {
          type: String,
          default: '',
        },
        date: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const Task = mongoose.model('Task', taskSchema);
