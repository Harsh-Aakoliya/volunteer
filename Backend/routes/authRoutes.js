import express from 'express';
import authController from '../controllers/authController.js';

const router = express.Router();

// Auth routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/check-user', authController.checkUser);

export default router; 