// models/Chat.js
import pool from "../config/datebase.js";

const initChatDB = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      -- Chat Rooms Table
      CREATE TABLE IF NOT EXISTS chatrooms (
        "roomId" SERIAL PRIMARY KEY,
        "roomName" VARCHAR(255) NOT NULL,
        "roomDescription" TEXT,
        "createdOn" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "isGroup" BOOLEAN DEFAULT FALSE,
        "createdBy" VARCHAR(50) REFERENCES "users"("userId")
      );

      -- Chat Room Users Table (manages room membership and permissions)
      CREATE TABLE IF NOT EXISTS chatroomusers (
        "id" SERIAL PRIMARY KEY,
        "roomId" INTEGER REFERENCES chatrooms("roomId"),
        "userId" VARCHAR(50) REFERENCES users("userId"),
        "isAdmin" BOOLEAN DEFAULT FALSE,
        "canSendMessage" BOOLEAN DEFAULT TRUE,
        "joinedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE("roomId", "userId")
      );

      -- Chat Messages Table
      CREATE TABLE IF NOT EXISTS chatmessages (
        "id" SERIAL PRIMARY KEY,
        "roomId" INTEGER REFERENCES chatrooms("roomId"),
        "senderId" VARCHAR(50) REFERENCES users("userId"),
        "messageText" TEXT NOT NULL,
        "mediaFiles" JSON,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        FOREIGN KEY ("roomId") REFERENCES chatrooms("roomId") ON DELETE CASCADE,
        FOREIGN KEY ("senderId") REFERENCES users("userId") ON DELETE CASCADE
      );
    `);

    console.log("Chat-related tables created successfully");
  } catch (error) {
    console.error("Error creating chat-related tables:", error);
  } finally {
    client.release();
  }
};

export default initChatDB;