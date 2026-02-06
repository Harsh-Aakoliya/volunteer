import express from 'express';
import { getCurrentVersion, downloadAPK } from '../controllers/versionController.js';

const router = express.Router();

// Get current version (public endpoint)
router.get('/current', getCurrentVersion);//${API_URL}/api/version/current  -> checkForUpdates


// Download APK file (public endpoint)
router.get('/download/:version', downloadAPK);// -> downloadResumable

export default router; 