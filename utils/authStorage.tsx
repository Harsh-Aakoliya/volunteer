// utils/authStorage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@/types/type';

export const AuthStorage = {
  // Store user token
  async storeToken(token: string) {
    await AsyncStorage.setItem('userToken', token);
  },

  // Get user token
  async getToken(): Promise<string | null> {
    return await AsyncStorage.getItem('userToken');
  },

  // Store user data
  async storeUser(userData: User) {
    try {
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      console.log('User data stored successfully');
      console.log("userData", userData);
    } catch (error) {
      console.error('Error storing user data:', error);
    }
  },

  // Get user data
  async getUser(): Promise<User | null> {
    try {
      const userDataString = await AsyncStorage.getItem('userData');
      // console.log('Stored user data string:', userDataString);
      
      if (!userDataString) {
        console.log('No user data found in storage');
        return null;
      }
      
      const userData = JSON.parse(userDataString);
      console.log("userData", userData);
      return userData;
    } catch (error) {
      console.error('Error retrieving user data:', error);
      return null;
    }
  },

  // Store admin status
  async storeAdminStatus(isAdmin: boolean) {
    console.log("storing admin status", isAdmin);
    console.log("storing admin status");
    await AsyncStorage.setItem('isAdmin', String(isAdmin));
    console.log("stored status", await AsyncStorage.getItem('isAdmin')); // Confirm it was saved
  },

  // Get admin status
  async getAdminStatus(): Promise<boolean> {
    const adminStatus = await AsyncStorage.getItem('isAdmin');
    console.log("in getadminstatus",adminStatus)
    return adminStatus === 'true';
  },

  // Clear all auth data
  async clear() {
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('userData');
    await AsyncStorage.removeItem('isAdmin');
  }
};