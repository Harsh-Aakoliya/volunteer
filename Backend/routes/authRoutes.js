import express from 'express';
import authController from '../controllers/authController.js';

const router = express.Router();

// Auth routes
router.post("/login", authController.login);// api/auth.ts -> login
router.post("/check-mobile", authController.checkMobileExists);
router.post("/set-password", authController.setPassword);// api/auth.ts -> setPassword
router.post("/change-password", authController.changePassword);// api/auth.ts -> changePassword
export default router; 