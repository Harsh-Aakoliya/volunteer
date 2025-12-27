// middleware/auth.js
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
export const authenticateToken = async(req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  console.log("authHeader", authHeader);
  console.log("token", token);
  if (!token) {
    return res.status(401).json({ message: 'Authentication token required' });
  }

  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET environment variable is not set');
    return res.status(500).json({ message: 'Server configuration error' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // This will contain { userId: '...', role: 'master'|'admin'|'sevak' }
    next();
  } catch (error) {
    console.error('JWT verification error:', error);
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};