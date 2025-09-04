// api/department.ts
import axios from 'axios';
import { API_URL } from '@/constants/api';
import { AuthStorage } from '@/utils/authStorage';
import { 
  Department, 
  DepartmentUser, 
  CreateDepartmentRequest, 
  UpdateDepartmentRequest,
  Subdepartment,
  CreateSubdepartmentRequest,
  UpdateSubdepartmentRequest
} from '@/types/type';

// Get all departments created by current admin
export const fetchMyDepartments = async (): Promise<Department[]> => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) throw new Error('No authentication token');

    const response = await axios.get(`${API_URL}/api/departments/my-departments`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching departments:', error);
    throw error;
  }
};

// Get all users for department creation/management
export const fetchAllUsers = async (): Promise<DepartmentUser[]> => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) throw new Error('No authentication token');

    const response = await axios.get(`${API_URL}/api/departments/users`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

// Create a new department
export const createDepartment = async (departmentData: CreateDepartmentRequest): Promise<Department> => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) throw new Error('No authentication token');

    const response = await axios.post(`${API_URL}/api/departments`, departmentData, {
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error creating department:', error);
    throw error;
  }
};

// Get department details by ID
export const fetchDepartmentById = async (departmentId: string): Promise<Department> => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) throw new Error('No authentication token');

    const response = await axios.get(`${API_URL}/api/departments/${departmentId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching department:', error);
    throw error;
  }
};

// Update department (add/remove users)
export const updateDepartment = async (departmentData: UpdateDepartmentRequest): Promise<Department> => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) throw new Error('No authentication token');

    const response = await axios.put(`${API_URL}/api/departments/${departmentData.departmentId}`, departmentData, {
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error updating department:', error);
    throw error;
  }
};

// Delete department
export const deleteDepartment = async (departmentId: string): Promise<void> => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) throw new Error('No authentication token');

    await axios.delete(`${API_URL}/api/departments/${departmentId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch (error) {
    console.error('Error deleting department:', error);
    throw error;
  }
};

// Remove user from department
export const removeUserFromDepartment = async (departmentId: string, userId: string): Promise<void> => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) throw new Error('No authentication token');

    await axios.delete(`${API_URL}/api/departments/${departmentId}/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch (error) {
    console.error('Error removing user from department:', error);
    throw error;
  }
};

// Check if department name exists
export const checkDepartmentNameExists = async (departmentName: string): Promise<boolean> => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) throw new Error('No authentication token');

    const response = await axios.get(`${API_URL}/api/departments/check-name/${encodeURIComponent(departmentName)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    return response.data.exists;
  } catch (error) {
    console.error('Error checking department name:', error);
    throw error;
  }
};

// Subdepartment API functions

// Get all subdepartments for a department
export const fetchSubdepartments = async (departmentId: string): Promise<Subdepartment[]> => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) throw new Error('No authentication token');

    const response = await axios.get(`${API_URL}/api/departments/${departmentId}/subdepartments`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching subdepartments:', error);
    throw error;
  }
};

// Create a new subdepartment
export const createSubdepartment = async (
  departmentId: string, 
  subdepartmentData: CreateSubdepartmentRequest
): Promise<Subdepartment> => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) throw new Error('No authentication token');

    const response = await axios.post(
      `${API_URL}/api/departments/${departmentId}/subdepartments`, 
      subdepartmentData, 
      {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error creating subdepartment:', error);
    throw error;
  }
};

// Update subdepartment
export const updateSubdepartment = async (
  departmentId: string,
  subdepartmentId: string,
  subdepartmentData: UpdateSubdepartmentRequest
): Promise<Subdepartment> => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) throw new Error('No authentication token');

    const response = await axios.put(
      `${API_URL}/api/departments/${departmentId}/subdepartments/${subdepartmentId}`, 
      subdepartmentData, 
      {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error updating subdepartment:', error);
    throw error;
  }
};

// Delete subdepartment
export const deleteSubdepartment = async (departmentId: string, subdepartmentId: string): Promise<void> => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) throw new Error('No authentication token');

    await axios.delete(`${API_URL}/api/departments/${departmentId}/subdepartments/${subdepartmentId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch (error) {
    console.error('Error deleting subdepartment:', error);
    throw error;
  }
}; 