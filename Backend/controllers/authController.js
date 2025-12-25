// controllers/authController.js
import pool from "../config/database.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

// ==================== LOGIN ====================
const login = async (req, res) => {
  const { mobileNumber, password } = req.body;
  console.log("Login attempt:", mobileNumber, password);

  try {
    // Validate input
    if (!mobileNumber || !password) {
      return res.status(400).json({
        success: false,
        message: "Mobile number and password are required",
      });
    }

    // Find user by mobile number
    const result = await pool.query(
      `SELECT * FROM "SevakMaster" WHERE "mobileno" = $1`,
      [mobileNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Mobile number not registered. Please contact Sevak Karyalay.",
      });
    }

    const sevak = result.rows[0];
    console.log("Sevak found:", sevak.seid);

    // Check if password is set
    if (!sevak.password) {
      console.log("Password not set");
      return res.status(400).json({
        success: false,
        message: "Password not set. Please set your password first.",
      });
    }

    // Verify password (comparing plain text - consider using bcrypt for production)
    if (sevak.password !== password) {
      console.log("Incorrect password");
      return res.status(401).json({
        success: false,
        message: "Incorrect password. Please check and try again.",
      });
    }

    // Check login permission
    const canlogin = sevak.canlogin;
    if (canlogin !== 1) {
      console.log("canlogin", canlogin);
      console.log("Access denied. Please contact Sevak Karyalay.");
      return res.status(403).json({
        success: false,
        message: "Access denied. Please contact Sevak Karyalay.",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: sevak.seid, role: sevak.usertype },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Remove sensitive data before sending
    const sevakData = { ...sevak };
    delete sevakData.password;

    res.json({
      success: true,
      message: "Login successful",
      token: token,
      sevak: sevakData,
    });
  } catch (error) {
    console.error("Login error in backend:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

// ==================== CHECK MOBILE EXISTS ====================
const checkMobileExists = async (req, res) => {
  const { mobileNumber } = req.body;
  console.log("Check mobile exists request:", mobileNumber);

  try {
    // Validate input
    if (!mobileNumber) {
      return res.status(400).json({
        success: false,
        exists: false,
        isPasswordSet: false,
        message: "Mobile number is required",
      });
    }

    const result = await pool.query(
      `SELECT "seid", "mobileno", "password", "canlogin" FROM "SevakMaster" WHERE "mobileno" = $1`,
      [mobileNumber]
    );

    const isMobileNumberExists = result.rows.length > 0;

    if (isMobileNumberExists) {
      const sevak = result.rows[0];
      const isPasswordSet = sevak.password !== null && sevak.password !== "";
      const canlogin = sevak.canlogin;
      if(canlogin !== 1) {
        res.json({
          success: false,
          exists: true,
          isPasswordSet: isPasswordSet,
          canlogin: canlogin,
          message: "Access denied. Please contact Sevak Karyalay.",
        });
      } 
      else { // if is possword is set then show password input else show set password input
        res.json({
          success: true,
          exists: true,
          isPasswordSet: isPasswordSet,
          canlogin: canlogin,
          message: "Mobile number found",
        });
      }
    } else {
      res.json({
        success: true,
        exists: false,
        isPasswordSet: false,
        canlogin: 0,
        message: "Mobile number not registered. Please contact Sevak Karyalay.",
      });
    }
  } catch (error) {
    console.error("Check mobile error:", error);
    res.status(500).json({
      success: false,
      exists: false,
      isPasswordSet: false,
      canlogin: 0,
      message: "Server error. Please try again later.",
    });
  }
};

// ==================== SET PASSWORD ====================
const setPassword = async (req, res) => {
  const { mobileNumber, password } = req.body;
  console.log("Set password request for:", mobileNumber);

  try {
    // Validate input
    if (!mobileNumber || !password) {
      return res.status(400).json({
        success: false,
        message: "Mobile number and password are required",
      });
    }

    // Validate password length
    if (password.length < 4) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 4 characters long",
      });
    }

    if (password.length > 20) {
      return res.status(400).json({
        success: false,
        message: "Password must be less than 20 characters",
      });
    }

    // Find user by mobile number
    const findResult = await pool.query(
      `SELECT * FROM "SevakMaster" WHERE "mobileno" = $1`,
      [mobileNumber]
    );

    if (findResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Mobile number not registered. Please contact Sevak Karyalay.",
      });
    }

    const sevak = findResult.rows[0];

    // Check if password is already set
    // if (sevak.password !== null && sevak.password !== "") {
    //   return res.status(409).json({
    //     success: false,
    //     message: "Password is already set. Please use login instead.",
    //   });
    // }

    // Check login permission
    if (sevak.canlogin !== 1) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Please contact Sevak Karyalay.",
      });
    }

    // Update password in database
    // Note: For production, consider hashing the password with bcrypt
    const updateResult = await pool.query(
      `UPDATE "SevakMaster" SET "password" = $1 WHERE "mobileno" = $2 RETURNING *`,
      [password, mobileNumber]
    );

    if (updateResult.rows.length === 0) {
      return res.status(500).json({
        success: false,
        message: "Failed to set password. Please try again.",
      });
    }

    const updatedSevak = updateResult.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { userId: updatedSevak.seid, role: updatedSevak.usertype },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Remove sensitive data before sending
    const sevakData = { ...updatedSevak };
    delete sevakData.password;

    console.log("Password set successfully for:", mobileNumber);

    res.json({
      success: true,
      message: "Password set successfully",
      token: token,
      sevak: sevakData,
    });
  } catch (error) {
    console.error("Set password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

// ==================== CHECK USER ====================
const checkUser = async (req, res) => {
  const { mobileNumber } = req.body;

  try {
    const result = await pool.query(
      'SELECT * FROM "users" WHERE "mobile_number" = $1',
      [mobileNumber]
    );

    if (result.rows.length > 0) {
      res.json({
        exists: true,
      });
    } else {
      res.json({ exists: false });
    }
  } catch (error) {
    console.error("Check user error:", error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};

// ==================== REGISTER ====================
const register = async (req, res) => {
  const { mobileNumber, userId, fullName } = req.body;

  try {
    // Add your registration logic here
    res.json({
      success: true,
      message: "Registration successful",
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
    });
  }
};

// ==================== CHANGE PASSWORD ====================
const changePassword = async (req, res) => {
  const { mobileNumber, currentPassword, newPassword } = req.body;

  try {
    if (!mobileNumber || !currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Mobile number, current password, and new password are required",
      });
    }

    const userResult = await pool.query(
      `SELECT * FROM "SevakMaster" WHERE "mobileno" = $1`,
      [mobileNumber]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Mobile number not registered. Please contact Sevak Karyalay.",
      });
    }

    const sevak = userResult.rows[0];

    if (sevak.canlogin !== 1) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Please contact Sevak Karyalay.",
      });
    }

    if (sevak.password !== currentPassword) {
      return res.status(401).json({
        success: false,
        message: "Current password mismatch",
      });
    }

    await pool.query(
      `UPDATE "SevakMaster" SET "password" = $1, "modifiedon" = NOW() WHERE "mobileno" = $2`,
      [newPassword, mobileNumber]
    );

    res.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

export default { register, login, checkUser, checkMobileExists, setPassword, changePassword };