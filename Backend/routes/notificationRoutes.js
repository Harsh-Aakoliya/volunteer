// Backend/routes/notificationRoutes.js
import express from 'express';
import { 
  storeNotificationToken,
  deleteNotificationToken,
  sendTestNotification
} from '../controllers/notificationController.js';
import { runAllTests } from '../test/chatNotificationTest.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Store notification token
router.post('/store-token', storeNotificationToken);

// Delete notification token (on logout)
router.post('/delete-token', deleteNotificationToken);

// Send test notification
router.post('/test', sendTestNotification);

// Test chat notification system (for development)
router.get('/test-chat-system', async (req, res) => {
  try {
    console.log('🧪 Running chat notification system tests...');
    await runAllTests();
    res.json({ 
      success: true, 
      message: 'Chat notification system tests completed. Check server logs for details.' 
    });
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;
