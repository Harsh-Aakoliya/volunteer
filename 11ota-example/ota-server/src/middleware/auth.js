const jwt = require('jsonwebtoken');
const config = require('../config');
const database = require('../database');

function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'];

    if (apiKey) {
      const db = database.getDb();
      const user = db.prepare('SELECT * FROM users WHERE api_key = ?').get(apiKey);
      if (!user) return res.status(401).json({ success: false, error: 'Invalid API key' });
      req.user = user;
      return next();
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Auth required' });
    }

    const decoded = jwt.verify(authHeader.substring(7), config.jwtSecret);
    const db = database.getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
    if (!user) return res.status(401).json({ success: false, error: 'User not found' });

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

module.exports = { authenticate };