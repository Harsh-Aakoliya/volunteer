// Backend/routes/notificationRoutes.js
import express from 'express';
import { 
  storeNotificationToken,
  deleteNotificationToken,
} from '../controllers/notificationController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Store notification token
router.post('/store-token', storeNotificationToken); //api/auth.ts -> generateAndStoreNotificationToken, // api/notification.ts -> storeNotificationToken

// Delete notification token (on logout)
router.post('/delete-token', deleteNotificationToken); //api/auth.ts -> removeNotificationToken, // api/notification.ts -> deleteNotificationToken

export default router;
