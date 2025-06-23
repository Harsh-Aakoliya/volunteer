import pool from "../config/database.js";

const initDepartmentDB = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "departments" (
        "departmentId" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "departmentName" VARCHAR(255) UNIQUE NOT NULL,
        "createdBy" VARCHAR(50) REFERENCES "users"("userId"),
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "adminList" TEXT[] DEFAULT '{}',
        "userList" TEXT[] DEFAULT '{}'
      );

      -- Add department fields to users table
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='users' AND column_name='department') THEN
          ALTER TABLE "users" ADD COLUMN "department" VARCHAR(255);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='users' AND column_name='departmentId') THEN
          ALTER TABLE "users" ADD COLUMN "departmentId" UUID REFERENCES "departments"("departmentId") ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  } finally {
    client.release();
  }
};

export default initDepartmentDB; 