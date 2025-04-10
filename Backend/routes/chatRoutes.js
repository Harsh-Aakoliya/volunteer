// routes/chatRoutes.js
import express from 'express';
import chatController from '../controllers/chatController.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

// Middleware to ensure user is authenticated
router.use(authMiddleware);

// Get list of users for chat room creation
router.get('/users', chatController.getChatUsers);

// Create a new chat room
router.post('/rooms', chatController.createChatRoom);

// Get user's chat rooms
router.get('/rooms', chatController.getChatRooms);

export default router;