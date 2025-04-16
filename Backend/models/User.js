// initDB.js
import pool from "../config/datebase.js";

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
        "likes" INT DEFAULT 0,
        "dislikes" INT DEFAULT 0
      );
    `);
  } finally {
    client.release();
  }
};

export default initDB;