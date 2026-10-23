import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide project name'],
      trim: true,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      default: function () {
        return this.name
          ? this.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 5)
          : 'PRJ';
      },
    },
    description: {
      type: String,
      default: '',
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      index: true,
    },
    status: {
      type: String,
      enum: ['planning', 'active', 'on_hold', 'completed', 'archived'],
      default: 'active',
    },
    color: {
      type: String,
      default: '#2563eb', // Default blue
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    supervisor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    departments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
      },
    ],
    contracts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contract',
      },
    ],
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
    budget: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const Project = mongoose.model('Project', projectSchema);
