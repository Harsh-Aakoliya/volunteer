import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import vmMediaController from '../controllers/vmMediaController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// --- MULTER CONFIGURATION ---

// 1. General Storage (Used for temporary holding before move)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Save to a general uploads folder first
    const uploadDir = path.join(process.cwd(), 'uploads', 'temp');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique name
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

// --- ROUTES ---

// 1. Gallery Upload (Multipart - Multiple Files)
// Frontend sends FormData with 'files' array
router.post("/upload-multipart", upload.array('files'), vmMediaController.uploadFilesMultipart);

// 2. Camera Upload (Multipart - Single File + Direct Chat)
// Frontend sends FormData with 'file' single
router.post("/move-to-chat-camera", upload.single('file'), vmMediaController.moveToChatCamera);

// 3. Existing Base64 Route (Keep for backward compatibility if needed, or remove)
router.post("/upload", vmMediaController.uploadFiles);

// 4. Standard Operations
router.delete("/temp/:tempFolderId/:fileName", vmMediaController.deleteFile);
router.delete("/temp/:tempFolderId", vmMediaController.deleteTempFolder);
router.post("/move-to-chat", vmMediaController.moveToChat); // Existing logic used by Gallery Flow
router.post("/move-to-chat-announcement", vmMediaController.moveToChatAnnouncement);
router.get("/media/:mediaId", vmMediaController.getMediaById);

export default router;