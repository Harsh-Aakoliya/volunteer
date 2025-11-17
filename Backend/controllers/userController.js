// User Controller
import pool from "../config/database.js";

// Utility function to convert DD/MM/YYYY to YYYY-MM-DD for database storage
const convertDDMMYYYYToDate = (dateString) => {
  if (!dateString) return null;
  
  // Check if it's already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }
  
  // Parse DD/MM/YYYY format
  const parts = dateString.split('/');
  if (parts.length !== 3) return null;
  
  const day = parts[0].padStart(2, '0');
  const month = parts[1].padStart(2, '0');
  const year = parts[2];
  
  // Validate the date
  const date = new Date(year, month - 1, day);
  if (date.getDate() != day || date.getMonth() != month - 1 || date.getFullYear() != year) {
    return null;
  }
  
  return `${year}-${month}-${day}`;
};

// Utility function to convert YYYY-MM-DD to DD/MM/YYYY for frontend
const convertDateToDDMMYYYY = (dateString) => {
  if (!dateString) return null;
  
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

// Get pending users (users without password set - for approval workflow)
const getPendingUsers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT "user_id" as "userId", "mobile_number" as "mobileNumber", "full_name" as "fullName" 
       FROM "users" 
       WHERE "password" IS NULL OR "password" = '' 
       ORDER BY "created_at" DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Approve user - set password same as mobile number
const approveUser = async (req, res) => {
  const { userId } = req.body;
  try {
    // First get the user's mobile number to set as password
    const userResult = await pool.query(
      `SELECT "mobile_number" FROM "users" WHERE "user_id"::text = $1`,
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    const mobileNumber = userResult.rows[0].mobile_number;
    
    // Update user password same as mobile number
    await pool.query(
      `UPDATE "users" SET "password" = $1 WHERE "user_id"::text = $2`,
      [mobileNumber, userId]
    );

    res.json({ success: true, message: "User approved successfully. Password set to mobile number." });
  } catch (error) {
    console.error("Error approving user:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get user profile
const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await pool.query(
      `SELECT 
        "user_id" as "userId", 
        "mobile_number" as "mobileNumber", 
        "full_name" as "fullName", 
        "role",
        "gender",
        "date_of_birth" as "dateOfBirth",
        "blood_group" as "bloodGroup",
        "education",
        "whatsapp_number" as "whatsappNumber",
        "emergency_contact" as "emergencyContact",
        "email",
        "address"
      FROM "users" 
      WHERE "user_id"::text = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const userProfile = result.rows[0];
    
    // Convert date_of_birth to DD/MM/YYYY format for frontend
    if (userProfile.dateOfBirth) {
      userProfile.dateOfBirth = convertDateToDDMMYYYY(userProfile.dateOfBirth);
    }
    
    
    res.json(userProfile);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update user profile (self-update)
const updateUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      fullName, 
      role,
      gender,
      dateOfBirth,
      bloodGroup,
      education,
      whatsappNumber,
      emergencyContact,
      email,
      address
    } = req.body;

    // Convert dateOfBirth from DD/MM/YYYY to YYYY-MM-DD for database storage
    const formattedDateOfBirth = convertDDMMYYYYToDate(dateOfBirth);
    
    const result = await pool.query(
      `UPDATE "users" 
       SET 
        "full_name" = $1, 
        "role" = $2,
        "gender" = $3,
        "date_of_birth" = $4,
        "blood_group" = $5,
        "education" = $6,
        "whatsapp_number" = $7,
        "emergency_contact" = $8,
        "email" = $9,
        "address" = $10,
        "updated_at" = CURRENT_TIMESTAMP
       WHERE "user_id"::text = $11 
       RETURNING 
        "user_id" as "userId",
        "mobile_number" as "mobileNumber",
        "full_name" as "fullName",
        "role",
        "gender",
        "date_of_birth" as "dateOfBirth",
        "blood_group" as "bloodGroup",
        "education",
        "whatsapp_number" as "whatsappNumber",
        "emergency_contact" as "emergencyContact",
        "email",
        "address"`,
      [fullName, role, gender, formattedDateOfBirth, bloodGroup, education, whatsappNumber, emergencyContact, email, address, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const updatedUser = result.rows[0];
    // Convert date_of_birth to DD/MM/YYYY format for frontend
    if (updatedUser.dateOfBirth) {
      updatedUser.dateOfBirth = convertDateToDDMMYYYY(updatedUser.dateOfBirth);
    }
    // Add isAdmin for backward compatibility
    updatedUser.isAdmin = updatedUser.role === 'master' || updatedUser.role === 'admin';
    
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all users (admin/master only)
const getAllUsers = async (req, res) => {
  try {
    // Check if the requesting user is admin or master
    const { userId, role } = req.user;
    const isAdmin = role === 'master' || role === 'admin';
    
    if (!isAdmin) {
      return res.status(403).json({ message: "Access denied. Admin privileges required." });
    }
    
    const result = await pool.query(
      `SELECT 
        "user_id" as "userId", 
        "mobile_number" as "mobileNumber", 
        "full_name" as "fullName", 
        "role",
        "gender",
        "date_of_birth" as "dateOfBirth",
        "blood_group" as "bloodGroup",
        "education",
        "whatsapp_number" as "whatsappNumber",
        "emergency_contact" as "emergencyContact",
        "email",
        "address",
        "created_at" as "createdAt",
        "updated_at" as "updatedAt"
      FROM "users" 
      WHERE "password" IS NOT NULL AND "password" != ''
      ORDER BY "full_name" ASC`
    );
    
    // Convert dateOfBirth to DD/MM/YYYY format for frontend
    const users = result.rows.map(user => ({
      ...user,
      dateOfBirth: user.dateOfBirth ? convertDateToDDMMYYYY(user.dateOfBirth) : null,
      isAdmin: user.role === 'master' || user.role === 'admin' // Add for backward compatibility
    }));
    
    res.json(users);
  } catch (error) {
    console.error("Error fetching all users:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update user (admin/master only)
const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      mobileNumber, 
      fullName, 
      role,
      gender,
      dateOfBirth,
      bloodGroup,
      education,
      whatsappNumber,
      emergencyContact,
      email,
      address
    } = req.body;

    // Convert dateOfBirth from DD/MM/YYYY to YYYY-MM-DD for database storage
    const formattedDateOfBirth = convertDDMMYYYYToDate(dateOfBirth);
    
    // Check if the requesting user is admin or master
    const requestingUserRole = req.user.role;
    const isAdmin = requestingUserRole === 'master' || requestingUserRole === 'admin';
    
    if (!isAdmin) {
      return res.status(403).json({ message: "Access denied. Admin privileges required." });
    }
    
    // Validate role if being updated
    if (role && !['master', 'admin', 'sevak'].includes(role)) {
      return res.status(400).json({ message: "Invalid role. Must be 'master', 'admin', or 'sevak'" });
    }
    
    const result = await pool.query(
      `UPDATE "users" 
       SET 
        "mobile_number" = COALESCE($1, "mobile_number"),
        "full_name" = COALESCE($2, "full_name"), 
        "role" = COALESCE($3, "role"),
        "gender" = COALESCE($4, "gender"),
        "date_of_birth" = COALESCE($5, "date_of_birth"),
        "blood_group" = COALESCE($6, "blood_group"),
        "education" = COALESCE($7, "education"),
        "whatsapp_number" = COALESCE($8, "whatsapp_number"),
        "emergency_contact" = COALESCE($9, "emergency_contact"),
        "email" = COALESCE($10, "email"),
        "address" = COALESCE($11, "address"),
        "updated_at" = CURRENT_TIMESTAMP
       WHERE "user_id"::text = $12 
       RETURNING 
        "user_id" as "userId",
        "mobile_number" as "mobileNumber",
        "full_name" as "fullName",
        "role",
        "gender",
        "date_of_birth" as "dateOfBirth",
        "blood_group" as "bloodGroup",
        "education",
        "whatsapp_number" as "whatsappNumber",
        "emergency_contact" as "emergencyContact",
        "email",
        "address"`,
      [mobileNumber, fullName, role, gender, formattedDateOfBirth, bloodGroup, education, whatsappNumber, emergencyContact, email, address, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const updatedUser = result.rows[0];
    // Convert date_of_birth to DD/MM/YYYY format for frontend
    if (updatedUser.dateOfBirth) {
      updatedUser.dateOfBirth = convertDateToDDMMYYYY(updatedUser.dateOfBirth);
    }
    // Add isAdmin for backward compatibility
    updatedUser.isAdmin = updatedUser.role === 'master' || updatedUser.role === 'admin';
    
    res.json(updatedUser);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Simple search for users (removed department filtering)
const searchUsers = async (req, res) => {
  try {
    const { 
      searchQuery = '', 
      page = 1, 
      limit = 50 
    } = req.query;
    
    // Build query conditions
    let whereConditions = [`"password" IS NOT NULL AND "password" != ''`];
    let queryParams = [];
    let paramCount = 0;

    // Add search query filter
    if (searchQuery.trim()) {
      whereConditions.push(`(
        "full_name" ILIKE $${++paramCount} OR 
        "user_id"::text ILIKE $${++paramCount} OR 
        "mobile_number" ILIKE $${++paramCount}
      )`);
      const searchPattern = `%${searchQuery.trim()}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }

    // Calculate offset for pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Main query
    const query = `
      SELECT 
        "user_id" as "userId", 
        "mobile_number" as "mobileNumber", 
        "full_name" as "fullName", 
        "role",
        "gender",
        "date_of_birth" as "dateOfBirth",
        "blood_group" as "bloodGroup",
        "education",
        "whatsapp_number" as "whatsappNumber",
        "emergency_contact" as "emergencyContact",
        "email",
        "address"
      FROM "users"
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY "full_name" ASC
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;

    queryParams.push(parseInt(limit), offset);

    const result = await pool.query(query, queryParams);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM "users"
      WHERE ${whereConditions.join(' AND ')}
    `;
    
    const countResult = await pool.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    // Convert dateOfBirth to DD/MM/YYYY format for frontend
    const users = result.rows.map(user => ({
      ...user,
      dateOfBirth: user.dateOfBirth ? convertDateToDDMMYYYY(user.dateOfBirth) : null,
      isAdmin: user.role === 'master' || user.role === 'admin' // Add for backward compatibility
    }));

    res.json({
      users: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'Failed to search users' });
  }
};

// Get search filters (simplified - no departments)
const getSearchFilters = async (req, res) => {
  try {
    const requestingUserRole = req.user.role;
    const isAdmin = requestingUserRole === 'master' || requestingUserRole === 'admin';
    
    res.json({
      departments: [], // Empty since departments removed
      userRole: {
        isMaster: requestingUserRole === 'master',
        isAdmin: isAdmin,
        role: requestingUserRole
      }
    });
  } catch (error) {
    console.error('Error fetching search filters:', error);
    res.status(500).json({ message: 'Failed to fetch search filters' });
  }
};

// Get all search data (simplified - no departments/subdepartments)
const getAllSearchData = async (req, res) => {
  try {
    const requestingUserRole = req.user.role;
    const isAdmin = requestingUserRole === 'master' || requestingUserRole === 'admin';
    
    // Get all approved users
    const usersResult = await pool.query(`
      SELECT 
        "user_id" as "userId", 
        "mobile_number" as "mobileNumber", 
        "full_name" as "fullName", 
        "role",
        "gender",
        "date_of_birth" as "dateOfBirth",
        "blood_group" as "bloodGroup",
        "education",
        "whatsapp_number" as "whatsappNumber",
        "emergency_contact" as "emergencyContact",
        "email",
        "address"
      FROM "users"
      WHERE "password" IS NOT NULL AND "password" != ''
      ORDER BY "full_name" ASC
    `);
    
    const users = usersResult.rows.map(user => ({
      ...user,
      dateOfBirth: user.dateOfBirth ? convertDateToDDMMYYYY(user.dateOfBirth) : null,
      isAdmin: user.role === 'master' || user.role === 'admin' // Add for backward compatibility
    }));

    res.json({
      users,
      departments: [], // Empty since departments removed
      subdepartments: [], // Empty since subdepartments removed
      userRole: {
        isMaster: requestingUserRole === 'master',
        isAdmin: isAdmin,
        role: requestingUserRole
      }
    });
  } catch (error) {
    console.error('Error fetching all search data:', error);
    res.status(500).json({ message: 'Failed to fetch search data' });
  }
};

// Simplified update user (removed department logic)
const updateUserWithSubdepartments = async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      fullName, 
      mobileNumber,
      role,
      gender,
      dateOfBirth,
      bloodGroup,
      education,
      whatsappNumber,
      emergencyContact,
      email,
      address
    } = req.body;

    // Convert dateOfBirth from DD/MM/YYYY to YYYY-MM-DD for database storage
    const formattedDateOfBirth = convertDDMMYYYYToDate(dateOfBirth);
    
    const requestingUserRole = req.user.role;
    const isAdmin = requestingUserRole === 'master' || requestingUserRole === 'admin';

    if (!isAdmin) {
      return res.status(403).json({ message: 'Only admins can update users' });
    }

    // Validate role if being updated
    if (role && !['master', 'admin', 'sevak'].includes(role)) {
      return res.status(400).json({ message: "Invalid role. Must be 'master', 'admin', or 'sevak'" });
    }

    // Update user basic info
    const result = await pool.query(
      `UPDATE "users" 
       SET 
        "full_name" = COALESCE($1, "full_name"), 
        "mobile_number" = COALESCE($2, "mobile_number"),
        "role" = COALESCE($3, "role"),
        "gender" = COALESCE($4, "gender"),
        "date_of_birth" = COALESCE($5, "date_of_birth"),
        "blood_group" = COALESCE($6, "blood_group"),
        "education" = COALESCE($7, "education"),
        "whatsapp_number" = COALESCE($8, "whatsapp_number"),
        "emergency_contact" = COALESCE($9, "emergency_contact"),
        "email" = COALESCE($10, "email"),
        "address" = COALESCE($11, "address"),
        "updated_at" = CURRENT_TIMESTAMP
       WHERE "user_id"::text = $12 
       RETURNING 
        "user_id" as "userId",
        "mobile_number" as "mobileNumber",
        "full_name" as "fullName",
        "role",
        "gender",
        "date_of_birth" as "dateOfBirth",
        "blood_group" as "bloodGroup",
        "education",
        "whatsapp_number" as "whatsappNumber",
        "emergency_contact" as "emergencyContact",
        "email",
        "address"`
      ,
      [fullName, mobileNumber, role, gender, formattedDateOfBirth, bloodGroup, education, whatsappNumber, 
       emergencyContact, email, address, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Return updated user with proper date format
    const updatedUser = result.rows[0];
    if (updatedUser.dateOfBirth) {
      updatedUser.dateOfBirth = convertDateToDDMMYYYY(updatedUser.dateOfBirth);
    }
    // Add isAdmin for backward compatibility
    updatedUser.isAdmin = updatedUser.role === 'master' || updatedUser.role === 'admin';
    
    res.json(updatedUser);
  } catch (error) {
    console.error("Error updating user:", error);
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
  searchUsers,
  getSearchFilters,
  updateUserWithSubdepartments,
  getAllSearchData
};
