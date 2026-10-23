import { Router } from 'express';
import {
  getDepartments,
  getDepartmentTree,
  getDepartmentById,
  getDepartmentTasks,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from '../controllers/departmentController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(protect);

router.get('/', getDepartments);
router.get('/tree', getDepartmentTree);
router.get('/:id', getDepartmentById);
router.get('/:id/tasks', getDepartmentTasks);
router.post('/', authorize('admin', 'manager'), createDepartment);
router.put('/:id', authorize('admin', 'manager'), updateDepartment);
router.delete('/:id', authorize('admin'), deleteDepartment);

export default router;
