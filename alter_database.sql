-- ALTER queries to add new columns to existing users table

-- Add department column
ALTER TABLE "users" ADD COLUMN "department" VARCHAR(100);

-- Add personal information columns
ALTER TABLE "users" ADD COLUMN "gender" VARCHAR(20);
ALTER TABLE "users" ADD COLUMN "dateOfBirth" DATE;
ALTER TABLE "users" ADD COLUMN "bloodGroup" VARCHAR(10);
ALTER TABLE "users" ADD COLUMN "maritalStatus" VARCHAR(20);
ALTER TABLE "users" ADD COLUMN "education" VARCHAR(100);

-- Add contact information columns
ALTER TABLE "users" ADD COLUMN "whatsappNumber" VARCHAR(15);
ALTER TABLE "users" ADD COLUMN "emergencyContact" VARCHAR(15);
ALTER TABLE "users" ADD COLUMN "email" VARCHAR(100);
ALTER TABLE "users" ADD COLUMN "address" TEXT;

-- Create new sabha_attendance table
CREATE TABLE IF NOT EXISTS "sabha_attendance" (
  "id" SERIAL PRIMARY KEY,
  "userId" VARCHAR(50) REFERENCES "users"("userId"),
  "sabhaDate" DATE NOT NULL,
  "isPresent" BOOLEAN DEFAULT FALSE,
  "entryTime" TIME,
  "sabhaStartTime" TIME DEFAULT '09:00:00',
  "sabhaEndTime" TIME DEFAULT '11:00:00',
  "isLate" BOOLEAN DEFAULT FALSE,
  "timeDifference" INTERVAL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("userId", "sabhaDate")
);

-- Add tableHeaders column to table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='table' AND column_name='tableHeaders') THEN
        ALTER TABLE "table" ADD COLUMN "tableHeaders" JSONB DEFAULT '["Sr No", "Column1", "Column2", "Column3"]';
    END IF;
END $$; 

-- Add coverImage column to announcements table
ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "coverImage" VARCHAR(255);

-- Add status column to announcements table if it doesn't exist
ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT 'published';

-- Update existing records to have default status
UPDATE "announcements" SET "status" = 'published' WHERE "status" IS NULL;

-- Change coverImage column to hasCoverImage boolean
DO $$ 
BEGIN 
    -- Check if coverImage column exists and hasCoverImage doesn't
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='announcements' AND column_name='coverImage')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name='announcements' AND column_name='hasCoverImage') THEN
        
        -- Add new hasCoverImage column
        ALTER TABLE "announcements" ADD COLUMN "hasCoverImage" BOOLEAN DEFAULT FALSE;
        
        -- Update hasCoverImage based on existing coverImage values
        UPDATE "announcements" SET "hasCoverImage" = TRUE WHERE "coverImage" IS NOT NULL AND "coverImage" != '';
        
        -- Drop the old coverImage column
        ALTER TABLE "announcements" DROP COLUMN "coverImage";
    END IF;
    
    -- If hasCoverImage doesn't exist yet, create it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='announcements' AND column_name='hasCoverImage') THEN
        ALTER TABLE "announcements" ADD COLUMN "hasCoverImage" BOOLEAN DEFAULT FALSE;
    END IF;
END $$; 