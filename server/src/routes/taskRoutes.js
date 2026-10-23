import { Router } from 'express';
import {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  updateTaskStatus,
  submitTaskForReview,
  reviewTask,
  deleteTask,
} from '../controllers/taskController.js';
import { protect, checkPermission } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(protect);

router.get('/', checkPermission('tasks', 'view'), getTasks);
router.get('/:id', checkPermission('tasks', 'view'), getTaskById);
router.post('/', checkPermission('tasks', 'create'), createTask);
router.put('/:id', checkPermission('tasks', 'edit'), updateTask);
router.put('/:id/submit-review', checkPermission('tasks', 'edit'), submitTaskForReview);
router.put('/:id/review', checkPermission('tasks', 'edit'), reviewTask);
router.patch('/:id/status', checkPermission('tasks', 'edit'), updateTaskStatus);
router.delete('/:id', checkPermission('tasks', 'delete'), deleteTask);

export default router;
