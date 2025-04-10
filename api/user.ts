// api/user.ts
import axios from 'axios';
import { API_URL } from '@/constants/api';
import { AuthStorage } from '@/utils/authStorage';
import { User } from '@/types/type';

// api/user.ts
export const fetchUserProfile = async () => {
  try {
    const token = await AuthStorage.getToken();
    const storedUser = await AuthStorage.getUser();
    
    if (!token) {
      throw new Error('No authentication token');
    }

    if (!storedUser || !storedUser.id) {
      throw new Error('No user ID found');
    }

    const response = await axios.get(`${API_URL}/api/users/${storedUser.id}/profile`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    // console.log("response got after featching userprofile",response);

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

export const logout = async () => {
  await AuthStorage.clear();
};