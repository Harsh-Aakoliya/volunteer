const { Router } = require('express');
const ctrl = require('../controllers/app.controller');
const { authenticate } = require('../middleware/auth');

const router = Router();
router.use(authenticate);
router.post('/', (req, res) => ctrl.create(req, res));
router.get('/', (req, res) => ctrl.list(req, res));
router.get('/:appKey', (req, res) => ctrl.get(req, res));
router.delete('/:appKey', (req, res) => ctrl.delete(req, res));
module.exports = router;