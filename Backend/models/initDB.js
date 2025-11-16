// models/initDB.js
// Single initialization function that creates all tables in the correct order
import pool from "../config/database.js";

const initDB = async () => {
  const client = await pool.connect();
  try {
    console.log("🚀 Starting database initialization...");

    // 1. Create Users table (base table, no dependencies)
    await createUsersTable(client);

    // 2. Create MessageType enum (type definition, no dependencies)
    await createMessageTypeEnum(client);

    // 3. Create Chatrooms table (no foreign keys initially)
    await createChatRoomsTable(client);

    // 4. Create Poll table (referenced by chatmessages)
    await createPollTable(client);

    // 5. Create Media table (referenced by chatmessages)
    await createMediaTable(client);

    // 6. Create Table table (referenced by chatmessages)
    await createTableTable(client);

    // 7. Create Chatroomusers table (depends on: chatrooms, users)
    await createChatRoomUsersTable(client);

    // 8. Create Chatmessages table (depends on: messageType, chatrooms, users, poll, media, table)
    await createChatMessagesTable(client);

    // 9. Create Messagereadstatus table (depends on: chatmessages, chatrooms)
    await createMessageReadStatusTable(client);

    // 10. Create Notification_tokens table (depends on: users)
    await createNotificationTokenTable(client);

    // 11. Create Announcements table (depends on: chatrooms, users)
    await createAnnouncementsTable(client);

    // 12. Add foreign key constraints after all tables are created
    await addForeignKeyConstraints(client);

    console.log("✅ All database tables initialized successfully");
  } catch (error) {
    console.error("❌ Error during database initialization:", error);
    throw error;
  } finally {
    client.release();
  }
};

// Helper function to check if table exists
const tableExists = async (client, tableName) => {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = $1
    );
  `, [tableName]);
  return result.rows[0].exists;
};

// Helper function to check if enum type exists
const enumExists = async (client, enumName) => {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM pg_type
      WHERE typname = $1
    );
  `, [enumName]);
  return result.rows.length > 0 && result.rows[0].exists;
};

// 1. Create Users table
const createUsersTable = async (client) => {
  try {
    const exists = await tableExists(client, 'users');
    if (exists) {
      console.log("✅ Users table already exists");
      return;
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
          user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          mobile_number VARCHAR(15) UNIQUE NOT NULL,
          email VARCHAR(100),
          full_name VARCHAR(100) NOT NULL,
          password VARCHAR(255) NOT NULL,
          role VARCHAR(10) NOT NULL CHECK (role IN ('master', 'admin', 'sevak')),
          -- Profile Information
          gender VARCHAR(20),
          date_of_birth DATE,
          blood_group VARCHAR(10),
          education VARCHAR(100),
          -- Contact Information
          whatsapp_number VARCHAR(15),
          emergency_contact VARCHAR(15),
          address TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Users table created successfully");
  } catch (error) {
    console.error("❌ Error while creating users table:", error);
    throw error;
  }
};

// 2. Create MessageType enum
const createMessageTypeEnum = async (client) => {
  try {
    const exists = await enumExists(client, 'messageType');
    if (exists) {
      console.log("✅ MessageType enum already exists");
      return;
    }

    await client.query(`
      CREATE TYPE "messageType" AS ENUM('text', 'media', 'poll', 'table', 'announcement', 'system');
    `);
    console.log("✅ MessageType enum created successfully");
  } catch (error) {
    console.error("❌ Error while creating messageType enum:", error);
    throw error;
  }
};

// 3. Create Chatrooms table
const createChatRoomsTable = async (client) => {
  try {
    const exists = await tableExists(client, 'chatrooms');
    if (exists) {
      console.log("✅ Chatrooms table already exists");
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
    console.log("✅ Chatrooms table created successfully");
  } catch (error) {
    console.error("❌ Error while creating chatrooms table:", error);
    throw error;
  }
};

// 4. Create Poll table
const createPollTable = async (client) => {
  try {
    const exists = await tableExists(client, 'poll');
    if (exists) {
      console.log("✅ Poll table already exists");
      return;
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS poll (
          "id" SERIAL PRIMARY KEY,
          "question" TEXT NOT NULL,
          "options" JSONB NOT NULL,
          "votes" JSONB,
          "roomId" INTEGER,
          "isActive" BOOLEAN DEFAULT TRUE,
          "pollEndTime" TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'UTC'),
          "isMultipleChoiceAllowed" BOOLEAN DEFAULT FALSE,
          "createdBy" VARCHAR(50),
          "createdAt" TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'UTC')
      );
    `);
    console.log("✅ Poll table created successfully");
  } catch (error) {
    console.error("❌ Error while creating poll table:", error);
    throw error;
  }
};

// 5. Create Media table
const createMediaTable = async (client) => {
  try {
    const exists = await tableExists(client, 'media');
    if (exists) {
      console.log("✅ Media table already exists");
      return;
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS media (
          "id" SERIAL PRIMARY KEY,
          "roomId" INTEGER,
          "senderId" VARCHAR(50),
          "createdAt" TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'UTC'),
          "caption" VARCHAR(255),
          "messageId" INTEGER,
          "driveUrlObject" JSONB DEFAULT '[]'
      );
    `);
    console.log("✅ Media table created successfully");
  } catch (error) {
    console.error("❌ Error while creating media table:", error);
    throw error;
  }
};

