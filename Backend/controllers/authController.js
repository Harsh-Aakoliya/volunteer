// controllers/authController.js
import pool from "../config/datebase.js";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const register = async (req, res) => {
  const { mobileNumber, userId } = req.body;
  
  try {
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT * FROM "users" WHERE "mobileNumber" = $1',
      [mobileNumber]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'User with this mobile number already exists' 
      });
    }
    
    const result = await pool.query(
      'INSERT INTO "users" ("mobileNumber", "userId") VALUES ($1, $2) RETURNING *',
      [mobileNumber, userId]
    );  
    res.json({ success: true, message: 'Registration request sent to admin' });
  } catch (error) {
    console.log("Registration error:", error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};

const login = async (req, res) => {
  const { mobileNumber, password } = req.body;
  
  try {
    // First check if user exists
    const userExists = await pool.query(
      'SELECT * FROM "users" WHERE "mobileNumber" = $1',
      [mobileNumber]
    );
    
    if (userExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found. Please register first.'
      });
    }
    
    // Check if user is approved
    if (!userExists.rows[0].isApproved) {
      return res.status(401).json({
        success: false,
        message: 'Your account is not approved yet. Please wait for admin approval.'
      });
    }
    
    // Check password
    const result = await pool.query(
      'SELECT * FROM "users" WHERE "mobileNumber" = $1 AND "password" = $2',
      [mobileNumber, password]
    );
    
    if (result.rows.length > 0) {
      const userId = result.rows[0].userId;
      const token = jwt.sign(
        { userId: userId, isAdmin: result.rows[0].isAdmin },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      res.json({ 
        success: true, 
        isAdmin: result.rows[0].isAdmin, 
        token,
        userId: userId
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(400).json({ success: false, message: error.message });
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