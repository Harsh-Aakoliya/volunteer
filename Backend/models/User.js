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
                "departments" TEXT[] DEFAULT '{}',
                "departmentIds" UUID[] DEFAULT '{}',
                "subdepartmentIds" TEXT[] DEFAULT '{}',
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
          "coverImage" VARCHAR(255) DEFAULT 'false',
          "status" VARCHAR(50) DEFAULT 'published',
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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

const addThumbnailColumnIfNotExists = async () => {
  const client = await pool.connect();
  try {
    // Check if thumbnail column exists in announcements table
    const columnCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'announcements' AND column_name = 'thumbnail'
      );
    `);
    
    if (columnCheck.rows[0].exists) {
      console.log("Thumbnail column already exists in announcements table");
      return;
    }

    // Add thumbnail column if it doesn't exist
    await client.query(`
      ALTER TABLE announcements 
      ADD COLUMN thumbnail VARCHAR(255) DEFAULT 'announcement_icon.png';
    `);
    console.log("Thumbnail column added to announcements table successfully");
  } catch (error) {
    console.error("Error while adding thumbnail column to announcements table:", error);
  } finally {
    client.release();
  }
};

const addDepartmentTagColumnIfNotExists = async () => {
  const client = await pool.connect();
  try {
    // Check if departmentTag column exists in announcements table
    const columnCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'announcements' AND column_name = 'departmentTag'
      );
    `);
    
    if (columnCheck.rows[0].exists) {
      console.log("DepartmentTag column already exists in announcements table");
      return;
    }

    // Add departmentTag column if it doesn't exist
    await client.query(`
      ALTER TABLE announcements 
      ADD COLUMN "departmentTag" TEXT[] DEFAULT '{}';
    `);
    console.log("DepartmentTag column added to announcements table successfully");
  } catch (error) {
    console.error("Error while adding departmentTag column to announcements table:", error);
  } finally {
    client.release();
  }
};

const addRecipientUserIdsColumnIfNotExists = async () => {
  const client = await pool.connect();
  try {
    // Check if recipientUserIds column exists in announcements table
    const columnCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'announcements' AND column_name = 'recipientUserIds'
      );
    `);
    
    if (columnCheck.rows[0].exists) {
      console.log("RecipientUserIds column already exists in announcements table");
      return;
    }

    // Add recipientUserIds column if it doesn't exist
    await client.query(`
      ALTER TABLE announcements 
      ADD COLUMN "recipientUserIds" TEXT[] DEFAULT '{}';
    `);
    console.log("RecipientUserIds column added to announcements table successfully");
  } catch (error) {
    console.error("Error while adding recipientUserIds column to announcements table:", error);
  } finally {
    client.release();
  }
};

const addHasCoverImageColumnIfNotExists = async () => {
  const client = await pool.connect();
  try {
    // Check if hasCoverImage column exists in announcements table
    const columnCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'announcements' AND column_name = 'hasCoverImage'
      );
    `);
    
    if (columnCheck.rows[0].exists) {
      console.log("HasCoverImage column already exists in announcements table");
      return;
    }

    // Add hasCoverImage column if it doesn't exist
    await client.query(`
      ALTER TABLE announcements 
      ADD COLUMN "hasCoverImage" BOOLEAN DEFAULT FALSE;
    `);
    console.log("HasCoverImage column added to announcements table successfully");
  } catch (error) {
    console.error("Error while adding hasCoverImage column to announcements table:", error);
  } finally {
    client.release();
  }
};

const migrateDepartmentToArrays = async () => {
  const client = await pool.connect();
  try {
    // Check if departments column already exists
    const departmentsColumnCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'departments'
      );
    `);
    
    if (departmentsColumnCheck.rows[0].exists) {
      console.log("Departments array column already exists in users table");
      return;
    }

    // Add new array columns
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN "departments" TEXT[] DEFAULT '{}',
      ADD COLUMN "departmentIds" UUID[] DEFAULT '{}';
    `);

    // Migrate existing data from department/departmentId to departments/departmentIds arrays
    const usersWithDepartments = await client.query(`
      SELECT "userId", "department", "departmentId" 
      FROM users 
      WHERE "department" IS NOT NULL AND "department" != ''
    `);

    for (const user of usersWithDepartments.rows) {
      const departments = [user.department];
      const departmentIds = user.departmentId ? [user.departmentId] : [];
      
      await client.query(`
        UPDATE users 
        SET "departments" = $1, "departmentIds" = $2 
        WHERE "userId" = $3
      `, [departments, departmentIds, user.userId]);
    }

    console.log("Successfully migrated departments to array format");
    console.log(`Migrated ${usersWithDepartments.rows.length} user records`);
  } catch (error) {
    console.error("Error while migrating departments to arrays:", error);
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
  await addThumbnailColumnIfNotExists();
  await addDepartmentTagColumnIfNotExists();
  await addRecipientUserIdsColumnIfNotExists();
  await addHasCoverImageColumnIfNotExists();
  await migrateDepartmentToArrays();
};

export default initDB;