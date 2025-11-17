// utils/authStorage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@/types/type';

export const AuthStorage = {
  // Store user token
  async storeToken(token: string) {
    try {
      await AsyncStorage.setItem('userToken', token);
      console.log('Token stored successfully');
    } catch (error) {
      console.error('Error storing token:', error);
    }
  },

  // Get user token
  async getToken(): Promise<string | null> {
    try {
      const token = await AsyncStorage.getItem('userToken');
      console.log('Token retrieved successfully');
      console.log('Token:', token);
      return token;
    } catch (error) {
      console.error('Error getting token:', error);
      throw error;
    }
  },

  // Store user data
  async storeUser(userData: any) {
    try {
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      console.log('User data stored successfully');
      console.log('User data:', userData);
    } catch (error) {
      console.error('Error storing user data:', error);
      throw error;
    }
  },

  // Get user data
  async getUser(): Promise<User | null> {
    try {
      const userDataString = await AsyncStorage.getItem('userData');
      // console.log('Stored user data string:', userDataString);
      
      if (!userDataString) {
        console.log('No user data found in storage');
        throw new Error('No user data found in storage');
      }
      
      const userData = JSON.parse(userDataString);
      console.log("userData", userData);
      return userData as User;
    } catch (error) {
      console.error('Error retrieving user data:', error);
      throw error;
    }
  },

  // Store user role
  async storeUserRole(role: string) {
    try {
      await AsyncStorage.setItem('userRole', role);
    console.log('User role stored successfully');
    console.log('User role:', role);
    } catch (error) {
      console.error('Error storing user role:', error);
      throw error;
    }
  },

  // Get user role
  async getUserRole(): Promise<string | null> {
    try {
      const userRole = await AsyncStorage.getItem('userRole');
    console.log('User role retrieved successfully');
    console.log('User role:', userRole);
    return userRole as string | null;
    } catch (error) {
      console.error('Error getting user role:', error);
      throw error;
    }
  },

  // Clear all auth data
  async clear() {
    try {
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userData');
      await AsyncStorage.removeItem('userRole');
      console.log('All auth data cleared successfully');
    } catch (error) {
      console.error('Error clearing auth data:', error);
      throw error;
    }
  }
};