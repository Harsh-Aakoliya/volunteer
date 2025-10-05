// initPollDB.js
import pool from "../config/database.js";

const createPollTable = async () => {
  const client = await pool.connect();
  try {
    // Check if table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'poll'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log("Poll table already exists");
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
    console.log("Poll table created successfully");
  } catch (error) {
    console.error("Error while creating poll table:", error);
  } finally {
    client.release();
  }
};

const initPollDB = async () => {
  await createPollTable();
};

export default initPollDB;