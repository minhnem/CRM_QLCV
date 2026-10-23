import { Router } from 'express';
import mongoose from 'mongoose';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import projectRoutes from './projectRoutes.js';
import taskRoutes from './taskRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import departmentRoutes from './departmentRoutes.js';
import messageRoutes from './messageRoutes.js';
import workspaceRoutes from './workspaceRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import contractRoutes from './contractRoutes.js';
import calendarRoutes from './calendarRoutes.js';
import roleRoutes from './roleRoutes.js';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: dbStatus,
  });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/projects', projectRoutes);
router.use('/tasks', taskRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/departments', departmentRoutes);
router.use('/messages', messageRoutes);
router.use('/workspaces', workspaceRoutes);
router.use('/notifications', notificationRoutes);
router.use('/contracts', contractRoutes);
router.use('/calendar', calendarRoutes);
router.use('/roles', roleRoutes);

export default router;
