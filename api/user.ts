// api/user.ts
import axios from 'axios';
import { API_URL } from '@/constants/api';
import { AuthStorage } from '@/utils/authStorage';

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
    await AuthStorage.storeUser({
      userId: response.data.seid,
      mobileNumber: response.data.mobileno,
      name: response.data.sevakname,
      fullName: response.data.sevakname,
      role: response.data.usertype,
      ...response.data
    });

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
  try {
    await AuthStorage.clear();
  } catch (error) {
    console.error('Error during logout:', error);
  }
};
