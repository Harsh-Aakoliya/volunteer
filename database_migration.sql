-- SQL Migration Script for Subdepartment Functionality
-- Execute these queries in order to implement the subdepartment system

-- 1. Add hodUserId column to departments table
ALTER TABLE "departments" 
ADD COLUMN "hodUserId" VARCHAR(50);

-- 2. Create subdepartments table
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

-- 3. Add subdepartmentIds column to users table
ALTER TABLE "users" 
ADD COLUMN "subdepartmentIds" TEXT[] DEFAULT '{}';

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_subdepartments_department_id" ON "subdepartments"("departmentId");
CREATE INDEX IF NOT EXISTS "idx_departments_hod_user_id" ON "departments"("hodUserId");
CREATE INDEX IF NOT EXISTS "idx_users_subdepartment_ids" ON "users" USING GIN("subdepartmentIds");

-- 5. Optional: Add some sample data (uncomment if needed)
/*
-- Sample: Update existing departments to have HODs (replace with actual user IDs)
-- UPDATE "departments" SET "hodUserId" = 'sample_user_id_1' WHERE "departmentName" = 'IT';
-- UPDATE "departments" SET "hodUserId" = 'sample_user_id_2' WHERE "departmentName" = 'Security';

-- Sample: Create some subdepartments (replace with actual department IDs and user IDs)
-- INSERT INTO "subdepartments" ("subdepartmentName", "departmentId", "createdBy", "userList") 
-- VALUES 
--   ('Frontend', 'dept_id_1', 'creator_user_id', ARRAY['user1', 'user2']),
--   ('Backend', 'dept_id_1', 'creator_user_id', ARRAY['user3', 'user4']),
--   ('DevOps', 'dept_id_1', 'creator_user_id', ARRAY['user5']);

-- Sample: Update users with subdepartment assignments
-- UPDATE "users" SET "subdepartmentIds" = ARRAY['subdept_id_1', 'subdept_id_2'] WHERE "userId" = 'user1';
*/

-- 6. Verify the changes
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name IN ('departments', 'subdepartments', 'users') 
    AND column_name IN ('hodUserId', 'subdepartmentIds', 'subdepartmentId', 'subdepartmentName')
ORDER BY table_name, column_name;

-- 7. Check table constraints
SELECT 
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'subdepartments'
ORDER BY tc.constraint_type, tc.constraint_name;
