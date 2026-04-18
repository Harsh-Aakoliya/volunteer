import express from 'express';
import authRoutes from './authRoutes.js';
import chatRoutes from './chatRoutes.js';
import userRoutes from './userRoutes.js';
// import uploadRoutes from './uploadRoutes.js';
import { authenticateToken } from '../middlewares/auth.js';
import pollRoutes from './pollRoutes.js';
import vmMediaRoutes from './vmMediaRoutes.js';
import versionRoutes from './versionRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import otaRoutes from './otaRoutes.js';
const router = express.Router();


// router.use(authenticateToken);
// Test route
// ${API_URL}/api/test components/auth/AppInfo.tsx -> testServer
router.get("/test", (req, res) => {
  const from = req.query.from;
  const ip = req.query.ip;
  console.log(`API Test Request From: ${from}, IP: ${ip}`);
  res.json({ message: "API is running" });
});

router.use('/auth', authRoutes);
router.use('/version', versionRoutes);
router.use('/chat', chatRoutes);
router.use('/users', userRoutes);
router.use('/poll', pollRoutes);
router.use('/vm-media', vmMediaRoutes);
router.use('/notifications', notificationRoutes);
router.use('/ota', otaRoutes);
export default router; 