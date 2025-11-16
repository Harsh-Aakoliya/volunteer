// initDB.js
import pool from "../config/database.js";

const createUsersTable = async () => {
  const client = await pool.connect();
  try {
    // Check if table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log("Users table already exists");
      return;
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
          user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          mobile_number VARCHAR(15) UNIQUE NOT NULL,
          email VARCHAR(100),
          full_name VARCHAR(100) NOT NULL,
          password VARCHAR(255) NOT NULL,

          role VARCHAR(10) NOT NULL check (role in ('master','admin', 'sevak')),

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
    console.log("Users table created successfully");
  } catch (error) {
    console.error("Error while creating users table:", error);
  } finally {
    client.release();
  }
};

const createAnnouncementsTable = async () => {
  const client = await pool.connect();
  try {
    // Check if table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'announcements'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log("Announcements table already exists");
      return;
    }
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS "announcements" (
          "announcement_id" SERIAL PRIMARY KEY,
          "room_id" INTEGER NOT NULL REFERENCES "chatrooms"("room_id"),
          "title" VARCHAR(255) NOT NULL,
          "body" TEXT NOT NULL,
          "author_id" VARCHAR(50) NOT NULL REFERENCES "users"("user_id"),
          "created_at" TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'UTC'),
          "updated_at" TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'UTC'),
          "updated_by" VARCHAR(50) NOT NULL REFERENCES "users"("user_id"),
          "liked_by" JSONB DEFAULT '[]',
          "read_by" JSONB DEFAULT '[]'
      );
    `);
    console.log("Announcements table created successfully");
  } catch (error) {
    console.error("Error while creating announcements table:", error);
  } finally {
    client.release();
  }
};



const initDB = async () => {
  await createUsersTable();
  await createAnnouncementsTable();
};

export default initDB;