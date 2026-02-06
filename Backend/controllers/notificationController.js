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