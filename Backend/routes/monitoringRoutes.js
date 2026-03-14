import express from 'express';
import monitoringController from '../controllers/monitoringController.js';

const router = express.Router();

router.get('/dashboard', monitoringController.dashboard);
router.get('/sessions', monitoringController.getSessions);
router.get('/active-sessions', monitoringController.getActiveSessions);
router.post('/remote-logout', monitoringController.remoteLogout);

export default router;
