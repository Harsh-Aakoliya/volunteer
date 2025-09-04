import express from 'express';
import userController from '../controllers/userController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// User profile routes
router.get('/pending-users', userController.getPendingUsers);
router.post('/approve-user', userController.approveUser);
router.get('/:userId/profile', userController.getUserProfile);
router.put('/:userId/profile', userController.updateUserProfile);

// Sabha attendance routes
router.get('/:userId/attendance', userController.getSabhaAttendance);
router.post('/:userId/attendance', userController.recordSabhaAttendance);

// Get all users (admin only)
router.get('/all', userController.getAllUsers);

// Update user (admin only)
router.put('/update/:userId', userController.updateUser);

// Advanced search with department/subdepartment filtering
router.get('/search', userController.searchUsers);

// Get search filters (departments/subdepartments)
router.get('/search-filters', userController.getSearchFilters);

// Update user with subdepartments
router.put('/update-with-subdepartments/:userId', userController.updateUserWithSubdepartments);

// Submit attendance
// router.post('/attendance', userController.submitAttendance);

export default router; 