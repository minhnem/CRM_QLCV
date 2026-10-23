import { Router } from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { uploadAttachment } from '../middlewares/uploadMiddleware.js';
import {
  getChannels,
  getChannelMessages,
  sendMessage,
  uploadMessageAttachment,
} from '../controllers/messageController.js';

const router = Router();

// Toàn bộ route yêu cầu xác thực JWT
router.use(protect);

router.get('/channels', getChannels);
router.post('/upload', uploadAttachment.single('file'), uploadMessageAttachment);
router.get('/:channelType/:channelId', getChannelMessages);
router.post('/:channelType/:channelId', sendMessage);

export default router;
