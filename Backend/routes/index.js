import express from 'express';
import authRoutes from './authRoutes.js';
import chatRoutes from './chatRoutes.js';
import userRoutes from './userRoutes.js';
import announcementRoutes from './announcementRoutes.js';
import uploadRoutes from './uploadRoutes.js';
import { authenticateToken } from '../middlewares/auth.js';
import pollRoutes from './pollRoutes.js';
import tableRoutes from "./tableRoutes.js";
import departmentRoutes from './departmentRoutes.js';
import vmMediaRoutes from './vmMediaRoutes.js';
const router = express.Router();

// Test route
router.get('/test', (req, res) => {
  res.json({ message: "API is running" });
});

// Auth routes (no authentication needed)
router.use('/auth', authRoutes);

// Protected routes - all below require authentication
router.use('/chat', chatRoutes);
router.use('/users', userRoutes);
router.use('/announcements', announcementRoutes);
router.use('/media', uploadRoutes);
router.use('/poll', pollRoutes);
router.use('/table',tableRoutes);
router.use('/departments', departmentRoutes);
router.use('/vm-media', vmMediaRoutes);
export default router; 