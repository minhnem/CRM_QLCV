import { Router } from 'express';
import {
  createWorkspace,
  getMyWorkspaces,
  getWorkspaceById,
  joinByCode,
  handleJoinRequest,
  inviteByEmail,
  getInviteByToken,
  resendInvite,
  cancelInvite,
  acceptInvite,
  switchWorkspace,
  updateWorkspace,
  removeMember,
} from '../controllers/workspaceController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();

// Route công khai: Lấy thông tin lời mời theo token (người nhận click từ Gmail)
router.get('/invite/:token', getInviteByToken);

// Tất cả các route bên dưới đều yêu cầu đăng nhập (Private)
router.use(protect);

router.post('/', createWorkspace);
router.get('/my', getMyWorkspaces);
router.post('/join-by-code', joinByCode);
router.post('/accept-invite', acceptInvite);

router.get('/:id', getWorkspaceById);
router.put('/:id', updateWorkspace);
router.post('/:id/switch', switchWorkspace);
router.post('/:id/requests/:requestId', handleJoinRequest);
router.post('/:id/invites', inviteByEmail);
router.post('/:id/invites/:inviteId/resend', resendInvite);
router.delete('/:id/invites/:inviteId', cancelInvite);
router.delete('/:id/members/:targetUserId', removeMember);

export default router;
