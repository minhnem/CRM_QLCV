import { Router } from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import {
  getCalendarTasks,
  getCalendarContracts,
} from '../controllers/calendarController.js';

const router = Router();

// Yêu cầu xác thực JWT
router.use(protect);

// 1. Lịch công việc dự án (Lựa chọn 1)
router.get('/tasks', getCalendarTasks);

// 2. Lịch hợp đồng theo ngày bắt đầu và kết thúc (Lựa chọn 2 - phục vụ phân quyền sau này)
router.get('/contracts', getCalendarContracts);

export default router;
