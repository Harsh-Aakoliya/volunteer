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
  checkDepartmentNameExists,
  getSubdepartments,
  createSubdepartment,
  updateSubdepartment,
  deleteSubdepartment
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

// Subdepartment routes
router.get('/:departmentId/subdepartments', getSubdepartments);
router.post('/:departmentId/subdepartments', createSubdepartment);
router.put('/:departmentId/subdepartments/:subdepartmentId', updateSubdepartment);
router.delete('/:departmentId/subdepartments/:subdepartmentId', deleteSubdepartment);

export default router; 