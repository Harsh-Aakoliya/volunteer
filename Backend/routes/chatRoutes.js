// routes/chatRoutes.js
import express from 'express';
import chatController from '../controllers/chatController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// Existing routes
router.get('/users', authenticateToken, chatController.getChatUsers);
router.post('/rooms', authenticateToken, chatController.createChatRoom);
router.get('/rooms', authenticateToken, chatController.getChatRooms);
router.get('/rooms/:roomId', authenticateToken, chatController.getChatRoomDetails);

// New routes for room settings
router.put('/rooms/:roomId', authenticateToken, chatController.updateChatRoom);
router.post('/rooms/:roomId/members', authenticateToken, chatController.addRoomMembers);
router.put('/rooms/:roomId/members/:memberId', authenticateToken, chatController.updateRoomMember);
router.delete('/rooms/:roomId/members/:memberId', authenticateToken, chatController.removeRoomMember);
router.delete('/rooms/:roomId', authenticateToken, chatController.deleteChatRoom);
router.put('/rooms/:roomId/settings', authenticateToken, chatController.updateRoomSettings);
// routes/chatRoutes.js - Add the new route

// Existing routes
router.get('/rooms', authenticateToken, chatController.getChatRooms);
router.get('/rooms/:roomId', authenticateToken, chatController.getChatRoomDetails);
router.post('/rooms/:roomId/messages', authenticateToken, chatController.sendMessage);

// New route for online users
router.get('/rooms/:roomId/online-users', authenticateToken, chatController.getRoomOnlineUsers);
export default router;