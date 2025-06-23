// Backend/routes/departmentRoutes.js
import express from 'express';
import {
  getMyDepartments,
  getAllUsers,
  createDepartment,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
  removeUserFromDepartment,
  checkDepartmentNameExists
} from '../controllers/departmentController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// All department routes require authentication
router.use(authenticateToken);

// Get all departments created by current admin
router.get('/my-departments', getMyDepartments);

// Get all users for department management
router.get('/users', getAllUsers);

// Check if department name exists
router.get('/check-name/:departmentName', checkDepartmentNameExists);

// Get department by ID
router.get('/:departmentId', getDepartmentById);

// Create new department
router.post('/', createDepartment);

// Update department
router.put('/:departmentId', updateDepartment);

// Delete department
router.delete('/:departmentId', deleteDepartment);

// Remove user from department
router.delete('/:departmentId/users/:userId', removeUserFromDepartment);

export default router; 