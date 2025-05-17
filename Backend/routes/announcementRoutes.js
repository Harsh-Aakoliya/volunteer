import express from 'express';
import { 
  createAnnouncement, 
  getAnnouncements, 
  updateLikes, 
  deleteAnnouncement, 
  updateAnnouncementController 
} from '../controllers/announcementController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
// router.use(authenticateToken);

// Announcement routes
router.post('/', createAnnouncement);
router.get('/', getAnnouncements);
router.post('/likes', updateLikes);
router.delete('/:id', deleteAnnouncement);
router.put('/:id', updateAnnouncementController);

export default router; 