// api/user.ts
import axios from 'axios';
import { API_URL } from '@/constants/api';
import { AuthStorage } from '@/utils/authStorage';
import { User, SearchUsersRequest, SearchUsersResponse, SearchFiltersResponse } from '@/types/type';

// api/user.ts
export const fetchUserProfile = async () => {
  try {
    const token = await AuthStorage.getToken();
    const storedUser = await AuthStorage.getUser();

    console.log("token", token);
    console.log("storedUser", storedUser);

    // return storedUser as any;
    if (!token) {
      throw new Error('No authentication token');
    }

    if (!storedUser || !storedUser.seid) {
      throw new Error('No user userId found');
    }

    const response = await axios.get(`${API_URL}/api/users/${storedUser.seid}/profile`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log("response got after featching userprofile",response.data);

    // Store the updated profile
    await AuthStorage.storeUser(response.data);

    return response.data;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    
    // If profile fetch fails, return stored user data
    const storedUser = await AuthStorage.getUser();
    if (storedUser) {
      return storedUser;
    }
    
    throw error;
  }
};

// Fetch Sabha attendance records for current user
export const fetchSabhaAttendance = async () => {
  try {
    const token = await AuthStorage.getToken();
    const storedUser = await AuthStorage.getUser();
    
    if (!token) {
      throw new Error('No authentication token');
    }

    if (!storedUser || !storedUser.userId) {
      throw new Error('No user userId found');
    }

    const response = await axios.get(`${API_URL}/api/users/${storedUser.userId}/attendance`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching sabha attendance:', error);
    throw error;
  }
};

// Fetch Sabha attendance records for specific user
export const fetchSabhaAttendanceForUser = async (userId: string) => {
  try {
    const token = await AuthStorage.getToken();
    
    if (!token) {
      throw new Error('No authentication token');
    }

    const response = await axios.get(`${API_URL}/api/users/${userId}/attendance`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching sabha attendance for user:', error);
    throw error;
  }
};

export const logout = async () => {
  try {
    await AuthStorage.clear();
    
    console.log('Logout successful - cache cleared');
  } catch (error) {
    console.error('Error during logout:', error);
  }
};

// Advanced search for users with department/subdepartment filtering
export const searchUsers = async (searchParams: SearchUsersRequest): Promise<SearchUsersResponse> => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) throw new Error('No authentication token');

    const queryParams = new URLSearchParams();
    
    if (searchParams.searchQuery) {
      queryParams.append('searchQuery', searchParams.searchQuery);
    }
    
    if (searchParams.departmentIds && searchParams.departmentIds.length > 0) {
      searchParams.departmentIds.forEach(id => queryParams.append('departmentIds', id));
    }
    
    if (searchParams.subdepartmentIds && searchParams.subdepartmentIds.length > 0) {
      searchParams.subdepartmentIds.forEach(id => queryParams.append('subdepartmentIds', id));
    }
    
    if (searchParams.page) {
      queryParams.append('page', searchParams.page.toString());
    }
    
    if (searchParams.limit) {
      queryParams.append('limit', searchParams.limit.toString());
    }

    const response = await axios.get(`${API_URL}/api/users/search?${queryParams.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    return response.data;
  } catch (error) {
    console.error('Error searching users:', error);
    throw error;
  }
};

// Get search filters (departments and subdepartments for current user)
export const getSearchFilters = async (): Promise<SearchFiltersResponse> => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) throw new Error('No authentication token');

    const response = await axios.get(`${API_URL}/api/users/search-filters`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching search filters:', error);
    throw error;
  }
};

// Get all search data (users, departments, subdepartments) in one call
export const getAllSearchData = async (): Promise<{
  users: User[];
  departments: Array<{departmentId: string, departmentName: string}>;
  subdepartments: Array<{subdepartmentId: string, subdepartmentName: string, departmentId: string}>;
  userRole: {isKaryalay: boolean, isHOD: boolean};
}> => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) throw new Error('No authentication token');

    const response = await axios.get(`${API_URL}/api/users/all-search-data`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching all search data:', error);
    throw error;
  }
};

// Get all users for dashboard (admin/master only)
export const getAllUsersForDashboard = async (): Promise<User[]> => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) throw new Error('No authentication token');

    const response = await axios.get(`${API_URL}/api/users/all`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching all users for dashboard:', error);
    throw error;
  }
};

// Get specific user profile by ID
export const getUserProfileById = async (userId: string) => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) throw new Error('No authentication token');

    const response = await axios.get(`${API_URL}/api/users/${userId}/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("response got after featching userprofile by id",response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching user profile by ID:', error);
    throw error;
  }
};

// Update user with subdepartment assignments
export const updateUserWithSubdepartments = async (userId: string, userData: any) => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) throw new Error('No authentication token');

    const response = await axios.put(
      `${API_URL}/api/users/update-with-subdepartments/${userId}`, 
      userData, 
      {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error updating user with subdepartments:', error);
    throw error;
  }
};