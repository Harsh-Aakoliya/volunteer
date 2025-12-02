// Backend/controllers/notificationController.js
import pool from "../config/database.js";
import { admin, isFirebaseInitialized } from "../config/firebase.js";

// Store notification token
export const storeNotificationToken = async (req, res) => {
  try {
    const { userId, token, tokenType = 'fcm', deviceInfo = {} } = req.body;
    console.log("storeNotificationToken",req.body);
    console.log("storeNotificationToken",userId,token,tokenType,deviceInfo);
    if (!userId || !token) {
      return res.status(400).json({ error: 'UserId and token are required' });
    }

    // Check if token already exists for this user
    const existingToken = await pool.query(
      'SELECT * FROM "notification_tokens" WHERE "userId" = $1 AND "tokenType" = $2',
      [userId, tokenType]
    );

    if (existingToken.rows.length > 0) {
      // Update existing token
      const result = await pool.query(
        'UPDATE "notification_tokens" SET "token" = $1, "deviceInfo" = $2, "isActive" = TRUE, "updatedAt" = NOW() AT TIME ZONE \'Asia/Kolkata\' WHERE "userId" = $3 AND "tokenType" = $4 RETURNING *',
        [token, deviceInfo, userId, tokenType]
      );
      res.json({ success: true, message: 'Token updated successfully', data: result.rows[0] });
    } else {
      // Insert new token
      const result = await pool.query(
        'INSERT INTO "notification_tokens" ("userId", "token", "tokenType", "deviceInfo") VALUES ($1, $2, $3, $4) RETURNING *',
        [userId, token, tokenType, deviceInfo]
      );
      res.json({ success: true, message: 'Token stored successfully', data: result.rows[0] });
    }
  } catch (error) {
    console.error('Error storing notification token:', error);
    res.status(500).json({ error: 'Failed to store notification token' });
  }
};

// Delete notification token (on logout)
export const deleteNotificationToken = async (req, res) => {
  try {
    const { userId, tokenType = 'fcm' } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'UserId is required' });
    }

    const result = await pool.query(
      'UPDATE "notification_tokens" SET "isActive" = FALSE, "updatedAt" = NOW() AT TIME ZONE \'Asia/Kolkata\' WHERE "userId" = $1 AND "tokenType" = $2 RETURNING *',
      [userId, tokenType]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Token not found' });
    }

    res.json({ success: true, message: 'Token deactivated successfully' });
  } catch (error) {
    console.error('Error deleting notification token:', error);
    res.status(500).json({ error: 'Failed to delete notification token' });
  }
};

// Get user tokens
export const getUserTokens = async (userId, tokenType = 'fcm') => {
  try {
    const result = await pool.query(
      'SELECT "token" FROM "notification_tokens" WHERE "userId" = $1 AND "tokenType" = $2 AND "isActive" = TRUE',
      [userId, tokenType]
    );
    return result.rows.map(row => row.token);
  } catch (error) {
    console.error('Error getting user tokens:', error);
    return [];
  }
};

// Get tokens for multiple users
export const getTokensForUsers = async (userIds, tokenType = 'fcm') => {
  try {
    if (!userIds || userIds.length === 0) return [];
    
    const result = await pool.query(
      'SELECT "userId", "token" FROM "notification_tokens" WHERE "userId" = ANY($1) AND "tokenType" = $2 AND "isActive" = TRUE',
      [userIds, tokenType]
    );
    
    return result.rows;
  } catch (error) {
    console.error('Error getting tokens for users:', error);
    return [];
  }
};

// Send notification to specific users
export const sendNotificationToUsers = async (userIds, title, body, data = {}) => {
  try {
    const tokenData = await getTokensForUsers(userIds);
    
    if (tokenData.length === 0) {
      console.log('No active tokens found for users:', userIds);
      return { success: true, sentCount: 0 };
    }

    let sentCount = 0;
    const responses = [];

    // Send FCM notifications
    for (const { token } of tokenData) {
      try {
        if (!isFirebaseInitialized()) {
          console.log('Firebase Admin not initialized, skipping FCM notification');
          continue;
        }

        const message = {
          token,
          notification: {
            title: title,
            body: body,
          },
          data: {
            ...data,
            // Convert all data values to strings as FCM requires
            ...Object.fromEntries(
              Object.entries(data).map(([key, value]) => [key, String(value)])
            ),
          },
          android: {
            notification: {
              sound: 'default',
              clickAction: 'FLUTTER_NOTIFICATION_CLICK',
            },
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
              },
            },
          },
        };

        const response = await admin.messaging().send(message);
        responses.push({ token, response });
        sentCount++;
        console.log('Successfully sent FCM message:', response);
      } catch (error) {
        console.error('Error sending FCM message to token:', token, error.message);
        responses.push({ token, error: error.message });
      }
    }

    return { success: true, sentCount, responses };
  } catch (error) {
    console.error('Error sending notifications:', error);
    return { success: false, error: error.message };
  }
};