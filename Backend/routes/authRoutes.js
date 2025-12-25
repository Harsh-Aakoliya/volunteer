import express from 'express';
import authController from '../controllers/authController.js';

const router = express.Router();

// Auth routes
router.post("/login", authController.login);
router.post("/check-mobile", authController.checkMobileExists);
router.post("/set-password", authController.setPassword);
router.post("/change-password", authController.changePassword);
router.post("/register", authController.register);
router.post("/check-user", authController.checkUser);
export default router; 