// initMediaDB.js
import pool from "../config/database.js";

const createMediaTable = async () => {
  const client = await pool.connect();
  try {
    // Check if table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'media'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log("Media table already exists");
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
    console.log("Media table created successfully");
  } catch (error) {
    console.error("Error while creating media table:", error);
  } finally {
    client.release();
  }
};

const initMediaDB = async () => {
  await createMediaTable();
};

export default initMediaDB;