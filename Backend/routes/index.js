import express from 'express';
import authRoutes from './authRoutes.js';
import chatRoutes from './chatRoutes.js';
import userRoutes from './userRoutes.js';
import announcementRoutes from './announcementRoutes.js';
// import uploadRoutes from './uploadRoutes.js';
import { authenticateToken } from '../middlewares/auth.js';
import pollRoutes from './pollRoutes.js';
import tableRoutes from "./tableRoutes.js";
import vmMediaRoutes from './vmMediaRoutes.js';
import versionRoutes from './versionRoutes.js';
import notificationRoutes from './notificationRoutes.js';
const router = express.Router();

// Test route
router.get("/test", (req, res) => {
  const from = req.query.from;
  const ip = req.query.ip;
  console.log(`API Test Request From: ${from}, IP: ${ip}`);
  res.json({ message: "API is running" });
});


// Auth routes (no authentication needed)
router.use('/auth', authRoutes);

// Version routes (no authentication needed)
router.use('/version', versionRoutes);

// Protected routes - all below require authentication
router.use('/chat', chatRoutes);
router.use('/users', userRoutes);
router.use('/announcements', announcementRoutes);
// router.use('/media', uploadRoutes);
router.use('/poll', pollRoutes);
router.use('/table',tableRoutes);
router.use('/vm-media', vmMediaRoutes);
router.use('/notifications', notificationRoutes);
export default router; 