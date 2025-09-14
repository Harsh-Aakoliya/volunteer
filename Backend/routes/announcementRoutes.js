import express from 'express';
import { 
  createAnnouncement, 
  getAnnouncements, 
  getAnnouncementsDebug,
  updateLikes, 
  deleteAnnouncement, 
  updateAnnouncementController,
  toggleLike,
  markAsRead,
  getLikedUsers,
  getReadUsers,
  createDraftController,
  updateDraftController,
  publishDraftController,
  getDraftsController,
  deleteDraftController,
  removeEmptyDraftController,
  uploadCoverImageController,
  uploadAnnouncementMediaController,
  getAnnouncementMediaController,
  deleteAnnouncementMediaController,
  getAllDepartmentsController,
  getAnnouncementDetailsController,
  getUserAnnouncementsController
} from '../controllers/announcementController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Announcement routes
router.post('/', createAnnouncement);
router.get('/', getAnnouncements);
router.get('/debug', getAnnouncementsDebug);
router.post('/likes', updateLikes);
router.delete('/:id', deleteAnnouncement);
router.put('/:id', updateAnnouncementController);

// Cover image upload route
router.post('/cover-image', uploadCoverImageController);

// Media files routes
router.post('/:id/media/upload', uploadAnnouncementMediaController);
router.get('/:id/media', getAnnouncementMediaController);
router.delete('/:id/media/:fileName', deleteAnnouncementMediaController);

// New routes for like/read functionality
router.post('/:id/toggle-like', toggleLike);
router.post('/:id/mark-read', markAsRead);
router.get('/:id/liked-users', getLikedUsers);
router.get('/:id/read-users', getReadUsers);

// New draft routes
router.post('/draft', createDraftController);
router.put('/draft/:id', updateDraftController);
router.put('/draft/:id/publish', publishDraftController);
router.get('/drafts/:authorId', getDraftsController);
router.delete('/draft/:id', deleteDraftController);
router.delete('/draft/:id/empty', removeEmptyDraftController);

// Get all departments
router.get('/departments', getAllDepartmentsController);

// Get user-specific announcements based on user type
router.get('/user-announcements', getUserAnnouncementsController);

// Get announcement details with recipients
router.get('/:id/details', getAnnouncementDetailsController);

export default router; 