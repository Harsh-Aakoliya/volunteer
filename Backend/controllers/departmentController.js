import pool from "../config/database.js";

// Get all departments created by the current admin
export const getMyDepartments = async (req, res) => {
  try {
    const createdBy = req.user.userId;

    const result = await pool.query(`
      SELECT 
        d."departmentId",
        d."departmentName",
        d."createdBy",
        d."createdAt",
        d."adminList",
        d."userList",
        u."fullName" as "createdByName"
      FROM "departments" d
      LEFT JOIN "users" u ON d."createdBy" = u."userId"
      WHERE d."createdBy" = $1
      ORDER BY d."createdAt" DESC
    `, [createdBy]);

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
    const { departmentName, userList, adminList } = req.body;
    const createdBy = req.user.userId;

    if (!departmentName || !userList || userList.length === 0) {
      return res.status(400).json({ message: 'Department name and user list are required' });
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
      INSERT INTO "departments" ("departmentName", "createdBy", "userList", "adminList")
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [departmentName, createdBy, userList, adminList || []]);

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

    const result = await pool.query(`
      SELECT 
        d."departmentId",
        d."departmentName",
        d."createdBy",
        d."createdAt",
        d."adminList",
        d."userList",
        u."fullName" as "createdByName"
      FROM "departments" d
      LEFT JOIN "users" u ON d."createdBy" = u."userId"
      WHERE d."departmentId" = $1 AND d."createdBy" = $2
    `, [departmentId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Department not found' });
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

    // Verify ownership
    const deptCheck = await client.query(`
      SELECT * FROM "departments" WHERE "departmentId" = $1 AND "createdBy" = $2
    `, [departmentId, userId]);

    if (deptCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Department not found' });
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

    // Verify ownership
    const deptCheck = await client.query(`
      SELECT * FROM "departments" WHERE "departmentId" = $1 AND "createdBy" = $2
    `, [departmentId, userId]);

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