// 6. Create Table table
const createTableTable = async (client) => {
  try {
    const exists = await tableExists(client, 'table');
    if (exists) {
      console.log("✅ Table table already exists");
      return;
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS "table" (
          "id" SERIAL PRIMARY KEY,
          "roomId" INTEGER,
          "senderId" VARCHAR(50),
          "createdAt" TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'UTC'),
          "tableTitle" VARCHAR(255),
          "messageId" INTEGER,
          "tableData" JSONB,
          "tableHeaders" JSONB DEFAULT '["Sr No", "Column1", "Column2", "Column3"]'
      );
    `);
    console.log("✅ Table table created successfully");
  } catch (error) {
    console.error("❌ Error while creating Table table:", error);
    throw error;
  }
};

// 7. Create Chatroomusers table
const createChatRoomUsersTable = async (client) => {
  try {
    const exists = await tableExists(client, 'chatroomusers');
    if (exists) {
      console.log("✅ Chatroomusers table already exists");
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
    console.log("✅ Chatroomusers table created successfully");
  } catch (error) {
    console.error("❌ Error while creating chatroomusers table:", error);
    throw error;
  }
};

// 8. Create Chatmessages table
const createChatMessagesTable = async (client) => {
  try {
    const exists = await tableExists(client, 'chatmessages');
    if (exists) {
      console.log("✅ Chatmessages table already exists");
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
    console.log("✅ Chatmessages table created successfully");
  } catch (error) {
    console.error("❌ Error while creating chatmessages table:", error);
    throw error;
  }
};

// 9. Create Messagereadstatus table
const createMessageReadStatusTable = async (client) => {
  try {
    const exists = await tableExists(client, 'messagereadstatus');
    if (exists) {
      console.log("✅ Messagereadstatus table already exists");
      return;
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS messagereadstatus (
          "id" SERIAL PRIMARY KEY,
          "messageId" INTEGER NOT NULL,
          "userId" VARCHAR(50) NOT NULL,
          "readAt" TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'UTC'),
          "roomId" INTEGER NOT NULL,
          UNIQUE("messageId", "userId")
      );
    `);
    console.log("✅ Messagereadstatus table created successfully");
  } catch (error) {
    console.error("❌ Error while creating messagereadstatus table:", error);
    throw error;
  }
};

// 10. Create Notification_tokens table
const createNotificationTokenTable = async (client) => {
  try {
    const exists = await tableExists(client, 'notification_tokens');
    if (exists) {
      console.log("✅ Notification_tokens table already exists");
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
          UNIQUE("userId", "tokenType")
      );
    `);
    console.log("✅ Notification_tokens table created successfully");
  } catch (error) {
    console.error("❌ Error while creating notification_tokens table:", error);
    throw error;
  }
};

// 11. Create Announcements table
const createAnnouncementsTable = async (client) => {
  try {
    const exists = await tableExists(client, 'announcements');
    if (exists) {
      console.log("✅ Announcements table already exists");
      return;
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS "announcements" (
          "announcement_id" SERIAL PRIMARY KEY,
          "room_id" INTEGER NOT NULL,
          "title" VARCHAR(255) NOT NULL,
          "body" TEXT NOT NULL,
          "author_id" VARCHAR(50) NOT NULL,
          "created_at" TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'UTC'),
          "updated_at" TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'UTC'),
          "updated_by" VARCHAR(50),
          "liked_by" JSONB DEFAULT '[]',
          "read_by" JSONB DEFAULT '[]'
      );
    `);
    console.log("✅ Announcements table created successfully");
  } catch (error) {
    console.error("❌ Error while creating announcements table:", error);
    throw error;
  }
};

