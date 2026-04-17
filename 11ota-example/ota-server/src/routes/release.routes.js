const { Router } = require('express');
const ctrl = require('../controllers/release.controller');
const { authenticate } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');

const router = Router();
router.use(authenticate);

router.post('/expo-upload', uploadLimiter, ctrl.uploadMiddleware, (req, res) => ctrl.expoUpload(req, res));
router.get('/:appKey/updates', (req, res) => ctrl.listUpdates(req, res));
router.post('/:updateId/rollback', (req, res) => ctrl.rollback(req, res));
router.put('/:updateId/toggle', (req, res) => ctrl.toggle(req, res));

module.exports = router;