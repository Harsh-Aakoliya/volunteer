import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import vmMediaController from '../controllers/vmMediaController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// Apply authentication middleware to all other routes
router.use(authenticateToken);

// Configure multer for camera uploads (single file)
const cameraStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'camera');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname) || (file.mimetype?.includes('video') ? '.mp4' : '.jpg');
    cb(null, `camera_${timestamp}${ext}`);
  }
});

const cameraUpload = multer({ 
  storage: cameraStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'), false);
    }
  }
});

// VM Media routes for chat
router.post("/upload", vmMediaController.uploadFiles);//${API_URL}/api/vm-media/upload app/chat/[roomId].tsx -> uploadAudioFile, handleSelectFiles
router.delete("/temp/:tempFolderId/:fileName", vmMediaController.deleteFile);//${API_URL}/api/vm-media/temp/${tempFolderId}/${file.fileName} -> app/chat/create-chat-announcement.tsx ->removeFile, // app/chat/MediaUploader.tsx -> removeFile
router.delete("/temp/:tempFolderId", vmMediaController.deleteTempFolder);//${API_URL}/api/vm-media/temp/${tempFolderId} -> app/chat/create-chat-announcement.tsx ->handleDiscardAndExit, // app/chat/MediaUploader.tsx -> handleDiscardAndExit
router.post("/move-to-chat", vmMediaController.moveToChat); //${API_URL}/api/vm-media/move-to-chat app/chat/[roomId].tsx -> sendAudioMessage, // app/chat/MediaUploader.tsx -> sendToChat
router.post("/move-to-chat-announcement", vmMediaController.moveToChatAnnouncement);// app/chat/create-chat-announcement.tsx ->sendAnnouncement
// Camera upload route with error handling middleware
router.post("/move-to-chat-camera", (req, res, next) => {
  cameraUpload.single('file')(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }
    next();
  });
}, vmMediaController.moveToChatCamera);// app/chat/[roomId]/attachments.tsx -> handleCameraSend
router.get("/media/:mediaId", vmMediaController.getMediaById);//${API_URL}/api/vm-media/media/${mediaId} components/chat/MediaViewerModal.tsx ->fetchMediaData

export default router;