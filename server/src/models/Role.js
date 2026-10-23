import mongoose from 'mongoose';

const permissionResourceSchema = new mongoose.Schema(
  {
    // Phạm vi xem: 'all' (Tất cả), 'dept' (Trong phòng ban), 'own' (Chỉ của tôi/được giao), 'none' (Không xem được)
    view: {
      type: String,
      enum: ['all', 'dept', 'own', 'none'],
      default: 'all',
    },
    // Quyền tạo mới: true / false
    create: {
      type: Boolean,
      default: true,
    },
    // Phạm vi chỉnh sửa: 'all', 'dept', 'own', 'none'
    edit: {
      type: String,
      enum: ['all', 'dept', 'own', 'none'],
      default: 'all',
    },
    // Quyền xóa: true / false
    delete: {
      type: Boolean,
      default: false,
    },
    // Quyền đặc thù
    viewValue: {
      type: Boolean,
      default: true, // Cho phân hệ hợp đồng: xem giá trị tiền ($)
    },
    assign: {
      type: Boolean,
      default: true, // Cho công việc: phân công cho người khác; Cho team: đổi vai trò
    },
  },
  { _id: false }
);

const roleSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Tên vai trò là bắt buộc'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Mã vai trò là bắt buộc'],
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    color: {
      type: String,
      default: '#2563eb',
    },
    isSystem: {
      type: Boolean,
      default: false, // admin, manager, member là role hệ thống không cho xóa
    },
    order: {
      type: Number,
      default: 0,
    },
    permissions: {
      contracts: {
        type: permissionResourceSchema,
        default: () => ({
          view: 'all',
          viewValue: true,
          create: true,
          edit: 'all',
          delete: false,
          assign: true,
        }),
      },
      projects: {
        type: permissionResourceSchema,
        default: () => ({
          view: 'all',
          viewValue: true,
          create: true,
          edit: 'all',
          delete: false,
          assign: true,
        }),
      },
      tasks: {
        type: permissionResourceSchema,
        default: () => ({
          view: 'all',
          viewValue: true,
          create: true,
          edit: 'all',
          delete: true,
          assign: true,
        }),
      },
      departments: {
        type: permissionResourceSchema,
        default: () => ({
          view: 'all',
          viewValue: true,
          create: false,
          edit: 'none',
          delete: false,
          assign: false,
        }),
      },
      team: {
        type: permissionResourceSchema,
        default: () => ({
          view: 'all',
          viewValue: true,
          create: false,
          edit: 'none',
          delete: false,
          assign: false,
        }),
      },
      settings: {
        type: permissionResourceSchema,
        default: () => ({
          view: 'none',
          viewValue: false,
          create: false,
          edit: 'none',
          delete: false,
          assign: false,
        }),
      },
    },
  },
  {
    timestamps: true,
  }
);

// Index kết hợp workspace và code để đảm bảo code duy nhất trong 1 workspace
roleSchema.index({ workspace: 1, code: 1 }, { unique: true });

export const Role = mongoose.model('Role', roleSchema);
