import mongoose from 'mongoose';

const paymentMilestoneSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    dueDate: {
      type: Date,
    },
    paidDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['unpaid', 'paid', 'overdue'],
      default: 'unpaid',
    },
    note: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: true }
);

const contractSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Hợp đồng phải thuộc về một Không gian làm việc'],
      index: true,
    },
    code: {
      type: String,
      required: [true, 'Vui lòng cung cấp mã hoặc số hợp đồng'],
      trim: true,
      uppercase: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Vui lòng nhập tên hoặc trích yếu hợp đồng'],
      trim: true,
    },
    // contractType là input dạng text tự do theo yêu cầu của người dùng, không giới hạn enum
    contractType: {
      type: String,
      default: 'Hợp đồng dịch vụ',
      trim: true,
    },
    // 6 giai đoạn chuẩn Bitrix24 Deals
    stage: {
      type: String,
      enum: ['draft', 'pending_sign', 'active', 'settlement', 'completed', 'cancelled'],
      default: 'draft',
      index: true,
    },
    totalValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    partner: {
      name: {
        type: String,
        required: [true, 'Vui lòng nhập tên đối tác / khách hàng'],
        trim: true,
      },
      taxCode: {
        type: String,
        default: '',
        trim: true,
      },
      representative: {
        type: String,
        default: '',
        trim: true,
      },
      role: {
        type: String,
        default: '',
        trim: true,
      },
      phone: {
        type: String,
        default: '',
        trim: true,
      },
      email: {
        type: String,
        default: '',
        trim: true,
      },
      address: {
        type: String,
        default: '',
        trim: true,
      },
      bankAccount: {
        type: String,
        default: '',
        trim: true,
      },
      bankName: {
        type: String,
        default: '',
        trim: true,
      },
    },
    paymentMilestones: [paymentMilestoneSchema],
    signDate: {
      type: Date,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
      index: true,
    },
    isAutoRenew: {
      type: Boolean,
      default: false,
    },
    // Hỗ trợ gắn nhiều dự án triển khai cho hợp đồng
    projects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
      },
    ],
    // Hỗ trợ gắn nhiều phòng ban phụ trách / phối hợp
    departments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
      },
    ],
    // Giữ lại trường đơn lẻ để tương thích ngược 100%
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    attachments: [
      {
        name: { type: String, default: '' },
        url: { type: String, default: '' },
        fileType: { type: String, default: 'file' },
        size: { type: Number, default: 0 },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    description: {
      type: String,
      default: '',
      trim: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual tự tính tiền còn lại (Remaining / Balance)
contractSchema.virtual('remainingAmount').get(function () {
  const total = Number(this.totalValue) || 0;
  const paid = Number(this.paidAmount) || 0;
  return Math.max(0, total - paid);
});

// Middleware tự động tính lại paidAmount và đồng bộ projects/departments
contractSchema.pre('save', function (next) {
  if (this.paymentMilestones && this.paymentMilestones.length > 0) {
    const totalPaid = this.paymentMilestones
      .filter((m) => m.status === 'paid')
      .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
    this.paidAmount = totalPaid;
  }

  // Đồng bộ projects <-> project
  if (this.projects && this.projects.length > 0 && !this.project) {
    this.project = this.projects[0];
  } else if (this.project && (!this.projects || this.projects.length === 0)) {
    this.projects = [this.project];
  }

  // Đồng bộ departments <-> department
  if (this.departments && this.departments.length > 0 && !this.department) {
    this.department = this.departments[0];
  } else if (this.department && (!this.departments || this.departments.length === 0)) {
    this.departments = [this.department];
  }

  next();
});

export const Contract = mongoose.model('Contract', contractSchema);
