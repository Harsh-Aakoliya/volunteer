const { Router } = require('express');
const ctrl = require('../controllers/expo.controller');
const { manifestLimiter } = require('../middleware/rateLimiter');
const { authenticate } = require('../middleware/auth');

const router = Router();

// ── PUBLIC endpoints (called by expo-updates in client apps) ──
router.get('/manifest', manifestLimiter, (req, res) => ctrl.getManifest(req, res));
router.get('/assets/:updateId/:assetKey', (req, res) => ctrl.getAsset(req, res));
router.post('/report', (req, res) => ctrl.report(req, res));

// ── AUTHENTICATED endpoints ──
router.get('/stats/:appKey', authenticate, (req, res) => ctrl.stats(req, res));

module.exports = router;