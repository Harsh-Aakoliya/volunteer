// utils/authStorage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { User } from "@/types/type";

const KEYS = {
  TOKEN: "userToken",
  USER: "userData",
  ROLE: "userRole",
  SEVAK: "sevakData",
};

export const AuthStorage = {
  // ==================== SEVAK DATA ====================

  async storeSevakData(sevak: any): Promise<void> {
    console.log("Storing sevak data in authStorage:", sevak);
    try {
      await AsyncStorage.setItem(KEYS.SEVAK, JSON.stringify(sevak));
      console.log("Sevak data stored successfully");
    } catch (error) {
      console.error("Error storing sevak data:", error);
      throw error;
    }
  },

  async getSevakData(): Promise<any | null> {
    try {
      const sevakDataString = await AsyncStorage.getItem(KEYS.SEVAK);
      if (!sevakDataString) {
        return null;
      }
      console.log("Sevak data retrieved successfully");
      return JSON.parse(sevakDataString);
    } catch (error) {
      console.error("Error getting sevak data:", error);
      return null;
    }
  },

  // ==================== TOKEN ====================

  async storeToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.TOKEN, token);
      console.log("Token stored successfully");
    } catch (error) {
      console.error("Error storing token:", error);
      throw error;
    }
  },

  async getToken(): Promise<string | null> {
    try {
      const token = await AsyncStorage.getItem(KEYS.TOKEN);
      return token;
    } catch (error) {
      console.error("Error getting token:", error);
      return null;
    }
  },

  // ==================== USER DATA ====================

  async storeUser(userData: any): Promise<void> {
    console.log("Storing user data in authStorage:", userData);
    try {
      await AsyncStorage.setItem(KEYS.USER, JSON.stringify(userData));
      console.log("User data stored successfully");
    } catch (error) {
      console.error("Error storing user data:", error);
      throw error;
    }
  },

  async getUser(): Promise<any | null> {
    try {
      const userDataString = await AsyncStorage.getItem(KEYS.USER);

      if (!userDataString) {
        console.log("No user data found in storage");
        return null;
      }

      const userData = JSON.parse(userDataString);
      return userData as any;
    } catch (error) {
      console.error("Error retrieving user data:", error);
      return null;
    }
  },

  // ==================== USER ROLE ====================

  async storeUserRole(role: string): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.ROLE, role);
      console.log("User role stored successfully:", role);
    } catch (error) {
      console.error("Error storing user role:", error);
      throw error;
    }
  },

  async getUserRole(): Promise<string | null> {
    try {
      const userRole = await AsyncStorage.getItem(KEYS.ROLE);
      return userRole;
    } catch (error) {
      console.error("Error getting user role:", error);
      return null;
    }
  },

  // ==================== CLEAR ALL DATA ====================

  async clear(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        KEYS.TOKEN,
        KEYS.USER,
        KEYS.ROLE,
        KEYS.SEVAK,
      ]);
      console.log("All auth data cleared successfully");
    } catch (error) {
      console.error("Error clearing auth data:", error);
      throw error;
    }
  },

  // ==================== CHECK IF AUTHENTICATED ====================

  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await this.getToken();
      const user = await this.getUser();
      return !!(token && user);
    } catch (error) {
      console.error("Error checking authentication:", error);
      return false;
    }
  },
};