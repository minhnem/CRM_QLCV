import { Router } from 'express';
import { protect, checkPermission } from '../middlewares/authMiddleware.js';
import { uploadAttachment } from '../middlewares/uploadMiddleware.js';
import {
  getContracts,
  getContractSummary,
  getContractById,
  createContract,
  updateContract,
  updateContractStage,
  updateMilestoneStatus,
  deleteContract,
  uploadContractAttachment,
} from '../controllers/contractController.js';

const router = Router();

// Toàn bộ route yêu cầu xác thực JWT
router.use(protect);

router.get('/', checkPermission('contracts', 'view'), getContracts);
router.get('/summary', checkPermission('contracts', 'view'), getContractSummary);
router.post('/upload', checkPermission('contracts', 'create'), uploadAttachment.single('file'), uploadContractAttachment);
router.get('/:id', checkPermission('contracts', 'view'), getContractById);
router.post('/', checkPermission('contracts', 'create'), createContract);
router.put('/:id', checkPermission('contracts', 'edit'), updateContract);
router.patch('/:id/stage', checkPermission('contracts', 'edit'), updateContractStage);
router.patch('/:id/milestones/:milestoneId', checkPermission('contracts', 'edit'), updateMilestoneStatus);
router.delete('/:id', checkPermission('contracts', 'delete'), deleteContract);

export default router;
