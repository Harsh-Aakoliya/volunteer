// controllers/authController.js
import pool from "../config/database.js";
import jwt from 'jsonwebtoken';

const register = async (req, res) => {
  const { mobileNumber, userId, fullName } = req.body;
  console.log("register ",mobileNumber,userId);
  //first checking if user is already exists or not
  try {
    const result = await pool.query(
      `SELECT * FROM users WHERE "mobileNumber" = $1 OR "userId" = $2`,
      [mobileNumber, userId]
    );
    console.log("response",result.rows);
    if (result.rows.length > 0) {
      const DB_mobileNumber = result.rows[0].mobileNumber;
      const DB_userId = result.rows[0].userId;
      if (DB_mobileNumber === mobileNumber)
        res.json({ success: false, message: "Mobile number already registed" });
      if (DB_userId === userId)
        res.json({ success: false, message: "User id already registed" });

      res.json({ success: false, message: "Not able to capture" }); //this case will not arise
    } else {
      const result = await pool.query(
        `INSERT INTO "users" ("mobileNumber", "userId", "fullName") VALUES ($1, $2, $3) RETURNING *`,
        [mobileNumber, userId, fullName]
      );
      console.log("result",result.rows);
      console.log("inserted successfully");
      res.json({
        success: true,
        message: "Registration request sent to admin",
      });
    }
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// controllers/authController.js
const login = async (req, res) => {
  const { mobileNumber, password, sevakId } = req.body;
  
  // Check if this is a web login (sevakId provided) or mobile login (mobileNumber provided)
  const isWebLogin = !!sevakId;
  
  console.log(`Login attempt (${isWebLogin ? 'web' : 'mobile'}):`, isWebLogin ? sevakId : mobileNumber);
  
  try {
    let result;
    
    if (isWebLogin) {
      // Web login: authenticate using sevakId and password
      result = await pool.query(
        `SELECT * FROM users WHERE "sevakId" = $1 AND "password" = $2`,
        [sevakId, password]
      );
    } else {
      // Mobile login: authenticate using mobileNumber and password
      result = await pool.query(
        `SELECT * FROM users WHERE "mobileNumber" = $1 AND "password" = $2`,
        [mobileNumber, password]
      );
    }
    
    console.log("Database results:", result.rows);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      const userId = user.userId;
      
      // For web login, check webpermissions
      if (isWebLogin) {
        const webPermissionsResult = await pool.query(
          `SELECT * FROM webpermissions WHERE "userId" = $1`,
          [userId]
        );
        
        if (webPermissionsResult.rows.length === 0) {
          return res.json({
            success: false,
            message: "You do not have permission to access the web portal.",
          });
        }
        
        const webPermissions = webPermissionsResult.rows[0];
        const isApproved = user.isApproved;
        
        if (!isApproved) {
          return res.json({
            success: false,
            message: "User is not approved, wait for Admin approval",
          });
        }
        
        const token = jwt.sign(
          { userId: userId, isAdmin: user.isAdmin, isWebUser: true },
          process.env.JWT_SECRET
        );
        
        return res.json({
          success: true,
          isAdmin: user.isAdmin,
          token: token,
          userId: userId,
          webPermissions: {
            accessLevel: webPermissions.accessLevel,
            canCreateAnnouncement: webPermissions.canCreateAnnouncement,
            canCreateChatGroup: webPermissions.canCreateChatGroup,
            canEditUserProfile: webPermissions.canEditUserProfile,
            canEditDepartments: webPermissions.canEditDepartments,
          },
        });
      } else {
        // Mobile login - existing logic
        const isApproved = user.isApproved;
        
        if (!isApproved) {
          return res.json({
            success: false,
            message: "User is not approved, wait for Admin approval",
          });
        }
        
        const token = jwt.sign(
          { userId: userId, isAdmin: user.isAdmin },
          process.env.JWT_SECRET
        );
        
        return res.json({
          success: true,
          isAdmin: user.isAdmin,
          token: token,
          userId: userId,
        });
      }
    } else {
      res.json({
        success: false,
        message: "Invalid credentials. User not found.",
      });
    }
  } catch (error) {
    console.error("Login error in backend:", error);
    res.status(500).json({ success: false, message: "Server error. Please try again." });
  }
};

const checkUser = async (req, res) => {
  const { mobileNumber } = req.body;
  
  try {
    const result = await pool.query(
      'SELECT * FROM "users" WHERE "mobileNumber" = $1',
      [mobileNumber]
    );
    
    if (result.rows.length > 0) {
      res.json({ 
        exists: true, 
        isApproved: result.rows[0].isApproved 
      });
    } else {
      res.json({ exists: false });
    }
  } catch (error) {
    console.error("Check user error:", error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};

export default { register, login, checkUser };