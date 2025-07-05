// initDepartmentDB.js
import pool from "../config/database.js";

const createDepartmentTable = async () => {
  const client = await pool.connect();
  try {
    // Check if table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'departments'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log("Departments table already exists");
      return;
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS "departments" (
          "departmentId" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "departmentName" VARCHAR(255) UNIQUE NOT NULL,
          "createdBy" VARCHAR(50),
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "adminList" TEXT[] DEFAULT '{}',
          "userList" TEXT[] DEFAULT '{}'
      );
    `);
    console.log("Departments table created successfully");
  } catch (error) {
    console.error("Error while creating departments table:", error);
  } finally {
    client.release();
  }
};

const initDepartmentDB = async () => {
  await createDepartmentTable();
};

export default initDepartmentDB;