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
        "role",
        "departments",
        "departmentIds",
        "subdepartmentIds",
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
      [fullName, xetra, mandal, role, department, departments, departmentIds, gender, dateOfBirth, bloodGroup, maritalStatus, education, whatsappNumber, emergencyContact, email, address, userId]
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
      SELECT "isAdmin", "department", "departments", "departmentId", "departmentIds" FROM "users" WHERE "userId" = $1
    `, [requestingUserId]);

    if (requesterResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const requester = requesterResult.rows[0];
    const userDepartments = requester.departments || [requester.department].filter(Boolean);
    const userDepartmentIds = requester.departmentIds || [requester.departmentId].filter(Boolean);
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
      whereConditions.push(`("departmentId"::text = ANY($${++paramCount}) OR "departmentIds" && $${++paramCount})`);
      queryParams.push(hodDepartmentIds, hodDepartmentIds);
    } else if (departmentIds.length > 0) {
      // Karyalay can filter by specific departments
      const deptArray = Array.isArray(departmentIds) ? departmentIds : [departmentIds];
      whereConditions.push(`("departmentId"::text = ANY($${++paramCount}) OR "departmentIds" && $${++paramCount})`);
      queryParams.push(deptArray, deptArray);
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
        u."department", 
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

    res.json({
      users: result.rows,
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
      SELECT "isAdmin", "department", "departments", "departmentId", "departmentIds" FROM "users" WHERE "userId" = $1
    `, [requestingUserId]);

    if (requesterResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const requester = requesterResult.rows[0];
    const userDepartments = requester.departments || [requester.department].filter(Boolean);
    const isKaryalay = requester.isAdmin && userDepartments.includes('Karyalay');

    let departments = [];
    let subdepartments = [];

    if (isKaryalay) {
      // Karyalay can see ALL departments (they are HOD of all departments)
      const deptResult = await pool.query(`
        SELECT "departmentId", "departmentName" 
        FROM "departments" 
        ORDER BY "departmentName" ASC
      `);
      departments = deptResult.rows;

      // Get all subdepartments for these departments
      if (departments.length > 0) {
        const deptIds = departments.map(d => d.departmentId);
        const subdeptResult = await pool.query(`
          SELECT "subdepartmentId", "subdepartmentName", "departmentId"
          FROM "subdepartments" 
          WHERE "departmentId" = ANY($1)
          ORDER BY "subdepartmentName" ASC
        `, [deptIds]);
        subdepartments = subdeptResult.rows;
      }
    } else {
      // HOD can only see departments where they are designated as HOD
      const hodDepartmentsResult = await pool.query(`
        SELECT "departmentId", "departmentName" 
        FROM "departments" 
        WHERE $1 = ANY("hodList")
        ORDER BY "departmentName" ASC
      `, [requestingUserId]);
      
      departments = hodDepartmentsResult.rows;

      // Get subdepartments for these departments
      if (departments.length > 0) {
        const deptIds = departments.map(d => d.departmentId);
        const subdeptResult = await pool.query(`
          SELECT "subdepartmentId", "subdepartmentName", "departmentId"
          FROM "subdepartments" 
          WHERE "departmentId" = ANY($1)
          ORDER BY "subdepartmentName" ASC
        `, [deptIds]);
        subdepartments = subdeptResult.rows;
      }
    }

    res.json({
      departments,
      subdepartments,
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

// Update user with subdepartment assignments
const updateUserWithSubdepartments = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { userId } = req.params;
    const { 
      fullName, 
      mobileNumber,
      departmentId,
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
    
    const requestingUserId = req.user.userId;
    
    // Check permissions
    const requesterResult = await pool.query(`
      SELECT "isAdmin", "department", "departments", "departmentId", "departmentIds" FROM "users" WHERE "userId" = $1
    `, [requestingUserId]);

    if (requesterResult.rows.length === 0) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const requester = requesterResult.rows[0];
    const userDepartments = requester.departments || [requester.department].filter(Boolean);
    const isKaryalay = requester.isAdmin && userDepartments.includes('Karyalay');

    if (!isKaryalay && !requester.isAdmin) {
      return res.status(403).json({ message: 'Only admins can update users' });
    }

    await client.query('BEGIN');

    // Get department names if departmentIds are provided
    let departmentNames = [];
    let legacyDepartmentName = null;
    
    if (departmentIds && departmentIds.length > 0) {
      const deptResult = await client.query(`
        SELECT "departmentName" FROM "departments" WHERE "departmentId" = ANY($1)
      `, [departmentIds]);
      
      departmentNames = deptResult.rows.map(row => row.departmentName);
      // For backward compatibility, set first department as legacy department
      if (departmentNames.length > 0) {
        legacyDepartmentName = departmentNames[0];
      }
    } else if (departmentId) {
      // Fallback to single department for backward compatibility
      const deptResult = await client.query(`
        SELECT "departmentName" FROM "departments" WHERE "departmentId" = $1
      `, [departmentId]);
      
      if (deptResult.rows.length > 0) {
        legacyDepartmentName = deptResult.rows[0].departmentName;
        departmentNames = [legacyDepartmentName];
      }
    }

    // Update user basic info
    const result = await client.query(
      `UPDATE "users" 
       SET 
        "fullName" = $1, 
        "mobileNumber" = $2,
        "departmentId" = $3,
        "department" = $4,
        "departmentIds" = $5,
        "departments" = $6,
        "subdepartmentIds" = $7,
        "isAdmin" = $8,
        "gender" = $9,
        "dateOfBirth" = $10,
        "bloodGroup" = $11,
        "maritalStatus" = $12,
        "education" = $13,
        "whatsappNumber" = $14,
        "emergencyContact" = $15,
        "email" = $16,
        "address" = $17
       WHERE "userId" = $18 
       RETURNING *`,
      [fullName, mobileNumber, departmentId, legacyDepartmentName, departmentIds, departmentNames, subdepartmentIds, isAdmin, 
       gender, dateOfBirth, bloodGroup, maritalStatus, education, whatsappNumber, 
       emergencyContact, email, address, userId]
    );
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: "User not found" });
    }

    // Update subdepartment user lists
    if (subdepartmentIds.length > 0) {
      // Remove user from all subdepartments first
      await client.query(`
        UPDATE "subdepartments" 
        SET "userList" = array_remove("userList", $1)
        WHERE "userList" @> ARRAY[$1]
      `, [userId]);

      // Add user to selected subdepartments
      await client.query(`
        UPDATE "subdepartments" 
        SET "userList" = array_append("userList", $1)
        WHERE "subdepartmentId" = ANY($2) AND NOT ("userList" @> ARRAY[$1])
      `, [userId, subdepartmentIds]);
    } else {
      // Remove user from all subdepartments if none selected
      await client.query(`
        UPDATE "subdepartments" 
        SET "userList" = array_remove("userList", $1)
        WHERE "userList" @> ARRAY[$1]
      `, [userId]);
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);
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
      SELECT "isAdmin", "department", "departments", "departmentId", "departmentIds" FROM "users" WHERE "userId" = $1
    `, [requestingUserId]);

    if (requesterResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const requester = requesterResult.rows[0];
    const userDepartments = requester.departments || [requester.department].filter(Boolean);
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
          u."department", 
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
      users = usersResult.rows;
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
          u."department", 
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
        WHERE u."isApproved" = TRUE AND (u."departmentId"::text = ANY($1) OR u."departmentIds" && $1)
        GROUP BY u."userId"
        ORDER BY u."fullName" ASC
      `, [hodDepartmentIds]);
      users = usersResult.rows;
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