// models/Chat.js
import pool from "../config/database.js";

const createChatRoomsTable = async (client) => {
  try {
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'chatrooms'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log("Chatrooms table already exists");
      return;
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS chatrooms (
          "roomId" SERIAL PRIMARY KEY,
          "roomName" VARCHAR(255) NOT NULL,
          "roomDescription" TEXT,
          "createdOn" TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'UTC'),
          "isGroup" BOOLEAN DEFAULT FALSE,
          "createdBy" VARCHAR(50)
      );
    `);
    console.log("Chatrooms table created successfully");
  } catch (error) {
    console.error("Error while creating chatrooms table:", error);
    throw error; // Propagate error to main function
  }
};

const createChatRoomUsersTable = async (client) => {
  try {
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'chatroomusers'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log("Chatroomusers table already exists");
      return;
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS chatroomusers (
          "id" SERIAL PRIMARY KEY,
          "roomId" INTEGER,
          "userId" VARCHAR(50),
          "isAdmin" BOOLEAN DEFAULT FALSE,
          "canSendMessage" BOOLEAN DEFAULT TRUE,
          "joinedAt" TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'UTC')
      );
    `);
    console.log("Chatroomusers table created successfully");
  } catch (error) {
    console.error("Error while creating chatroomusers table:", error);
    throw error;
  }
};

const createChatMessagesTable = async (client) => {
  try {
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'chatmessages'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log("Chatmessages table already exists");
      return;
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS chatmessages (
          "id" SERIAL PRIMARY KEY,
          "roomId" INTEGER,
          "senderId" VARCHAR(50),
          "messageText" TEXT NOT NULL,
          "createdAt" TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'UTC'),
          "messageType" "messageType" NOT NULL DEFAULT 'text',
          "pollId" INTEGER,
          "mediaFilesId" INTEGER,
          "tableId" INTEGER,
          "isEdited" BOOLEAN DEFAULT FALSE,
          "editedAt" TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'UTC'),
          "editedBy" VARCHAR(50),
          "replyMessageId" INTEGER,
          "isScheduled" BOOLEAN DEFAULT FALSE
      );
    `);
    console.log("Chatmessages table created successfully");
  } catch (error) {
    console.error("Error while creating chatmessages table:", error);
    throw error;
  }
};

const createMessageReadStatusTable = async (client) => {
  try {
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'messagereadstatus'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log("Messagereadstatus table already exists");
      return;
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS messagereadstatus (
          "id" SERIAL PRIMARY KEY,
          "messageId" INTEGER NOT NULL,
          "userId" VARCHAR(50) NOT NULL,
          "readAt" TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'UTC'),
          "roomId" INTEGER NOT NULL,
          UNIQUE("messageId", "userId"),
          FOREIGN KEY ("messageId") REFERENCES chatmessages("id") ON DELETE CASCADE,
          FOREIGN KEY ("roomId") REFERENCES chatrooms("roomId") ON DELETE CASCADE
      );
    `);
    console.log("Messagereadstatus table created successfully");
  } catch (error) {
    console.error("Error while creating messagereadstatus table:", error);
    throw error;
  }
};

const createMessageTypeTable = async (client) => {
  try {
    const tableCheck = await client.query(`
      SELECT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'messageType'
      );

    `);
    if (tableCheck) {
      console.log("MessageType table already exists");
      return;
    }

    await client.query(`
      create type "messageType" as enum('text', 'media', 'poll', 'table');  
    `);
    console.log("MessageType table created successfully");
  } catch (error) {
    console.error("Error while creating messageType table:", error);
    throw error;
  }
};

const initChatDB = async () => {
  const client = await pool.connect();
  try {
    // Create tables in sequence due to dependencies
    await createMessageTypeTable(client);
    await createChatRoomsTable(client);
    await createChatRoomUsersTable(client);
    await createChatMessagesTable(client);
    await createMessageReadStatusTable(client);
    
    console.log("All chat-related tables initialization completed");
  } catch (error) {
    console.error("Error during chat database initialization:", error);
  } finally {
    client.release();
  }
};

export default initChatDB;