// initDB.js
import pool from "../config/database.js";

//state
//city

//role=>dept
//leave sabha not count
//leave list
//joining date

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
        "department" VARCHAR(100),
        "password" VARCHAR(100),
        "isApproved" BOOLEAN DEFAULT FALSE,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "totalSabha" INTEGER DEFAULT 0,
        "presentCount" INTEGER DEFAULT 0,
        "absentCount" INTEGER DEFAULT 0,
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
        "status" VARCHAR(20) DEFAULT 'published',
        "likes" TEXT[] DEFAULT '{}',
        "dislikes" INT DEFAULT 0,
        "readBy" JSONB DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS "sabha_attendance" (
        "id" SERIAL PRIMARY KEY,
        "userId" VARCHAR(50) REFERENCES "users"("userId"),
        "sabhaDate" DATE NOT NULL,
        "isPresent" BOOLEAN DEFAULT FALSE,
        "entryTime" TIME,
        "sabhaStartTime" TIME DEFAULT '09:00:00',
        "sabhaEndTime" TIME DEFAULT '11:00:00',
        "isLate" BOOLEAN DEFAULT FALSE,
        "timeDifference" INTERVAL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE("userId", "sabhaDate")
      );
    `);
  } finally {
    client.release();
  }
};

export default initDB;