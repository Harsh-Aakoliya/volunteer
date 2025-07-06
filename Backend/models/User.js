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
                "departmentId" UUID,
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
          "id" SERIAL PRIMARY KEY,
          "title" VARCHAR(255) NOT NULL,
          "body" TEXT NOT NULL,
          "authorId" VARCHAR(50),
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "likedBy" JSONB DEFAULT '[]',
          "readBy" JSONB DEFAULT '[]'
      );
    `);
    console.log("Announcements table created successfully");
  } catch (error) {
    console.error("Error while creating announcements table:", error);
  } finally {
    client.release();
  }
};

const createSabhaAttendanceTable = async () => {
  const client = await pool.connect();
  try {
    // Check if table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'sabha_attendance'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log("Sabha attendance table already exists");
      return;
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS "sabha_attendance" (
          "id" SERIAL PRIMARY KEY,
          "userId" VARCHAR(50) NOT NULL,
          "sabhaDate" DATE NOT NULL,
          "isPresent" BOOLEAN DEFAULT TRUE,
          "entryTime" TIME,
          "sabhaStartTime" TIME DEFAULT '09:00:00',
          "sabhaEndTime" TIME,
          "isLate" BOOLEAN DEFAULT FALSE,
          "timeDifference" INTEGER,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE("userId", "sabhaDate"),
          FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE
      );
    `);
    console.log("Sabha attendance table created successfully");
  } catch (error) {
    console.error("Error while creating sabha attendance table:", error);
  } finally {
    client.release();
  }
};

const initDB = async () => {
  await createUsersTable();
  await createAnnouncementsTable();
  await createSabhaAttendanceTable();
};

export default initDB;