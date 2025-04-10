// models/Chat.js
import pool from "../config/datebase.js";
const initChatDB = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      -- Chat Rooms Table
      CREATE TABLE IF NOT EXISTS chat_rooms (
        id SERIAL PRIMARY KEY,
        room_name VARCHAR(255) NOT NULL,
        room_description TEXT,
        created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_group BOOLEAN DEFAULT FALSE,
        created_by INTEGER REFERENCES users(id)
      );

      -- Chat Room Users Table (manages room membership and permissions)
      CREATE TABLE IF NOT EXISTS chat_room_users (
        id SERIAL PRIMARY KEY,
        room_id INTEGER REFERENCES chat_rooms(id),
        user_id INTEGER REFERENCES users(id),
        is_admin BOOLEAN DEFAULT FALSE,
        can_send_message BOOLEAN DEFAULT TRUE,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(room_id, user_id)
      );

      -- Chat Messages Table
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        room_id INTEGER REFERENCES chat_rooms(id),
        sender_id INTEGER REFERENCES users(id),
        message_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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