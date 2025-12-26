import express from 'express';
import vmMediaController from '../controllers/vmMediaController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// Apply authentication middleware to all other routes
router.use(authenticateToken);

// VM Media routes for chat
router.post("/upload", vmMediaController.uploadFiles);//${API_URL}/api/vm-media/upload app/chat/[roomId].tsx -> uploadAudioFile, handleSelectFiles
router.delete("/temp/:tempFolderId/:fileName", vmMediaController.deleteFile);//${API_URL}/api/vm-media/temp/${tempFolderId}/${file.fileName} -> app/chat/create-chat-announcement.tsx ->removeFile, // app/chat/MediaUploader.tsx -> removeFile
router.delete("/temp/:tempFolderId", vmMediaController.deleteTempFolder);//${API_URL}/api/vm-media/temp/${tempFolderId} -> app/chat/create-chat-announcement.tsx ->handleDiscardAndExit, // app/chat/MediaUploader.tsx -> handleDiscardAndExit
router.post("/move-to-chat", vmMediaController.moveToChat); //${API_URL}/api/vm-media/move-to-chat app/chat/[roomId].tsx -> sendAudioMessage, // app/chat/MediaUploader.tsx -> sendToChat
router.post("/move-to-chat-announcement", vmMediaController.moveToChatAnnouncement);// app/chat/create-chat-announcement.tsx ->sendAnnouncement
router.get("/media/:mediaId", vmMediaController.getMediaById);//${API_URL}/api/vm-media/media/${mediaId} components/chat/MediaViewerModal.tsx ->fetchMediaData

export default router;