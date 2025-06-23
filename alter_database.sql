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