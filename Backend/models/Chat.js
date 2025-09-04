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
          "createdOn" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
          "joinedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          "messageType" "messageType" NOT NULL DEFAULT 'text',
          "pollId" INTEGER,
          "mediaFilesId" INTEGER,
          "tableId" INTEGER,
          "isEdited" BOOLEAN DEFAULT FALSE,
          "editedAt" TIMESTAMP WITH TIME ZONE,
          "editedBy" VARCHAR(50)
      );
    `);
    console.log("Chatmessages table created successfully");
  } catch (error) {
    console.error("Error while creating chatmessages table:", error);
    throw error;
  }
};

const addEditColumnsIfNotExists = async (client) => {
  try {
    // Check if isEdited column exists
    const isEditedCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'chatmessages' AND column_name = 'isEdited'
    `);
    
    if (isEditedCheck.rows.length === 0) {
      console.log("Adding edit-related columns to chatmessages table...");
      
      await client.query(`
        ALTER TABLE chatmessages 
        ADD COLUMN "isEdited" BOOLEAN DEFAULT FALSE,
        ADD COLUMN "editedAt" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN "editedBy" VARCHAR(50)
      `);
      
      console.log("Edit-related columns added successfully");
    } else {
      console.log("Edit-related columns already exist in chatmessages table");
    }
  } catch (error) {
    console.error("Error adding edit columns:", error);
    throw error;
  }
};

const addReplyColumnIfNotExists = async (client) => {
  try {
    // Check if replyMessageId column exists
    const replyCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'chatmessages' AND column_name = 'replyMessageId'
    `);
    
    if (replyCheck.rows.length === 0) {
      console.log("Adding reply column to chatmessages table...");
      
      await client.query(`
        ALTER TABLE chatmessages 
        ADD COLUMN "replyMessageId" INTEGER
      `);
      
      console.log("Reply column added successfully");
    } else {
      console.log("Reply column already exists in chatmessages table");
    }
  } catch (error) {
    console.error("Error adding reply column:", error);
    throw error;
  }
};

const initChatDB = async () => {
  const client = await pool.connect();
  try {
    // Create tables in sequence due to dependencies
    await createChatRoomsTable(client);
    await createChatRoomUsersTable(client);
    await createChatMessagesTable(client);
    
    // Add edit columns to existing tables
    await addEditColumnsIfNotExists(client);
    
    // Add reply column to existing tables
    await addReplyColumnIfNotExists(client);
    
    console.log("All chat-related tables initialization completed");
  } catch (error) {
    console.error("Error during chat database initialization:", error);
  } finally {
    client.release();
  }
};

export default initChatDB;