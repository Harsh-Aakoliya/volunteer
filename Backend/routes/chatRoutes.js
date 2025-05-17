// routes/chatRoutes.js
import express from 'express';
import chatController from '../controllers/chatController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Chat users and rooms
router.get('/users', chatController.getChatUsers);
router.get('/rooms', chatController.getChatRooms);
router.post('/rooms', chatController.createChatRoom);

// Room details
router.get('/rooms/:roomId', chatController.getChatRoomDetails);
router.put('/rooms/:roomId', chatController.updateChatRoom);
router.delete('/rooms/:roomId', chatController.deleteChatRoom);

// Room settings
router.put('/rooms/:roomId/settings', chatController.updateRoomSettings);

// Room members
router.post('/rooms/:roomId/members', chatController.addRoomMembers);
router.put('/rooms/:roomId/members/:memberId', chatController.updateRoomMember);
router.delete('/rooms/:roomId/members/:memberId', chatController.removeRoomMember);

// Room messages
router.post('/rooms/:roomId/messages', chatController.sendMessage);

// Room online users
router.get('/rooms/:roomId/online-users', chatController.getRoomOnlineUsers);

export default router;