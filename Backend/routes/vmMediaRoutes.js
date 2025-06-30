import express from 'express';
import vmMediaController from '../controllers/vmMediaController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Legacy folder creation (keep for backward compatibility)
router.post("/createfolder", vmMediaController.createFolder);

// VM Media routes for chat
router.post("/upload", vmMediaController.uploadFiles);
router.get("/temp/:tempFolderId", vmMediaController.getTempFiles);
router.delete("/temp/:tempFolderId/:fileName", vmMediaController.deleteFile);
router.delete("/temp/:tempFolderId", vmMediaController.deleteTempFolder);
router.post("/move-to-chat", vmMediaController.moveToChat);
router.get("/file/:folderName/:fileName", vmMediaController.getFile);

export default router;