-- Mock data for testing the profile functionality

-- 1. INSERT MOCK USER DATA
INSERT INTO "users" (
  "userId", 
  "mobileNumber", 
  "isAdmin", 
  "fullName", 
  "xetra", 
  "mandal", 
  "role", 
  "department",
  "password", 
  "isApproved", 
  "totalSabha", 
  "presentCount", 
  "absentCount",
  "gender",
  "dateOfBirth",
  "bloodGroup",
  "maritalStatus",
  "education",
  "whatsappNumber",
  "emergencyContact",
  "email",
  "address"
) VALUES (
  'USR001',
  '9876543210',
  false,
  'Rajesh Kumar Patel',
  'Gujarat',
  'Ahmedabad',
  'Sevak',
  'Technical Department',
  '$2b$10$hashedPassword123',
  true,
  15,
  12,
  3,
  'Male',
  '1990-05-15',
  'O+',
  'Married',
  'B.Tech Computer Science',
  '9876543210',
  '9876543211',
  'rajesh.patel@example.com',
  'Plot No 123, Satellite Road, Ahmedabad, Gujarat - 380015'
);

-- 2. INSERT SABHA ATTENDANCE RECORDS FOR THE USER
INSERT INTO "sabha_attendance" (
  "userId",
  "sabhaDate",
  "isPresent",
  "entryTime",
  "sabhaStartTime",
  "sabhaEndTime",
  "isLate",
  "timeDifference"
) VALUES
-- Present and on time
('USR001', '2024-01-15', true, '08:58:00', '09:00:00', '11:00:00', false, '00:02:00'),

-- Present but late
('USR001', '2024-01-22', true, '10:33:00', '09:00:00', '11:00:00', true, '01:33:00'),

-- Absent
('USR001', '2024-01-29', false, null, '09:00:00', '11:00:00', false, null),

-- Present but late
('USR001', '2024-02-05', true, '09:15:00', '09:00:00', '11:00:00', true, '00:15:00'),

-- Present and early
('USR001', '2024-02-12', true, '08:45:00', '09:00:00', '11:00:00', false, '00:15:00'),

-- Present and on time
('USR001', '2024-02-19', true, '09:00:00', '09:00:00', '11:00:00', false, '00:00:00'),

-- Present but late
('USR001', '2024-02-26', true, '09:45:00', '09:00:00', '11:00:00', true, '00:45:00'),

-- Present and early
('USR001', '2024-03-05', true, '08:50:00', '09:00:00', '11:00:00', false, '00:10:00'),

-- Absent
('USR001', '2024-03-12', false, null, '09:00:00', '11:00:00', false, null),

-- Present but late
('USR001', '2024-03-19', true, '09:25:00', '09:00:00', '11:00:00', true, '00:25:00'),

-- Present and early
('USR001', '2024-03-26', true, '08:55:00', '09:00:00', '11:00:00', false, '00:05:00'),

-- Present and on time
('USR001', '2024-04-02', true, '09:02:00', '09:00:00', '11:00:00', true, '00:02:00');

-- Update user's present count to match attendance records
UPDATE "users" 
SET "presentCount" = (
  SELECT COUNT(*) 
  FROM "sabha_attendance" 
  WHERE "userId" = 'USR001' AND "isPresent" = true
)
WHERE "userId" = 'USR001';

-- Verify the data
SELECT 'User Data:' as info;
SELECT * FROM "users" WHERE "userId" = 'USR001';

SELECT 'Attendance Records:' as info;
SELECT * FROM "sabha_attendance" WHERE "userId" = 'USR001' ORDER BY "sabhaDate" DESC; 