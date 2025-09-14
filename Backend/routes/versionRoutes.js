import express from 'express';
import { getCurrentVersion, downloadAPK, updateVersion } from '../controllers/versionController.js';

const router = express.Router();

// Get current version (public endpoint)
router.get('/current', getCurrentVersion);

// Download APK file (public endpoint)
router.get('/download/:version', downloadAPK);

// Update version (admin endpoint - you might want to add authentication)
router.post('/update', updateVersion);

export default router; 