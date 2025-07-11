// controllers/authController.js
import pool from "../config/database.js";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { UserDefinedMessageInstance } from "twilio/lib/rest/api/v2010/account/call/userDefinedMessage.js";
import { useId } from "react";

const register = async (req, res) => {
  const { mobileNumber, userId } = req.body;
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
        `INSERT INTO "users" ("mobileNumber", "userId") VALUES ($1, $2) RETURNING *`,
        [mobileNumber, userId]
      );
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
      `SELECT * FROM users WHERE "mobileNumber" = $1 AND "password" = $2`,
      [mobileNumber, password]
    );
    console.log("Database results:", result.rows);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      const userId = user.userId;
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
      
      res.json({
        success: true,
        isAdmin: user.isAdmin, // Fixed: was using isadmin (lowercase)
        token: token,
        userId: userId,
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