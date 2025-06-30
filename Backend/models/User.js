// initDB.js
import pool from "../config/database.js";


const initDB = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "userId" VARCHAR(50) PRIMARY KEY,
        "mobileNumber" VARCHAR(15) UNIQUE NOT NULL,
        "isAdmin" BOOLEAN DEFAULT FALSE,
        "fullName" VARCHAR(100),
        "xetra" VARCHAR(100),
        "mandal" VARCHAR(100),
        "role" VARCHAR(50),
        "password" VARCHAR(100),
        "isApproved" BOOLEAN DEFAULT FALSE,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "totalSabha" INTEGER DEFAULT 0,
        "presentCount" INTEGER DEFAULT 0,
        "absentCount" INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS "announcements" (
        "id" SERIAL PRIMARY KEY,
        "title" VARCHAR(255) NOT NULL,
        "body" TEXT NOT NULL,
        "authorId" VARCHAR(50) REFERENCES "users"("userId"),
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "likedBy" JSONB DEFAULT '[]',
        "readBy" JSONB DEFAULT '[]'
      );

      -- Add new columns to existing announcements table if they don't exist
      DO $$ 
      BEGIN
        BEGIN
          ALTER TABLE "announcements" ADD COLUMN "likedBy" JSONB DEFAULT '[]';
        EXCEPTION
          WHEN duplicate_column THEN
            -- Column already exists, do nothing
        END;
        
        BEGIN
          ALTER TABLE "announcements" ADD COLUMN "readBy" JSONB DEFAULT '[]';
        EXCEPTION
          WHEN duplicate_column THEN
            -- Column already exists, do nothing
        END;
        
        BEGIN
          ALTER TABLE "announcements" ADD COLUMN "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        EXCEPTION
          WHEN duplicate_column THEN
            -- Column already exists, do nothing
        END;
      END $$;

      -- Remove old likes/dislikes columns if they exist
      DO $$ 
      BEGIN
        BEGIN
          ALTER TABLE "announcements" DROP COLUMN IF EXISTS "likes";
          ALTER TABLE "announcements" DROP COLUMN IF EXISTS "dislikes";
        EXCEPTION
          WHEN undefined_column THEN
            -- Column doesn't exist, do nothing
        END;
      END $$;
    `);
  } finally {
    client.release();
  }
};

export default initDB;