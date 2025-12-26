import express from 'express';
import { getCurrentVersion, downloadAPK } from '../controllers/versionController.js';

const router = express.Router();

// Get current version (public endpoint)
router.get('/current', getCurrentVersion);//${API_URL}/api/version/current //utils/updateChecker.ts -> checkForUpdates


// Download APK file (public endpoint)
router.get('/download/:version', downloadAPK);//utils/updateChecker.ts -> downloadResumable

export default router; 