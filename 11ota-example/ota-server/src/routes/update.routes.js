const { Router } = require('express');
const controller = require('../controllers/update.controller');
const { updateCheckLimiter } = require('../middleware/rateLimiter');

const router = Router();

// These endpoints are PUBLIC (called by client apps)
router.get('/check', updateCheckLimiter, (req, res) => controller.check(req, res));
router.get('/download/:releaseId', (req, res) => controller.download(req, res));
router.post('/report', (req, res) => controller.report(req, res));

module.exports = router;