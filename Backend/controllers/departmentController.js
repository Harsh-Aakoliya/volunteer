import pool from "../config/database.js";

// Get all departments based on user role
export const getMyDepartments = async (req, res) => {
  try {
    const userId = req.user.userId;
    // console.log("userId in getMyDepartments", userId);

    // Check if user is Karyalay (admin in Karyalay department)
    const userResult = await pool.query(`
      SELECT "isAdmin", "department" FROM "users" WHERE "userId" = $1
    `, [userId]);
    // console.log("userResult in getMyDepartments", userResult.rows);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];
    const isKaryalay = user.isAdmin && user.department === 'Karyalay';
    // console.log("isKaryalay in getMyDepartments", isKaryalay);
    let query;
    let params;

    if (isKaryalay) {
      // Karyalay users see ALL departments (they are HOD of all departments)
      query = `
        SELECT 
          d."departmentId",
          d."departmentName",
          d."createdBy",
          d."createdAt",
          d."adminList",
          d."userList",
          d."hodUserId",
          u."fullName" as "createdByName",
          hod."fullName" as "hodName"
        FROM "departments" d
        LEFT JOIN "users" u ON d."createdBy" = u."userId"
        LEFT JOIN "users" hod ON d."hodUserId" = hod."userId"
        ORDER BY d."createdAt" DESC
      `;
      params = [];
    } else {
      // HODs see only departments where they are designated as HOD
      query = `
        SELECT 
          d."departmentId",
          d."departmentName",
          d."createdBy",
          d."createdAt",
          d."adminList",
          d."userList",
          d."hodUserId",
          u."fullName" as "createdByName",
          hod."fullName" as "hodName"
        FROM "departments" d
        LEFT JOIN "users" u ON d."createdBy" = u."userId"
        LEFT JOIN "users" hod ON d."hodUserId" = hod."userId"
        WHERE d."hodUserId" = $1
        ORDER BY d."createdAt" DESC
      `;
      params = [userId];
    }
    // console.log("query in getMyDepartments", query);
    // console.log("params in getMyDepartments", params);
    const result = await pool.query(query, params);
    // console.log("result in getMyDepartments", result.rows);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ message: 'Failed to fetch departments' });
  }
};

// Get all users for department management
export const getAllUsers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u."userId",
        u."fullName",
        u."mobileNumber",
        u."isAdmin",
        u."xetra",
        u."mandal",
        u."role",
        u."department",
        u."departmentId"
      FROM "users" u
      WHERE u."isApproved" = true
      ORDER BY u."fullName" ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};

