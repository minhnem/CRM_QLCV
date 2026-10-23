import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Vui lòng nhập tên phòng ban'],
      trim: true,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      default: function () {
        return this.name
          ? this.name
              .split(' ')
              .map((w) => w[0])
              .join('')
              .toUpperCase()
              .slice(0, 6)
          : 'DEPT';
      },
    },
    description: {
      type: String,
      default: '',
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null, // null nghĩa là phòng ban cấp cao nhất (Root/Công ty)
    },
    head: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // Người phụ trách / Trưởng phòng
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    color: {
      type: String,
      default: '#2563eb',
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const Department = mongoose.model('Department', departmentSchema);
