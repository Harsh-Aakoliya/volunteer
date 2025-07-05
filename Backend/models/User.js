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
        "absentCount" INTEGER DEFAULT 0,
        "department" VARCHAR(100),
        "departmentId" UUID REFERENCES "department"("departmentId"),
        "gender" VARCHAR(20),
        "dateOfBirth" DATE,
        "bloodGroup" VARCHAR(10),
        "maritalStatus" VARCHAR(20),
        "education" VARCHAR(100),
        "whatsappNumber" VARCHAR(15),
        "emergencyContact" VARCHAR(15),
        "email" VARCHAR(100),
        "address" TEXT
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

      -- Add new columns to existing users table if they don't exist
      DO $$ 
      BEGIN
        BEGIN
          ALTER TABLE "users" ADD COLUMN "department" VARCHAR(100);
        EXCEPTION
          WHEN duplicate_column THEN
            -- Column already exists, do nothing
        END;
        
        BEGIN
          ALTER TABLE "users" ADD COLUMN "departmentId" UUID REFERENCES "department"("departmentId");
        EXCEPTION
          WHEN duplicate_column THEN
            -- Column already exists, do nothing
        END;
        
        BEGIN
          ALTER TABLE "users" ADD COLUMN "gender" VARCHAR(20);
        EXCEPTION
          WHEN duplicate_column THEN
            -- Column already exists, do nothing
        END;
        
        BEGIN
          ALTER TABLE "users" ADD COLUMN "dateOfBirth" DATE;
        EXCEPTION
          WHEN duplicate_column THEN
            -- Column already exists, do nothing
        END;
        
        BEGIN
          ALTER TABLE "users" ADD COLUMN "bloodGroup" VARCHAR(10);
        EXCEPTION
          WHEN duplicate_column THEN
            -- Column already exists, do nothing
        END;
        
        BEGIN
          ALTER TABLE "users" ADD COLUMN "maritalStatus" VARCHAR(20);
        EXCEPTION
          WHEN duplicate_column THEN
            -- Column already exists, do nothing
        END;
        
        BEGIN
          ALTER TABLE "users" ADD COLUMN "education" VARCHAR(100);
        EXCEPTION
          WHEN duplicate_column THEN
            -- Column already exists, do nothing
        END;
        
        BEGIN
          ALTER TABLE "users" ADD COLUMN "whatsappNumber" VARCHAR(15);
        EXCEPTION
          WHEN duplicate_column THEN
            -- Column already exists, do nothing
        END;
        
        BEGIN
          ALTER TABLE "users" ADD COLUMN "emergencyContact" VARCHAR(15);
        EXCEPTION
          WHEN duplicate_column THEN
            -- Column already exists, do nothing
        END;
        
        BEGIN
          ALTER TABLE "users" ADD COLUMN "email" VARCHAR(100);
        EXCEPTION
          WHEN duplicate_column THEN
            -- Column already exists, do nothing
        END;
        
        BEGIN
          ALTER TABLE "users" ADD COLUMN "address" TEXT;
        EXCEPTION
          WHEN duplicate_column THEN
            -- Column already exists, do nothing
        END;
      END $$;

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