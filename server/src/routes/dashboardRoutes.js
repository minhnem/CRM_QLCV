import { Router } from 'express';
import { getDashboardOverview, getEmployeeStats } from '../controllers/dashboardController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(protect);

router.get('/overview', getDashboardOverview);
router.get('/employee-stats', getEmployeeStats);

export default router;
