-- Migration script to update departments table schema
-- Replace adminList and hodUserId with hodList

-- Add the new hodList column
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "hodList" TEXT[] DEFAULT '{}';

-- Migrate data: combine adminList and hodUserId into hodList
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
END;

-- Remove duplicate entries from hodList
UPDATE "departments" 
SET "hodList" = (
    SELECT array_agg(DISTINCT unnest_val) 
    FROM unnest("hodList") AS unnest_val
)
WHERE array_length("hodList", 1) > 0;

-- Drop the old columns (uncomment when ready to permanently remove)
-- ALTER TABLE "departments" DROP COLUMN IF EXISTS "adminList";
-- ALTER TABLE "departments" DROP COLUMN IF EXISTS "hodUserId";
