// Backend/models/NotificationToken.js
import pool from "../config/database.js";

const createNotificationTokenTable = async () => {
  const client = await pool.connect();
  try {
    // Check if table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'notification_tokens'
      );
    `);
    
    
    if (tableCheck.rows[0].exists) {
      console.log("Notification tokens table already exists");
      return;
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS "notification_tokens" (
          "id" SERIAL PRIMARY KEY,
          "userId" VARCHAR(50) NOT NULL,
          "token" TEXT NOT NULL,
          "tokenType" VARCHAR(20) DEFAULT 'fcm',
          "deviceInfo" JSONB DEFAULT '{}',
          "isActive" BOOLEAN DEFAULT TRUE,
          "createdAt" TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'UTC'),
          "updatedAt" TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'UTC'),
          FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE,
          UNIQUE("userId", "tokenType")
      );
    `);
    console.log("Notification tokens table created successfully");
  } catch (error) {
    console.error("Error while creating notification tokens table:", error);
  } finally {
    client.release();
  }
};

const initNotificationTokenDB = async () => {
  await createNotificationTokenTable();
};

export default initNotificationTokenDB;
