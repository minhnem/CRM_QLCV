import { Router } from 'express';
import {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
} from '../controllers/projectController.js';
import { protect, checkPermission } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(protect);

router.get('/', checkPermission('projects', 'view'), getProjects);
router.get('/:id', checkPermission('projects', 'view'), getProjectById);
router.post('/', checkPermission('projects', 'create'), createProject);
router.put('/:id', checkPermission('projects', 'edit'), updateProject);
router.delete('/:id', checkPermission('projects', 'delete'), deleteProject);

export default router;
