// models/initDB.js
// Initialize DB schema by executing .sql files in this folder (idempotent)
import pool from "../config/database.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to read and run a .sql file (which already uses CREATE TABLE IF NOT EXISTS, etc.)
const runSqlFile = async (client, fileName) => {
  const filePath = path.join(__dirname, fileName);
  const sql = await fs.readFile(filePath, "utf8");
  console.log(`📄 [initDB] Running schema file: ${fileName}`);
  await client.query(sql);
};

const initDB = async () => {
  const client = await pool.connect();
  try {
    console.log("🚀 Starting database initialization using .sql models...");

    // 1. Ensure messageType enum exists (SQL files reference it)
    await createMessageTypeEnum(client);

    // 2. Run schema files in dependency-safe order
    const schemaFiles = [
      // Base master tables
      "SevakMaster.sql",
      "DepartmentMaster.sql",

      // Core chat tables
      "chatrooms.sql",
      "chatroomusers.sql",
      "poll.sql",
      "media.sql",
      // If you have a table.sql for the \"table\" feature, add it here as well
      // \"table.sql\",
      "chatmessages.sql",
      "messagereadstatus.sql",
      "notification_tokens.sql",
    ];

    for (const file of schemaFiles) {
      await runSqlFile(client, file);
    }

    console.log("✅ All database tables initialized successfully from .sql files");
  } catch (error) {
    console.error("❌ Error during database initialization:", error);
    throw error;
  } finally {
    client.release();
  }
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

// Create MessageType enum (still done in code; SQL files reference it)
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

export default initDB;