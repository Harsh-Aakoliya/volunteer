// User Controller
import pool from "../config/database.js";

const getPendingUsers = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT "userId", "mobileNumber", "fullName" FROM "users" WHERE "isApproved" = FALSE ORDER BY "createdAt" DESC'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const approveUser = async (req, res) => {
  const { mobileNumber, password } = req.body;
  try {
    await pool.query(
      'UPDATE "users" SET "isApproved" = TRUE, "password" = $1 WHERE "mobileNumber" = $2',
      [password, mobileNumber]
    );

    res.json({ success: true, message: "User approved and SMS sent" });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await pool.query(
      `SELECT 
        "userId", 
        "mobileNumber", 
        "fullName", 
        "xetra", 
        "mandal", 
        "role",
        "department", 
        "totalSabha", 
        "presentCount", 
        "absentCount", 
        "isAdmin",
        "isApproved",
        "gender",
        "dateOfBirth",
        "bloodGroup",
        "maritalStatus",
        "education",
        "whatsappNumber",
        "emergencyContact",
        "email",
        "address"
      FROM "users" 
      WHERE "userId" = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const userProfile = result.rows[0];
    
    res.json(userProfile);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const updateUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      fullName, 
      xetra, 
      mandal, 
      role,
      department,
      gender,
      dateOfBirth,
      bloodGroup,
      maritalStatus,
      education,
      whatsappNumber,
      emergencyContact,
      email,
      address
    } = req.body;
    
    const result = await pool.query(
      `UPDATE "users" 
       SET 
        "fullName" = $1, 
        "xetra" = $2, 
        "mandal" = $3, 
        "role" = $4,
        "department" = $5,
        "gender" = $6,
        "dateOfBirth" = $7,
        "bloodGroup" = $8,
        "maritalStatus" = $9,
        "education" = $10,
        "whatsappNumber" = $11,
        "emergencyContact" = $12,
        "email" = $13,
        "address" = $14
       WHERE "userId" = $15 
       RETURNING *`,
      [fullName, xetra, mandal, role, department, gender, dateOfBirth, bloodGroup, maritalStatus, education, whatsappNumber, emergencyContact, email, address, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all users (admin only)
const getAllUsers = async (req, res) => {
  try {
    // Check if the requesting user is an admin
    const { userId } = req.user;
    const adminCheck = await pool.query(
      'SELECT "isAdmin" FROM "users" WHERE "userId" = $1',
      [userId]
    );
    
    if (!adminCheck.rows[0]?.isAdmin) {
      return res.status(403).json({ message: "Access denied. Admin privileges required." });
    }
    
    const result = await pool.query(
      `SELECT 
        "userId", 
        "mobileNumber", 
        "fullName", 
        "xetra", 
        "mandal", 
        "role",
        "department", 
        "totalSabha", 
        "presentCount", 
        "absentCount", 
        "isAdmin",
        "isApproved",
        "gender",
        "dateOfBirth",
        "bloodGroup",
        "maritalStatus",
        "education",
        "whatsappNumber",
        "emergencyContact",
        "email",
        "address"
      FROM "users" 
      WHERE "isApproved" = TRUE
      ORDER BY "fullName" ASC`
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching all users:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update user (admin only)
const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      userId: newUserId,
      mobileNumber, 
      fullName, 
      isAdmin,
      gender,
      dateOfBirth,
      bloodGroup,
      maritalStatus,
      education,
      whatsappNumber,
      emergencyContact,
      email,
      address
    } = req.body;
    
    // Check if the requesting user is an admin
    const adminCheck = await pool.query(
      'SELECT "isAdmin" FROM "users" WHERE "userId" = $1',
      [req.user.userId]
    );
    
    if (!adminCheck.rows[0]?.isAdmin) {
      return res.status(403).json({ message: "Access denied. Admin privileges required." });
    }
    
    // Check if new userId already exists (if userId is being changed)
    if (newUserId !== userId) {
      const userIdCheck = await pool.query(
        'SELECT "userId" FROM "users" WHERE "userId" = $1',
        [newUserId]
      );
      
      if (userIdCheck.rows.length > 0) {
        return res.status(400).json({ message: "User ID already exists" });
      }
    }
    
    const result = await pool.query(
      `UPDATE "users" 
       SET 
        "userId" = $1,
        "mobileNumber" = $2,
        "fullName" = $3, 
        "isAdmin" = $4,
        "gender" = $5,
        "dateOfBirth" = $6,
        "bloodGroup" = $7,
        "maritalStatus" = $8,
        "education" = $9,
        "whatsappNumber" = $10,
        "emergencyContact" = $11,
        "email" = $12,
        "address" = $13
       WHERE "userId" = $14 
       RETURNING *`,
      [newUserId, mobileNumber, fullName, isAdmin, gender, dateOfBirth, bloodGroup, maritalStatus, education, whatsappNumber, emergencyContact, email, address, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getSabhaAttendance = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await pool.query(
      `SELECT 
        "sabhaDate",
        "isPresent",
        "entryTime",
        "sabhaStartTime",
        "sabhaEndTime",
        "isLate",
        "timeDifference"
      FROM "sabha_attendance" 
      WHERE "userId" = $1 
      ORDER BY "sabhaDate" DESC`,
      [userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching sabha attendance:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const recordSabhaAttendance = async (req, res) => {
  try {
    const { userId } = req.params;
    const { sabhaDate, entryTime, isPresent = true } = req.body;
    
    // Calculate if late and time difference
    const sabhaStartTime = '09:00:00';
    const isLate = entryTime > sabhaStartTime;
    
    // Calculate time difference
    const entryDateTime = new Date(`1970-01-01T${entryTime}`);
    const startDateTime = new Date(`1970-01-01T${sabhaStartTime}`);
    const timeDifference = Math.abs(entryDateTime - startDateTime);
    
    const result = await pool.query(
      `INSERT INTO "sabha_attendance" 
       ("userId", "sabhaDate", "isPresent", "entryTime", "isLate", "timeDifference") 
       VALUES ($1, $2, $3, $4, $5, $6) 
       ON CONFLICT ("userId", "sabhaDate") 
       DO UPDATE SET 
         "isPresent" = $3,
         "entryTime" = $4,
         "isLate" = $5,
         "timeDifference" = $6
       RETURNING *`,
      [userId, sabhaDate, isPresent, entryTime, isLate, timeDifference]
    );
    
    // Update user's present/absent count
    if (isPresent) {
      await pool.query(
        'UPDATE "users" SET "presentCount" = "presentCount" + 1 WHERE "userId" = $1',
        [userId]
      );
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error recording sabha attendance:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export default { 
  getPendingUsers, 
  approveUser, 
  updateUserProfile, 
  getUserProfile,
  getAllUsers,
  updateUser,
  getSabhaAttendance,
  recordSabhaAttendance
};