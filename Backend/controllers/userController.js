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
  const { userId } = req.body;
  try {
    // First get the user's mobile number to set as password
    const userResult = await pool.query(
      'SELECT "mobileNumber" FROM "users" WHERE "userId" = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    const mobileNumber = userResult.rows[0].mobileNumber;
    
    // Update user to approved status and set password same as mobile number
    await pool.query(
      'UPDATE "users" SET "isApproved" = TRUE, "password" = $1 WHERE "userId" = $2',
      [mobileNumber, userId]
    );

    res.json({ success: true, message: "User approved successfully. Password set to mobile number." });
  } catch (error) {
    console.error("Error approving user:", error);
    res.status(500).json({ success: false, message: error.message });
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
        "departments",
        "departmentIds",
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
    
    // Convert dateOfBirth to DD/MM/YYYY format for frontend
    if (userProfile.dateOfBirth) {
      userProfile.dateOfBirth = convertDateToDDMMYYYY(userProfile.dateOfBirth);
    }
    
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
      departments,
      departmentIds,
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

    // Convert dateOfBirth from DD/MM/YYYY to YYYY-MM-DD for database storage
    const formattedDateOfBirth = convertDDMMYYYYToDate(dateOfBirth);
    
    const result = await pool.query(
      `UPDATE "users" 
       SET 
        "fullName" = $1, 
        "xetra" = $2, 
        "mandal" = $3, 
        "role" = $4,
        "department" = $5,
        "departments" = $6,
        "departmentIds" = $7,
        "gender" = $8,
        "dateOfBirth" = $9,
        "bloodGroup" = $10,
        "maritalStatus" = $11,
        "education" = $12,
        "whatsappNumber" = $13,
        "emergencyContact" = $14,
        "email" = $15,
        "address" = $16
       WHERE "userId" = $17 
       RETURNING *`,
      [fullName, xetra, mandal, role, department, departments, departmentIds, gender, formattedDateOfBirth, bloodGroup, maritalStatus, education, whatsappNumber, emergencyContact, email, address, userId]
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
        "departments",
        "departmentIds",
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
    
    // Convert dateOfBirth to DD/MM/YYYY format for frontend
    const users = result.rows.map(user => ({
      ...user,
      dateOfBirth: user.dateOfBirth ? convertDateToDDMMYYYY(user.dateOfBirth) : null
    }));
    
    res.json(users);
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

    // Convert dateOfBirth from DD/MM/YYYY to YYYY-MM-DD for database storage
    const formattedDateOfBirth = convertDDMMYYYYToDate(dateOfBirth);
    
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
      [newUserId, mobileNumber, fullName, isAdmin, gender, formattedDateOfBirth, bloodGroup, maritalStatus, education, whatsappNumber, emergencyContact, email, address, userId]
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

// Advanced search for users with department/subdepartment filtering
const searchUsers = async (req, res) => {
  try {
    const { 
      searchQuery = '', 
      departmentIds = [], 
      subdepartmentIds = [],
      page = 1, 
      limit = 50 
    } = req.query;
    
    const requestingUserId = req.user.userId;
    
    // Check if requesting user is HOD or Karyalay
    const requesterResult = await pool.query(`
      SELECT "isAdmin", "departments", "departmentIds" FROM "users" WHERE "userId" = $1
    `, [requestingUserId]);

    if (requesterResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const requester = requesterResult.rows[0];
    const userDepartments = requester.departments || [requester.departmentIds].filter(Boolean);
    const userDepartmentIds = requester.departmentIds || [requester.departmentIds].filter(Boolean);
    const isKaryalay = requester.isAdmin && userDepartments.includes('Karyalay');
    
    // Build query conditions based on user role
    let whereConditions = [`"isApproved" = TRUE`];
    let queryParams = [];
    let paramCount = 0;

    if (!isKaryalay) {
      // HOD can only see users from departments where they are HOD
      if (userDepartmentIds.length === 0) {
        return res.status(403).json({ message: 'HOD must be assigned to a department' });
      }
      
      // Find departments where this user is HOD
      const hodDepartmentsResult = await pool.query(`
        SELECT "departmentId" FROM "departments" WHERE $1 = ANY("hodList")
      `, [requestingUserId]);
      
      if (hodDepartmentsResult.rows.length === 0) {
        return res.status(403).json({ message: 'User is not HOD of any department' });
      }
      
      const hodDepartmentIds = hodDepartmentsResult.rows.map(row => row.departmentId);
      whereConditions.push(`"departmentIds" && $${++paramCount}`);
      queryParams.push(hodDepartmentIds);
    } else if (departmentIds.length > 0) {
      // Karyalay can filter by specific departments
      const deptArray = Array.isArray(departmentIds) ? departmentIds : [departmentIds];
      whereConditions.push(`"departmentIds" && $${++paramCount}`);
      queryParams.push(deptArray);
    }

    // Filter by subdepartments if specified
    if (subdepartmentIds.length > 0) {
      const subdeptArray = Array.isArray(subdepartmentIds) ? subdepartmentIds : [subdepartmentIds];
      whereConditions.push(`"subdepartmentIds" && $${++paramCount}::text[]`);
      queryParams.push(subdeptArray);
    }

    // Add search query filter
    if (searchQuery.trim()) {
      whereConditions.push(`(
        "fullName" ILIKE $${++paramCount} OR 
        "userId" ILIKE $${++paramCount} OR 
        "mobileNumber" ILIKE $${++paramCount}
      )`);
      const searchPattern = `%${searchQuery.trim()}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }

    // Calculate offset for pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Main query
    const query = `
      SELECT 
        u."userId", 
        u."mobileNumber", 
        u."fullName", 
        u."xetra", 
        u."mandal", 
        u."role",
        u."departments",
        u."departmentIds",
        u."subdepartmentIds",
        u."isAdmin",
        u."gender",
        u."dateOfBirth",
        u."bloodGroup",
        u."maritalStatus",
        u."education",
        u."whatsappNumber",
        u."emergencyContact",
        u."email",
        u."address",
        COALESCE(
          array_agg(
            CASE WHEN s."subdepartmentName" IS NOT NULL 
            THEN json_build_object('id', s."subdepartmentId", 'name', s."subdepartmentName")
            END
          ) FILTER (WHERE s."subdepartmentName" IS NOT NULL), 
          '{}'
        ) as "subdepartments"
      FROM "users" u
      LEFT JOIN "subdepartments" s ON s."subdepartmentId"::text = ANY(u."subdepartmentIds")
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY u."userId"
      ORDER BY u."fullName" ASC
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;

    queryParams.push(parseInt(limit), offset);

    const result = await pool.query(query, queryParams);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM "users" u
      WHERE ${whereConditions.join(' AND ')}
    `;
    
    const countResult = await pool.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    // Convert dateOfBirth to DD/MM/YYYY format for frontend
    const users = result.rows.map(user => ({
      ...user,
      dateOfBirth: user.dateOfBirth ? convertDateToDDMMYYYY(user.dateOfBirth) : null
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

// Get departments and subdepartments for search filters
const getSearchFilters = async (req, res) => {
  try {
    const requestingUserId = req.user.userId;
    
    // Check if requesting user is HOD or Karyalay
    const requesterResult = await pool.query(`
      SELECT "isAdmin", "departments", "departmentIds" FROM "users" WHERE "userId" = $1
    `, [requestingUserId]);

    if (requesterResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const requester = requesterResult.rows[0];
    const userDepartments = requester.departments || [requester.departmentIds].filter(Boolean);
    const isKaryalay = requester.isAdmin && userDepartments.includes('Karyalay');

    let departments = [];
    // let subdepartments = [];

    if (isKaryalay) {
      // Karyalay can see ALL departments (they are HOD of all departments)
      const deptResult = await pool.query(`
        SELECT "departmentId", "departmentName" 
        FROM "departments" 
        ORDER BY "departmentName" ASC
      `);
      departments = deptResult.rows;

      // // Get all subdepartments for these departments
      // if (departments.length > 0) {
      //   const deptIds = departments.map(d => d.departmentId);
      //   const subdeptResult = await pool.query(`
      //     SELECT "subdepartmentId", "subdepartmentName", "departmentId"
      //     FROM "subdepartments" 
      //     WHERE "departmentId" = ANY($1)
      //     ORDER BY "subdepartmentName" ASC
      //   `, [deptIds]);
      //   subdepartments = subdeptResult.rows;
      // }
    } else {
      // HOD can only see departments where they are designated as HOD
      const hodDepartmentsResult = await pool.query(`
        SELECT "departmentId", "departmentName", "hodList" 
        FROM "departments" 
        WHERE $1 = ANY("hodList")
        ORDER BY "departmentName" ASC
      `, [requestingUserId]);
      
      departments = hodDepartmentsResult.rows;

      // // Get subdepartments for these departments
      // if (departments.length > 0) {
      //   const deptIds = departments.map(d => d.departmentId);
      //   const subdeptResult = await pool.query(`
      //     SELECT "subdepartmentId", "subdepartmentName", "departmentId"
      //     FROM "subdepartments" 
      //     WHERE "departmentId" = ANY($1)
      //     ORDER BY "subdepartmentName" ASC
      //   `, [deptIds]);
      //   subdepartments = subdeptResult.rows;
      // }
    }

    res.json({
      departments,
      userRole: {
        isKaryalay,
        isHOD: requester.isAdmin && !isKaryalay
      }
    });
  } catch (error) {
    console.error('Error fetching search filters:', error);
    res.status(500).json({ message: 'Failed to fetch search filters' });
  }
};

// Update user with complex department and HOD logic
const updateUserWithSubdepartments = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { userId } = req.params;
    const { 
      fullName, 
      mobileNumber,
      departmentIds = [],
      subdepartmentIds = [],
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

    // Convert dateOfBirth from DD/MM/YYYY to YYYY-MM-DD for database storage
    const formattedDateOfBirth = convertDDMMYYYYToDate(dateOfBirth);
    
    const requestingUserId = req.user.userId;
    
    // Check permissions
    const requesterResult = await client.query(`
      SELECT "isAdmin", "departments", "departmentIds" FROM "users" WHERE "userId" = $1
    `, [requestingUserId]);

    if (requesterResult.rows.length === 0) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const requester = requesterResult.rows[0];
    const userDepartments = requester.departments || [];
    const isKaryalay = requester.isAdmin && userDepartments.includes('Karyalay');

    if (!isKaryalay && !requester.isAdmin) {
      return res.status(403).json({ message: 'Only admins can update users' });
    }

    await client.query('BEGIN');

    // Get current user data to compare changes
    const currentUserResult = await client.query(`
      SELECT "isAdmin", "departmentIds", "departments" FROM "users" WHERE "userId" = $1
    `, [userId]);

    if (currentUserResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: "User not found" });
    }

    const currentUser = currentUserResult.rows[0];
    const originalIsAdmin = currentUser.isAdmin;
    const originalDepartmentIds = currentUser.departmentIds || [];

    // Get department names for new departments
    let departmentNames = [];
    if (departmentIds && departmentIds.length > 0) {
      const deptResult = await client.query(`
        SELECT "departmentName" FROM "departments" WHERE "departmentId" = ANY($1)
      `, [departmentIds]);
      departmentNames = deptResult.rows.map(row => row.departmentName);
    }

    // Complex department and HOD logic based on the 4 specific cases
    
    // Find departments to remove and add
    const departmentsToRemove = originalDepartmentIds.filter(id => !departmentIds.includes(id));
    const departmentsToAdd = departmentIds.filter(id => !originalDepartmentIds.includes(id));
    
    // Case 1: HOD status changes (no longer HOD), department status not changes
    if (originalIsAdmin && !isAdmin && departmentsToRemove.length === 0 && departmentsToAdd.length === 0) {
      // Remove user from HOD lists of all current departments (user stays in userList)
      if (originalDepartmentIds.length > 0) {
        await client.query(`
          UPDATE "departments" 
          SET "hodList" = array_remove("hodList", $1)
          WHERE "departmentId" = ANY($2)
        `, [userId, originalDepartmentIds]);
      }
    }
    
    // Case 2: HOD status not changes (still HOD), department status changes
    else if (originalIsAdmin && isAdmin && (departmentsToRemove.length > 0 || departmentsToAdd.length > 0)) {
      // Remove from old departments (both userList and hodList)
      if (departmentsToRemove.length > 0) {
        await client.query(`
          UPDATE "departments" 
          SET "hodList" = array_remove("hodList", $1),
              "userList" = array_remove("userList", $1)
          WHERE "departmentId" = ANY($2)
        `, [userId, departmentsToRemove]);
      }

      // Add to new departments (both userList and hodList)
      if (departmentsToAdd.length > 0) {
        await client.query(`
          UPDATE "departments" 
          SET "hodList" = CASE 
            WHEN NOT ("hodList" @> ARRAY[$1]) THEN array_append("hodList", $1)
            ELSE "hodList"
          END,
          "userList" = CASE 
            WHEN NOT ("userList" @> ARRAY[$1]) THEN array_append("userList", $1)
            ELSE "userList"
          END
          WHERE "departmentId" = ANY($2)
        `, [userId, departmentsToAdd]);
      }
    }
    
    // Case 3: HOD status changes (no longer HOD) and departments also change
    else if (originalIsAdmin && !isAdmin && (departmentsToRemove.length > 0 || departmentsToAdd.length > 0)) {
      // Remove from all original departments' HOD lists
      if (originalDepartmentIds.length > 0) {
        await client.query(`
          UPDATE "departments" 
          SET "hodList" = array_remove("hodList", $1)
          WHERE "departmentId" = ANY($2)
        `, [userId, originalDepartmentIds]);
      }
      
      // Remove from old departments' userList
      if (departmentsToRemove.length > 0) {
        await client.query(`
          UPDATE "departments" 
          SET "userList" = array_remove("userList", $1)
          WHERE "departmentId" = ANY($2)
        `, [userId, departmentsToRemove]);
      }

      // Add to new departments' userList only (not HOD since user is no longer admin)
      if (departmentsToAdd.length > 0) {
        await client.query(`
          UPDATE "departments" 
          SET "userList" = CASE 
            WHEN NOT ("userList" @> ARRAY[$1]) THEN array_append("userList", $1)
            ELSE "userList"
          END
          WHERE "departmentId" = ANY($2)
        `, [userId, departmentsToAdd]);
      }
    }
    
    // Case 4: User becomes HOD and departments change
    else if (!originalIsAdmin && isAdmin) {
      // Remove from old departments (only userList since they weren't HOD)
      if (departmentsToRemove.length > 0) {
        await client.query(`
          UPDATE "departments" 
          SET "userList" = array_remove("userList", $1)
          WHERE "departmentId" = ANY($2)
        `, [userId, departmentsToRemove]);
      }

      // Add to new departments (both userList and hodList since they're now HOD)
      if (departmentIds.length > 0) {
        await client.query(`
          UPDATE "departments" 
          SET "hodList" = CASE 
            WHEN NOT ("hodList" @> ARRAY[$1]) THEN array_append("hodList", $1)
            ELSE "hodList"
          END,
          "userList" = CASE 
            WHEN NOT ("userList" @> ARRAY[$1]) THEN array_append("userList", $1)
            ELSE "userList"
          END
          WHERE "departmentId" = ANY($2)
        `, [userId, departmentIds]);
      }
    }
    
    // Case 5: Non-admin user, only department membership changes
    else if (!originalIsAdmin && !isAdmin && (departmentsToRemove.length > 0 || departmentsToAdd.length > 0)) {
      // Remove from old departments (only userList)
      if (departmentsToRemove.length > 0) {
        await client.query(`
          UPDATE "departments" 
          SET "userList" = array_remove("userList", $1)
          WHERE "departmentId" = ANY($2)
        `, [userId, departmentsToRemove]);
      }

      // Add to new departments (only userList)
      if (departmentsToAdd.length > 0) {
        await client.query(`
          UPDATE "departments" 
          SET "userList" = CASE 
            WHEN NOT ("userList" @> ARRAY[$1]) THEN array_append("userList", $1)
            ELSE "userList"
          END
          WHERE "departmentId" = ANY($2)
        `, [userId, departmentsToAdd]);
      }
    }

    // Update user basic info
    const result = await client.query(
      `UPDATE "users" 
       SET 
        "fullName" = $1, 
        "mobileNumber" = $2,
        "departmentIds" = $3,
        "departments" = $4,
        "isAdmin" = $5,
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
      [fullName, mobileNumber, departmentIds, departmentNames, isAdmin,
       gender, formattedDateOfBirth, bloodGroup, maritalStatus, education, whatsappNumber, 
       emergencyContact, email, address, userId]
    );

    // Update subdepartment user lists
    // if (subdepartmentIds.length > 0) {
    //   // Remove user from all subdepartments first
    //   await client.query(`
    //     UPDATE "subdepartments" 
    //     SET "userList" = array_remove("userList", $1)
    //     WHERE "userList" @> ARRAY[$1]
    //   `, [userId]);

    //   // Add user to selected subdepartments
    //   await client.query(`
    //     UPDATE "subdepartments" 
    //     SET "userList" = array_append("userList", $1)
    //     WHERE "subdepartmentId" = ANY($2) AND NOT ("userList" @> ARRAY[$1])
    //   `, [userId, subdepartmentIds]);
    // } else {
    //   // Remove user from all subdepartments if none selected
    //   await client.query(`
    //     UPDATE "subdepartments" 
    //     SET "userList" = array_remove("userList", $1)
    //     WHERE "userList" @> ARRAY[$1]
    //   `, [userId]);
    // }

    await client.query('COMMIT');
    
    // Return updated user with proper date format
    const updatedUser = result.rows[0];
    if (updatedUser.dateOfBirth) {
      updatedUser.dateOfBirth = convertDateToDDMMYYYY(updatedUser.dateOfBirth);
    }
    
    res.json(updatedUser);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  } finally {
    client.release();
  }
};

// Get all search data (users, departments, subdepartments) in one call
const getAllSearchData = async (req, res) => {
  try {
    const requestingUserId = req.user.userId;
    
    // Check if requesting user is HOD or Karyalay
    const requesterResult = await pool.query(`
      SELECT "isAdmin", "departments", "departmentIds" FROM "users" WHERE "userId" = $1
    `, [requestingUserId]);

    if (requesterResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const requester = requesterResult.rows[0];
    const userDepartments = requester.departments || [requester.departmentIds].filter(Boolean);
    const userDepartmentIds = requester.departmentIds || [requester.departmentId].filter(Boolean);
    const isKaryalay = requester.isAdmin && userDepartments.includes('Karyalay');

    let departments = [];
    let subdepartments = [];
    let users = [];

    if (isKaryalay) {
      // Karyalay can see ALL departments and users
      const deptResult = await pool.query(`
        SELECT "departmentId", "departmentName" 
        FROM "departments" 
        ORDER BY "departmentName" ASC
      `);
      departments = deptResult.rows;

      // Get all subdepartments
      const subdeptResult = await pool.query(`
        SELECT "subdepartmentId", "subdepartmentName", "departmentId"
        FROM "subdepartments" 
        ORDER BY "subdepartmentName" ASC
      `);
      subdepartments = subdeptResult.rows;

      // Get all users
      const usersResult = await pool.query(`
        SELECT 
          u."userId", 
          u."mobileNumber", 
          u."fullName", 
          u."xetra", 
          u."mandal", 
          u."role",
          u."departments",
          u."departmentId",
          u."departmentIds",
          u."subdepartmentIds",
          u."isAdmin",
          u."gender",
          u."dateOfBirth",
          u."bloodGroup",
          u."maritalStatus",
          u."education",
          u."whatsappNumber",
          u."emergencyContact",
          u."email",
          u."address",
          COALESCE(
            array_agg(
              CASE WHEN s."subdepartmentName" IS NOT NULL 
              THEN json_build_object('id', s."subdepartmentId", 'name', s."subdepartmentName")
              END
            ) FILTER (WHERE s."subdepartmentName" IS NOT NULL), 
            '{}'
          ) as "subdepartments"
        FROM "users" u
        LEFT JOIN "subdepartments" s ON s."subdepartmentId"::text = ANY(u."subdepartmentIds")
        WHERE u."isApproved" = TRUE
        GROUP BY u."userId"
        ORDER BY u."fullName" ASC
      `);
      users = usersResult.rows.map(user => ({
        ...user,
        dateOfBirth: user.dateOfBirth ? convertDateToDDMMYYYY(user.dateOfBirth) : null
      }));
    } else {
      // HOD can only see their departments and users
      if (userDepartmentIds.length === 0) {
        return res.status(403).json({ message: 'HOD must be assigned to a department' });
      }
      
      // Find departments where this user is HOD
      const hodDepartmentsResult = await pool.query(`
        SELECT "departmentId", "departmentName" 
        FROM "departments" 
        WHERE $1 = ANY("hodList")
        ORDER BY "departmentName" ASC
      `, [requestingUserId]);
      
      if (hodDepartmentsResult.rows.length === 0) {
        return res.status(403).json({ message: 'User is not HOD of any department' });
      }
      
      departments = hodDepartmentsResult.rows;
      const hodDepartmentIds = departments.map(d => d.departmentId);

      // Get subdepartments for these departments
      const subdeptResult = await pool.query(`
        SELECT "subdepartmentId", "subdepartmentName", "departmentId"
        FROM "subdepartments" 
        WHERE "departmentId" = ANY($1)
        ORDER BY "subdepartmentName" ASC
      `, [hodDepartmentIds]);
      subdepartments = subdeptResult.rows;

      // Get users from these departments
      const usersResult = await pool.query(`
        SELECT 
          u."userId", 
          u."mobileNumber", 
          u."fullName", 
          u."xetra", 
          u."mandal", 
          u."role",
          u."departments",
          u."departmentIds",
          u."subdepartmentIds",
          u."isAdmin",
          u."gender",
          u."dateOfBirth",
          u."bloodGroup",
          u."maritalStatus",
          u."education",
          u."whatsappNumber",
          u."emergencyContact",
          u."email",
          u."address",
          COALESCE(
            array_agg(
              CASE WHEN s."subdepartmentName" IS NOT NULL 
              THEN json_build_object('id', s."subdepartmentId", 'name', s."subdepartmentName")
              END
            ) FILTER (WHERE s."subdepartmentName" IS NOT NULL), 
            '{}'
          ) as "subdepartments"
        FROM "users" u
        LEFT JOIN "subdepartments" s ON s."subdepartmentId"::text = ANY(u."subdepartmentIds")
        WHERE u."isApproved" = TRUE AND u."departmentIds" && $1
        GROUP BY u."userId"
        ORDER BY u."fullName" ASC
      `, [hodDepartmentIds]);
      users = usersResult.rows.map(user => ({
        ...user,
        dateOfBirth: user.dateOfBirth ? convertDateToDDMMYYYY(user.dateOfBirth) : null
      }));
    }

    res.json({
      users,
      departments,
      subdepartments,
      userRole: {
        isKaryalay,
        isHOD: requester.isAdmin && !isKaryalay
      }
    });
  } catch (error) {
    console.error('Error fetching all search data:', error);
    res.status(500).json({ message: 'Failed to fetch search data' });
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
  recordSabhaAttendance,
  searchUsers,
  getSearchFilters,
  updateUserWithSubdepartments,
  getAllSearchData
};