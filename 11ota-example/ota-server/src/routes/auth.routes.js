const { Router } = require('express');
const ctrl = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

const router = Router();
router.post('/register', authLimiter, (req, res) => ctrl.register(req, res));
router.post('/login', authLimiter, (req, res) => ctrl.login(req, res));
router.get('/me', authenticate, (req, res) => ctrl.me(req, res));
module.exports = router;