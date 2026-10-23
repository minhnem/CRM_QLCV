import { Router } from 'express';
import { getUsers, getUserById, updateUserRole } from '../controllers/userController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(protect);

router.get('/', getUsers);
router.get('/:id', getUserById);
router.patch('/:id/role', authorize('admin'), updateUserRole);

export default router;
