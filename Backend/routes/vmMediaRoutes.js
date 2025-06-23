import express from 'express';
import vmMediaController from '../controllers/vmMediaController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();



export default router;