// Create a new department
export const createDepartment = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { departmentName, userList, adminList, hodUserId } = req.body;
    const createdBy = req.user.userId;

    if (!departmentName || !userList || userList.length === 0) {
      return res.status(400).json({ message: 'Department name and user list are required' });
    }

    // Verify the creator is Karyalay
    const creatorCheck = await client.query(`
      SELECT "isAdmin", "department" FROM "users" WHERE "userId" = $1
    `, [createdBy]);

    if (creatorCheck.rows.length === 0 || 
        !creatorCheck.rows[0].isAdmin || 
        creatorCheck.rows[0].department !== 'Karyalay') {
      return res.status(403).json({ message: 'Only Karyalay personnel can create new departments' });
    }

    await client.query('BEGIN');

    // Check if department name already exists
    const existingDept = await client.query(`
      SELECT "departmentId" FROM "departments" WHERE "departmentName" = $1
    `, [departmentName]);

    if (existingDept.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Department name already exists' });
    }

    // Create the department
    const departmentResult = await client.query(`
      INSERT INTO "departments" ("departmentName", "createdBy", "userList", "adminList", "hodUserId")
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [departmentName, createdBy, userList, adminList || [], hodUserId]);

    const department = departmentResult.rows[0];

    // Update users table with department information
    await client.query(`
      UPDATE "users" 
      SET "department" = $1, "departmentId" = $2
      WHERE "userId" = ANY($3)
    `, [departmentName, department.departmentId, userList]);

    await client.query('COMMIT');

    res.status(201).json(department);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating department:', error);
    res.status(500).json({ message: 'Failed to create department' });
  } finally {
    client.release();
  }
};

// Get department by ID
export const getDepartmentById = async (req, res) => {
  try {
    const { departmentId } = req.params;
    const userId = req.user.userId;

    // Check if user is Karyalay (admin in Karyalay department)
    const userResult = await pool.query(`
      SELECT "isAdmin", "department" FROM "users" WHERE "userId" = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];
    const isKaryalay = user.isAdmin && user.department === 'Karyalay';

    let query;
    let params;

    if (isKaryalay) {
      // Karyalay users can access any department
      query = `
        SELECT 
          d."departmentId",
          d."departmentName",
          d."createdBy",
          d."createdAt",
          d."adminList",
          d."userList",
          d."hodUserId",
          u."fullName" as "createdByName",
          hod."fullName" as "hodName"
        FROM "departments" d
        LEFT JOIN "users" u ON d."createdBy" = u."userId"
        LEFT JOIN "users" hod ON d."hodUserId" = hod."userId"
        WHERE d."departmentId" = $1
      `;
      params = [departmentId];
    } else {
      // HODs can only access departments where they are designated as HOD
      query = `
        SELECT 
          d."departmentId",
          d."departmentName",
          d."createdBy",
          d."createdAt",
          d."adminList",
          d."userList",
          d."hodUserId",
          u."fullName" as "createdByName",
          hod."fullName" as "hodName"
        FROM "departments" d
        LEFT JOIN "users" u ON d."createdBy" = u."userId"
        LEFT JOIN "users" hod ON d."hodUserId" = hod."userId"
        WHERE d."departmentId" = $1 AND d."hodUserId" = $2
      `;
      params = [departmentId, userId];
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Department not found or access denied' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching department:', error);
    res.status(500).json({ message: 'Failed to fetch department' });
  }
};

// Update department
export const updateDepartment = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { departmentId } = req.params;
    const { userList, adminList, departmentName } = req.body;
    const userId = req.user.userId;

    await client.query('BEGIN');

    // Check user permissions
    const userResult = await client.query(`
      SELECT "isAdmin", "department" FROM "users" WHERE "userId" = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];
    const isKaryalay = user.isAdmin && user.department === 'Karyalay';

    // Verify permissions
    let deptCheck;
    if (isKaryalay) {
      // Karyalay users can update any department
      deptCheck = await client.query(`
        SELECT * FROM "departments" WHERE "departmentId" = $1
      `, [departmentId]);
    } else {
      // HODs can only update departments where they are designated as HOD
      deptCheck = await client.query(`
        SELECT * FROM "departments" WHERE "departmentId" = $1 AND "hodUserId" = $2
      `, [departmentId, userId]);
    }

    if (deptCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Department not found or access denied' });
    }

    const currentDept = deptCheck.rows[0];

    // Update department
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (departmentName && departmentName !== currentDept.departmentName) {
      // Check if new name already exists
      const nameCheck = await client.query(`
        SELECT "departmentId" FROM "departments" 
        WHERE "departmentName" = $1 AND "departmentId" != $2
      `, [departmentName, departmentId]);

      if (nameCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Department name already exists' });
      }

      updates.push(`"departmentName" = $${paramIndex++}`);
      values.push(departmentName);
    }

    if (userList) {
      updates.push(`"userList" = $${paramIndex++}`);
      values.push(userList);
    }

    if (adminList) {
      updates.push(`"adminList" = $${paramIndex++}`);
      values.push(adminList);
    }

    if (updates.length > 0) {
      values.push(departmentId);
      const updateQuery = `
        UPDATE "departments" 
        SET ${updates.join(', ')}
        WHERE "departmentId" = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(updateQuery, values);
      const updatedDept = result.rows[0];

      // Update users table
      if (userList) {
        // Remove department from users no longer in the list
        await client.query(`
          UPDATE "users" 
          SET "department" = NULL, "departmentId" = NULL
          WHERE "departmentId" = $1 AND "userId" != ALL($2)
        `, [departmentId, userList]);

        // Add department to new users
        await client.query(`
          UPDATE "users" 
          SET "department" = $1, "departmentId" = $2
          WHERE "userId" = ANY($3)
        `, [updatedDept.departmentName, departmentId, userList]);
      }

      await client.query('COMMIT');
      res.json(updatedDept);
    } else {
      await client.query('ROLLBACK');
      res.status(400).json({ message: 'No updates provided' });
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating department:', error);
    res.status(500).json({ message: 'Failed to update department' });
  } finally {
    client.release();
  }
};

