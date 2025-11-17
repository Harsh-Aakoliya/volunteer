// controllers/authController.js
import pool from "../config/database.js";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { UserDefinedMessageInstance } from "twilio/lib/rest/api/v2010/account/call/userDefinedMessage.js";
import { useId } from "react";

const register = async (req, res) => {
  const { mobileNumber, fullName } = req.body;
  console.log("register ",mobileNumber);
  //first checking if user is already exists or not
  try {
    const result = await pool.query(
      `SELECT * FROM users WHERE "mobile_number" = $1`,
      [mobileNumber]
    );
    console.log("response",result.rows);
    if (result.rows.length > 0) {
      res.json({ success: false, message: "Mobile number already registed" });
    } else {
      // Create user with default role 'sevak' - admin/master can update role later
      const result = await pool.query(
        `INSERT INTO "users" ("mobile_number", "full_name", "role") VALUES ($1, $2, $3) RETURNING *`,
        [mobileNumber, fullName, 'sevak']
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
  const { mobileNumber, password } = req.body;
  console.log("Login attempt:", mobileNumber, password);
  
  try {
    const result = await pool.query(
      `SELECT * FROM users WHERE "mobile_number" = $1 AND "password" = $2`,
      [mobileNumber, password]
    );
    console.log("Database results:", result.rows);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      
      const token = jwt.sign(
        { userId: user.user_id, role: user.role },
        process.env.JWT_SECRET
      );
      
      res.json({
        success: true,
        token: token,
        user:user,
      });
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
      'SELECT * FROM "users" WHERE "mobile_number" = $1',
      [mobileNumber]
    );
    
    if (result.rows.length > 0) {
      res.json({ 
        exists: true
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