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
      // Check if sevakId column exists, if not add it
      const columnCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'sevakId'
        );
      `);
      
      if (!columnCheck.rows[0].exists) {
        await client.query(`
          ALTER TABLE "users" ADD COLUMN "sevakId" VARCHAR(50) UNIQUE;
        `);
        console.log("Added sevakId column to users table");
      }
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
          "password" VARCHAR(100),
          "sevakId" VARCHAR(50) UNIQUE,
          "isApproved" BOOLEAN DEFAULT FALSE,
          "createdAt" TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'UTC'),
          "totalSabha" INTEGER DEFAULT 0,
          "presentCount" INTEGER DEFAULT 0,
          "absentCount" INTEGER DEFAULT 0,
          "departments" TEXT[] DEFAULT '{}',
          "departmentIds" UUID[] DEFAULT '{}',
          "gender" VARCHAR(20),
          "dateOfBirth" VARCHAR(50),
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
          "hasCoverImage" BOOLEAN DEFAULT FALSE,
          "status" VARCHAR(50) DEFAULT 'published',
          "createdAt" TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'UTC'),
          "updatedAt" TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'UTC'),
          "likedBy" JSONB DEFAULT '[]',
          "readBy" JSONB DEFAULT '[]',
          "departmentTag" TEXT[] DEFAULT '{}'
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
          "sabhaStartTime" TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'UTC'),
          "sabhaEndTime" TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'UTC'),
          "isLate" BOOLEAN DEFAULT FALSE,
          "timeDifference" INTEGER,
          "createdAt" TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'UTC'),
          "updatedAt" TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'UTC'),
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

const createWebPermissionsTable = async () => {
  const client = await pool.connect();
  try {
    // Check if table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'webpermissions'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log("Web permissions table already exists");
      return;
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS "webpermissions" (
          "id" SERIAL PRIMARY KEY,
          "userId" VARCHAR(50) NOT NULL UNIQUE,
          "accessLevel" VARCHAR(20) NOT NULL CHECK ("accessLevel" IN ('master', 'admin')),
          "canCreateAnnouncement" BOOLEAN DEFAULT FALSE,
          "canCreateChatGroup" BOOLEAN DEFAULT FALSE,
          "canEditUserProfile" BOOLEAN DEFAULT FALSE,
          "canEditDepartments" BOOLEAN DEFAULT FALSE,
          "createdAt" TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'UTC'),
          "createdBy" VARCHAR(50),
          FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE,
          FOREIGN KEY ("createdBy") REFERENCES "users"("userId") ON DELETE SET NULL
      );
    `);
    console.log("Web permissions table created successfully");
  } catch (error) {
    console.error("Error while creating web permissions table:", error);
  } finally {
    client.release();
  }
};

const initDB = async () => {
  await createUsersTable();
  await createAnnouncementsTable();
  await createSabhaAttendanceTable();
  await createWebPermissionsTable();
};

export default initDB;