// Delete department
export const deleteDepartment = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { departmentId } = req.params;
    const userId = req.user.userId;

    await client.query('BEGIN');

    // Check user permissions
    const userResult = await client.query(`
      SELECT "isAdmin", "department" FROM "users" WHERE "userId" = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];
    const isKaryalay = user.isAdmin && user.department === 'Karyalay';

    // Only Karyalay users can delete departments
    if (!isKaryalay) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Only Karyalay personnel can delete departments' });
    }

    // Verify department exists
    const deptCheck = await client.query(`
      SELECT * FROM "departments" WHERE "departmentId" = $1
    `, [departmentId]);

    if (deptCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Department not found' });
    }

    // Remove department from all users
    await client.query(`
      UPDATE "users" 
      SET "department" = NULL, "departmentId" = NULL
      WHERE "departmentId" = $1
    `, [departmentId]);

    // Delete the department
    await client.query(`
      DELETE FROM "departments" WHERE "departmentId" = $1
    `, [departmentId]);

    await client.query('COMMIT');
    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting department:', error);
    res.status(500).json({ message: 'Failed to delete department' });
  } finally {
    client.release();
  }
};

// Remove user from department
export const removeUserFromDepartment = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { departmentId, userId } = req.params;
    const adminId = req.user.userId;

    await client.query('BEGIN');

    // Verify department ownership
    const deptCheck = await client.query(`
      SELECT * FROM "departments" WHERE "departmentId" = $1 AND "createdBy" = $2
    `, [departmentId, adminId]);

    if (deptCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Department not found' });
    }

    const department = deptCheck.rows[0];

    // Remove user from department lists
    const newUserList = department.userList.filter(id => id !== userId);
    const newAdminList = department.adminList.filter(id => id !== userId);

    // Update department
    await client.query(`
      UPDATE "departments" 
      SET "userList" = $1, "adminList" = $2
      WHERE "departmentId" = $3
    `, [newUserList, newAdminList, departmentId]);

    // Remove department from user
    await client.query(`
      UPDATE "users" 
      SET "department" = NULL, "departmentId" = NULL
      WHERE "userId" = $1
    `, [userId]);

    await client.query('COMMIT');
    res.json({ message: 'User removed from department successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error removing user from department:', error);
    res.status(500).json({ message: 'Failed to remove user from department' });
  } finally {
    client.release();
  }
};

// Check if department name exists
export const checkDepartmentNameExists = async (req, res) => {
  try {
    const { departmentName } = req.params;

    const result = await pool.query(`
      SELECT "departmentId" FROM "departments" WHERE "departmentName" = $1
    `, [departmentName]);

    res.json({ exists: result.rows.length > 0 });
  } catch (error) {
    console.error('Error checking department name:', error);
    res.status(500).json({ message: 'Failed to check department name' });
  }
};

// Subdepartment Operations

// Get all subdepartments for a department
export const getSubdepartments = async (req, res) => {
  try {
    const { departmentId } = req.params;
    const userId = req.user.userId;

    // Check user permissions
    const userResult = await pool.query(`
      SELECT "isAdmin", "department" FROM "users" WHERE "userId" = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];
    const isKaryalay = user.isAdmin && user.department === 'Karyalay';

    // Verify user has access to this department
    const accessCheck = await pool.query(`
      SELECT d.* FROM "departments" d WHERE d."departmentId" = $1
    `, [departmentId]);

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Department not found' });
    }

    const department = accessCheck.rows[0];

    // Check permissions - Karyalay can access all departments, HODs can access their assigned departments
    if (!isKaryalay && department.hodUserId !== userId) {
      return res.status(403).json({ message: 'Access denied to this department' });
    }

    const result = await pool.query(`
      SELECT 
        s."subdepartmentId",
        s."subdepartmentName",
        s."departmentId",
        s."createdBy",
        s."createdAt",
        s."userList",
        u."fullName" as "createdByName"
      FROM "subdepartments" s
      LEFT JOIN "users" u ON s."createdBy" = u."userId"
      WHERE s."departmentId" = $1
      ORDER BY s."createdAt" DESC
    `, [departmentId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching subdepartments:', error);
    res.status(500).json({ message: 'Failed to fetch subdepartments' });
  }
};

