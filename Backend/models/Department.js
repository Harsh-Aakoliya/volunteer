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
          "userList" TEXT[] DEFAULT '{}',
          "hodUserId" VARCHAR(50)
      );
    `);
    console.log("Departments table created successfully");
  } catch (error) {
    console.error("Error while creating departments table:", error);
  } finally {
    client.release();
  }
};

const createSubdepartmentsTable = async () => {
  const client = await pool.connect();
  try {
    // Check if table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'subdepartments'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log("Subdepartments table already exists");
      return;
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS "subdepartments" (
          "subdepartmentId" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "subdepartmentName" VARCHAR(255) NOT NULL,
          "departmentId" UUID NOT NULL,
          "createdBy" VARCHAR(50),
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "userList" TEXT[] DEFAULT '{}',
          FOREIGN KEY ("departmentId") REFERENCES "departments"("departmentId") ON DELETE CASCADE,
          UNIQUE("departmentId", "subdepartmentName")
      );
    `);
    console.log("Subdepartments table created successfully");
  } catch (error) {
    console.error("Error while creating subdepartments table:", error);
  } finally {
    client.release();
  }
};

const initDepartmentDB = async () => {
  await createDepartmentTable();
  await createSubdepartmentsTable();
};

export default initDepartmentDB;