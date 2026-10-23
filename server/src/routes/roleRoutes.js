import { Router } from 'express';
import {
  getRoles,
  getMyPermissions,
  createRole,
  updateRole,
  deleteRole,
  resetRolesToDefault,
} from '../controllers/roleController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(protect);

router.get('/', getRoles);
router.get('/my-permissions', getMyPermissions);
router.post('/', authorize('admin'), createRole);
router.put('/:id', authorize('admin'), updateRole);
router.delete('/:id', authorize('admin'), deleteRole);
router.post('/reset-defaults', authorize('admin'), resetRolesToDefault);

export default router;
