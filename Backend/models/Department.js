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
          "userList" TEXT[] DEFAULT '{}',
          "hodList" TEXT[] DEFAULT '{}'
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

const migrateDepartmentSchema = async () => {
  const client = await pool.connect();
  try {
    // Check if migration is needed (if hodList column doesn't exist or adminList/hodUserId still exist)
    const columnCheck = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'departments' AND column_name IN ('hodList', 'adminList', 'hodUserId')
    `);
    
    const columns = columnCheck.rows.map(row => row.column_name);
    const hasHodList = columns.includes('hodList');
    const hasAdminList = columns.includes('adminList');
    const hasHodUserId = columns.includes('hodUserId');
    
    if (!hasHodList && (hasAdminList || hasHodUserId)) {
      console.log("Migrating departments table schema...");
      
      // Add hodList column
      await client.query(`
        ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "hodList" TEXT[] DEFAULT '{}'
      `);
      
      // Migrate data from adminList and hodUserId to hodList
      await client.query(`
        UPDATE "departments" 
        SET "hodList" = CASE 
          WHEN "hodUserId" IS NOT NULL AND "adminList" IS NOT NULL THEN 
            array_append("adminList", "hodUserId")
          WHEN "hodUserId" IS NOT NULL AND "adminList" IS NULL THEN 
            ARRAY["hodUserId"]
          WHEN "hodUserId" IS NULL AND "adminList" IS NOT NULL THEN 
            "adminList"
          ELSE 
            '{}'
        END
        WHERE "hodList" = '{}'
      `);
      
      // Remove duplicates from hodList
      await client.query(`
        UPDATE "departments" 
        SET "hodList" = (
          SELECT array_agg(DISTINCT unnest_val) 
          FROM unnest("hodList") AS unnest_val
        )
        WHERE array_length("hodList", 1) > 0
      `);
      
      // Drop old columns
      if (hasAdminList) {
        await client.query(`ALTER TABLE "departments" DROP COLUMN IF EXISTS "adminList"`);
      }
      if (hasHodUserId) {
        await client.query(`ALTER TABLE "departments" DROP COLUMN IF EXISTS "hodUserId"`);
      }
      
      console.log("Departments table schema migration completed successfully");
    } else if (hasHodList) {
      console.log("Departments table schema is already up to date");
    }
  } catch (error) {
    console.error("Error during departments table schema migration:", error);
  } finally {
    client.release();
  }
};

const initDepartmentDB = async () => {
  await createDepartmentTable();
  await createSubdepartmentsTable();
  await migrateDepartmentSchema();
};

export default initDepartmentDB;