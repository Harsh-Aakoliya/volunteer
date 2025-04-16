// routes/chatRoutes.js
import express from 'express';
import chatController from '../controllers/chatController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// Chat routes
router.get('/users', authenticateToken, chatController.getChatUsers);
router.post('/rooms', authenticateToken, chatController.createChatRoom);
router.get('/rooms', authenticateToken, chatController.getChatRooms);

export default router;