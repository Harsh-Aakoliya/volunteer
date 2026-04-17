const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const database = require('../database');
const { generateApiKey } = require('../utils/helpers');

class AuthController {
  register(req, res) {
    try {
      const { username, email, password } = req.body;
      if (!username || !email || !password) {
        return res.status(400).json({ success: false, error: 'All fields required' });
      }

      const db = database.getDb();
      const passwordHash = bcrypt.hashSync(password, 12);
      const apiKey = generateApiKey();

      const result = db.prepare(
        'INSERT INTO users (username, email, password_hash, api_key) VALUES (?, ?, ?, ?)'
      ).run(username, email, passwordHash, apiKey);

      const token = jwt.sign(
        { userId: result.lastInsertRowid },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn }
      );

      res.status(201).json({
        success: true,
        data: {
          user: { id: result.lastInsertRowid, username, email, apiKey },
          token,
        },
      });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ success: false, error: 'User already exists' });
      }
      throw error;
    }
  }

  login(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'email and password required' });
    }

    const db = database.getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

    res.json({
      success: true,
      data: {
        user: { id: user.id, username: user.username, email: user.email, apiKey: user.api_key },
        token,
      },
    });
  }

  me(req, res) {
    res.json({
      success: true,
      data: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        apiKey: req.user.api_key,
      },
    });
  }
}

module.exports = new AuthController();