import express from 'express';
import userController from '../controllers/userController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// User profile routes
router.get('/:userId/profile', userController.getUserProfile);//${API_URL}/api/users/${storedUser.seid}/profile api/user.ts -> fetchUserProfile

export default router; 