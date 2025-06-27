import express from 'express';
import { 
  createAnnouncement, 
  getAnnouncements, 
  deleteAnnouncement, 
  updateAnnouncement,
  toggleLike,
  markAsRead,
  getLikedUsers,
  getReadUsers
} from '../controllers/announcementController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
// router.use(authenticateToken);

// Announcement routes
router.post('/', createAnnouncement);
router.get('/', getAnnouncements);
router.put('/:id', updateAnnouncement);
router.delete('/:id', deleteAnnouncement);

// Like and read functionality routes
router.post('/:id/toggle-like', toggleLike);
router.post('/:id/mark-read', markAsRead);
router.get('/:id/liked-users', getLikedUsers);
router.get('/:id/read-users', getReadUsers);

export default router; 