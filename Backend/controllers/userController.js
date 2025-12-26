// User Controller
import pool from "../config/database.js";

// Utility function to convert YYYY-MM-DD to DD/MM/YYYY for frontend
const convertDateToDDMMYYYY = (dateInput) => {
  if (!dateInput) return null;
  
  // Handle Date objects
  if (dateInput instanceof Date) {
    const day = dateInput.getDate().toString().padStart(2, '0');
    const month = (dateInput.getMonth() + 1).toString().padStart(2, '0');
    const year = dateInput.getFullYear();
    return `${day}/${month}/${year}`;
  }
  
  // Convert to string if not already
  const dateString = String(dateInput);
  
  // Check if it's already in DD/MM/YYYY format
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
    return dateString;
  }
  
  // Parse YYYY-MM-DD format
  const parts = dateString.split('-');
  if (parts.length !== 3) return null;
  
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  
  return `${day}/${month}/${year}`;
};

// Get user profile
const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("userId", userId);
    
    const result = await pool.query(
      `SELECT * FROM "SevakMaster" 
      WHERE "seid" = $1`,
      [userId]
    );

    console.log("result", result.rows);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const userProfile = result.rows[0];
    console.log("userProfile", userProfile);
    
    // Convert date_of_birth to DD/MM/YYYY format for frontend
    if (userProfile.birthdate) {
      userProfile.birthdate = convertDateToDDMMYYYY(userProfile.birthdate);
    }
    
    
    res.json(userProfile);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export default { 
  getUserProfile
};
