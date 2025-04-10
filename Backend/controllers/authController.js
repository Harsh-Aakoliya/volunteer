// const pool = require('../config/database');
// const jwt = require('jsonwebtoken');
// const bcrypt = require('bcryptjs');
// const twilioClient = require('../config/twilio');
import pool from "../config/datebase.js";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
// import twilioClient from '../config/twilio.js';

const register = async (req, res) => {
  const { mobileNumber, specificId } = req.body;
  
  try {
    const result = await pool.query(
      'INSERT INTO users (mobile_number, specific_id) VALUES ($1, $2) RETURNING *',
      [mobileNumber, specificId]
    );  
    res.json({ success: true, message: 'Registration request sent to admin' });
  } catch (error) {
    console.log("Not possible");
    console.log(error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};

// controllers/authController.js
const login = async (req, res) => {
  const { mobileNumber, password } = req.body;
  // console.log("at backend", mobileNumber, password);

  // // Check admin credentials
  // if (mobileNumber === process.env.ADMIN_MOBILE && 
  //     password === process.env.ADMIN_PASSWORD) {
  //   console.log("yes its admin");
  //   const token = jwt.sign(
  //     { isAdmin: true },
  //     process.env.JWT_SECRET,
  //     { expiresIn: '24h' }
  //   );
  //   return res.json({
  //     success: true,
  //     isAdmin: true,
  //     token,
  //     userId: null // Admin doesn't need a userId
  //   });
  // }
  
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE mobile_number = $1 AND password = $2 AND is_approved = TRUE',
      [mobileNumber, password]
    );
    // console.log("result", result.rows);
    
    if (result.rows.length > 0) {
      const userId = result.rows[0].specific_id;
      // console.log("userId at backend",userId);
      // console.log("Is it admin",result.rows[0].isadmin );
      const token = jwt.sign(
        { userId: userId, isAdmin: result.rows[0].isadmin },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      res.json({ 
        success: true, 
        isAdmin: result.rows[0].isadmin , 
        token,
        userId: userId // Include userId in response
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials or user not approved'
      });
    }
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export default { register, login };