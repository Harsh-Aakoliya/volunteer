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
  removeEmptyDraftController
} from '../controllers/announcementController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
// router.use(authenticateToken);

// Announcement routes
router.post('/', createAnnouncement);
router.get('/', getAnnouncements);
router.get('/debug', getAnnouncementsDebug);
router.post('/likes', updateLikes);
router.delete('/:id', deleteAnnouncement);
router.put('/:id', updateAnnouncementController);

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

export default router; 