// Create a new subdepartment
export const createSubdepartment = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { departmentId } = req.params;
    const { subdepartmentName, userList } = req.body;
    const createdBy = req.user.userId;

    if (!subdepartmentName || !userList || userList.length === 0) {
      return res.status(400).json({ message: 'Subdepartment name and user list are required' });
    }

    await client.query('BEGIN');

    // Check user permissions
    const userResult = await client.query(`
      SELECT "isAdmin", "department" FROM "users" WHERE "userId" = $1
    `, [createdBy]);

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];
    const isKaryalay = user.isAdmin && user.department === 'Karyalay';

    // Verify user has permission to create subdepartments in this department
    const permissionCheck = await client.query(`
      SELECT d.* FROM "departments" d WHERE d."departmentId" = $1
    `, [departmentId]);

    if (permissionCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Department not found' });
    }

    const department = permissionCheck.rows[0];

    // Check permissions - Karyalay can create in all departments, HODs can create in their assigned departments
    if (!isKaryalay && department.hodUserId !== createdBy) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Only HODs and Karyalay personnel can create subdepartments' });
    }

    // Check if subdepartment name already exists in this department
    const existingSubdept = await client.query(`
      SELECT "subdepartmentId" FROM "subdepartments" 
      WHERE "departmentId" = $1 AND "subdepartmentName" = $2
    `, [departmentId, subdepartmentName]);

    if (existingSubdept.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Subdepartment name already exists in this department' });
    }

    // Verify all users belong to the department
    const userCheck = await client.query(`
      SELECT "userId" FROM "users" 
      WHERE "userId" = ANY($1) AND "departmentId" = $2
    `, [userList, departmentId]);

    if (userCheck.rows.length !== userList.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Some users do not belong to this department' });
    }

    // Create the subdepartment
    const subdepartmentResult = await client.query(`
      INSERT INTO "subdepartments" ("subdepartmentName", "departmentId", "createdBy", "userList")
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [subdepartmentName, departmentId, createdBy, userList]);

    const subdepartment = subdepartmentResult.rows[0];

    // Update users' subdepartment assignments
    for (const userId of userList) {
      await client.query(`
        UPDATE "users" 
        SET "subdepartmentIds" = array_append("subdepartmentIds", $1)
        WHERE "userId" = $2 AND NOT ($1 = ANY("subdepartmentIds"))
      `, [subdepartment.subdepartmentId, userId]);
    }

    await client.query('COMMIT');

    res.status(201).json(subdepartment);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating subdepartment:', error);
    res.status(500).json({ message: 'Failed to create subdepartment' });
  } finally {
    client.release();
  }
};

// Update subdepartment
export const updateSubdepartment = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { departmentId, subdepartmentId } = req.params;
    const { subdepartmentName, userList } = req.body;
    const userId = req.user.userId;

    await client.query('BEGIN');

    // Check user permissions
    const userResult = await client.query(`
      SELECT "isAdmin", "department" FROM "users" WHERE "userId" = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];
    const isKaryalay = user.isAdmin && user.department === 'Karyalay';

    // Verify permissions and get current subdepartment
    const subdeptCheck = await client.query(`
      SELECT s.*, d."hodUserId"
      FROM "subdepartments" s
      JOIN "departments" d ON s."departmentId" = d."departmentId"
      WHERE s."subdepartmentId" = $1 AND s."departmentId" = $2
    `, [subdepartmentId, departmentId]);

    if (subdeptCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Subdepartment not found' });
    }

    const currentSubdept = subdeptCheck.rows[0];

    // Check permissions - Karyalay can update all, HODs can update their departments
    if (!isKaryalay && currentSubdept.hodUserId !== userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update subdepartment name if provided
    if (subdepartmentName && subdepartmentName !== currentSubdept.subdepartmentName) {
      // Check if new name already exists
      const nameCheck = await client.query(`
        SELECT "subdepartmentId" FROM "subdepartments" 
        WHERE "departmentId" = $1 AND "subdepartmentName" = $2 AND "subdepartmentId" != $3
      `, [departmentId, subdepartmentName, subdepartmentId]);

      if (nameCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Subdepartment name already exists in this department' });
      }
    }

    // Update subdepartment
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (subdepartmentName) {
      updates.push(`"subdepartmentName" = $${paramIndex++}`);
      values.push(subdepartmentName);
    }

    if (userList) {
      updates.push(`"userList" = $${paramIndex++}`);
      values.push(userList);
    }

    if (updates.length > 0) {
      values.push(subdepartmentId);
      const updateQuery = `
        UPDATE "subdepartments" 
        SET ${updates.join(', ')}
        WHERE "subdepartmentId" = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(updateQuery, values);
      const updatedSubdept = result.rows[0];

      // Update user subdepartment assignments if userList changed
      if (userList) {
        // Remove subdepartment from users no longer in the list
        await client.query(`
          UPDATE "users" 
          SET "subdepartmentIds" = array_remove("subdepartmentIds", $1)
          WHERE "subdepartmentIds" @> ARRAY[$1] AND NOT ("userId" = ANY($2))
        `, [subdepartmentId, userList]);

        // Add subdepartment to new users
        for (const userId of userList) {
          await client.query(`
            UPDATE "users" 
            SET "subdepartmentIds" = array_append("subdepartmentIds", $1)
            WHERE "userId" = $2 AND NOT ($1 = ANY("subdepartmentIds"))
          `, [subdepartmentId, userId]);
        }
      }

      await client.query('COMMIT');
      res.json(updatedSubdept);
    } else {
      await client.query('ROLLBACK');
      res.status(400).json({ message: 'No updates provided' });
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating subdepartment:', error);
    res.status(500).json({ message: 'Failed to update subdepartment' });
  } finally {
    client.release();
  }
};

// Delete subdepartment
export const deleteSubdepartment = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { departmentId, subdepartmentId } = req.params;
    const userId = req.user.userId;

    await client.query('BEGIN');

    // Check user permissions
    const userResult = await client.query(`
      SELECT "isAdmin", "department" FROM "users" WHERE "userId" = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];
    const isKaryalay = user.isAdmin && user.department === 'Karyalay';

    // Verify permissions
    const subdeptCheck = await client.query(`
      SELECT s.*, d."hodUserId"
      FROM "subdepartments" s
      JOIN "departments" d ON s."departmentId" = d."departmentId"
      WHERE s."subdepartmentId" = $1 AND s."departmentId" = $2
    `, [subdepartmentId, departmentId]);

    if (subdeptCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Subdepartment not found' });
    }

    const subdepartment = subdeptCheck.rows[0];

    // Check permissions - Karyalay can delete all, HODs can delete from their departments
    if (!isKaryalay && subdepartment.hodUserId !== userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Access denied' });
    }

    // Remove subdepartment from all users
    await client.query(`
      UPDATE "users" 
      SET "subdepartmentIds" = array_remove("subdepartmentIds", $1)
      WHERE "subdepartmentIds" @> ARRAY[$1]
    `, [subdepartmentId]);

    // Delete the subdepartment
    await client.query(`
      DELETE FROM "subdepartments" WHERE "subdepartmentId" = $1
    `, [subdepartmentId]);

    await client.query('COMMIT');
    res.json({ message: 'Subdepartment deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting subdepartment:', error);
    res.status(500).json({ message: 'Failed to delete subdepartment' });
  } finally {
    client.release();
  }
}; 