// 12. Add foreign key constraints
const addForeignKeyConstraints = async (client) => {
  try {
    console.log("🔗 Adding foreign key constraints...");

    // Helper function to check if constraint exists
    const constraintExists = async (tableName, constraintName) => {
      const result = await client.query(`
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE table_name = $1 
        AND constraint_name = $2
      `, [tableName, constraintName]);
      return result.rows.length > 0;
    };

    // Helper function to safely add constraint
    const safeAddConstraint = async (tableName, constraintName, constraintSQL) => {
      const exists = await constraintExists(tableName, constraintName);
      if (!exists) {
        await client.query(constraintSQL);
        console.log(`  ✅ Added constraint ${constraintName} to ${tableName}`);
      } else {
        console.log(`  ⏭️  Constraint ${constraintName} already exists on ${tableName}`);
      }
    };

    // Chatroomusers foreign keys
    await safeAddConstraint(
      'chatroomusers',
      'fk_chatroomusers_rooms',
      `ALTER TABLE chatroomusers 
       ADD CONSTRAINT fk_chatroomusers_rooms 
       FOREIGN KEY ("roomId") REFERENCES chatrooms("roomId") ON DELETE CASCADE`
    );

    // Note: We're not adding FK for userId in chatroomusers since it references user_id (UUID) 
    // but userId in chatroomusers is VARCHAR(50). This is handled at application level.

    // Unique constraint for chatroomusers
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 
          FROM information_schema.table_constraints 
          WHERE table_name = 'chatroomusers' 
          AND constraint_name = 'unique_room_user'
        ) THEN
          ALTER TABLE chatroomusers 
          ADD CONSTRAINT unique_room_user UNIQUE("roomId", "userId");
        END IF;
      END $$;
    `);
    console.log("  ✅ Added unique constraint unique_room_user to chatroomusers");

    // Chatmessages foreign keys
    await safeAddConstraint(
      'chatmessages',
      'fk_chatmessages_rooms',
      `ALTER TABLE chatmessages 
       ADD CONSTRAINT fk_chatmessages_rooms 
       FOREIGN KEY ("roomId") REFERENCES chatrooms("roomId") ON DELETE CASCADE`
    );

    // Note: senderId and editedBy in chatmessages reference user_id (UUID) 
    // but are stored as VARCHAR(50). Handled at application level.

    await safeAddConstraint(
      'chatmessages',
      'fk_chatmessages_poll',
      `ALTER TABLE chatmessages 
       ADD CONSTRAINT fk_chatmessages_poll 
       FOREIGN KEY ("pollId") REFERENCES poll("id") ON DELETE SET NULL`
    );

    await safeAddConstraint(
      'chatmessages',
      'fk_chatmessages_media',
      `ALTER TABLE chatmessages 
       ADD CONSTRAINT fk_chatmessages_media 
       FOREIGN KEY ("mediaFilesId") REFERENCES media("id") ON DELETE SET NULL`
    );

    await safeAddConstraint(
      'chatmessages',
      'fk_chatmessages_table',
      `ALTER TABLE chatmessages 
       ADD CONSTRAINT fk_chatmessages_table 
       FOREIGN KEY ("tableId") REFERENCES "table"("id") ON DELETE SET NULL`
    );

    await safeAddConstraint(
      'chatmessages',
      'fk_chatmessages_reply',
      `ALTER TABLE chatmessages 
       ADD CONSTRAINT fk_chatmessages_reply 
       FOREIGN KEY ("replyMessageId") REFERENCES chatmessages("id") ON DELETE SET NULL`
    );

    // Messagereadstatus foreign keys
    await safeAddConstraint(
      'messagereadstatus',
      'fk_messagereadstatus_message',
      `ALTER TABLE messagereadstatus 
       ADD CONSTRAINT fk_messagereadstatus_message 
       FOREIGN KEY ("messageId") REFERENCES chatmessages("id") ON DELETE CASCADE`
    );

    await safeAddConstraint(
      'messagereadstatus',
      'fk_messagereadstatus_room',
      `ALTER TABLE messagereadstatus 
       ADD CONSTRAINT fk_messagereadstatus_room 
       FOREIGN KEY ("roomId") REFERENCES chatrooms("roomId") ON DELETE CASCADE`
    );

    // Note: userId in messagereadstatus references user_id (UUID) 
    // but is stored as VARCHAR(50). Handled at application level.

    // Notification_tokens foreign key
    // Note: userId in notification_tokens references user_id (UUID) 
    // but is stored as VARCHAR(50). Handled at application level.

    // Announcements foreign keys
    await safeAddConstraint(
      'announcements',
      'fk_announcements_room',
      `ALTER TABLE announcements 
       ADD CONSTRAINT fk_announcements_room 
       FOREIGN KEY ("room_id") REFERENCES chatrooms("roomId") ON DELETE CASCADE`
    );

    // Note: author_id and updated_by in announcements reference user_id (UUID) 
    // but are stored as VARCHAR(50). Handled at application level.

    console.log("✅ All foreign key constraints added successfully");
  } catch (error) {
    console.error("❌ Error adding foreign key constraints:", error);
    throw error;
  }
};

export default initDB;

