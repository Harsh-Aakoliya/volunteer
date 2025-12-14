// api/auth.ts
import axios from "axios";
import { Platform } from "react-native";
import { API_URL } from "../constants/api";
import { AuthStorage } from "@/utils/authStorage";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { setUserOnlineGlobal, setUserOfflineGlobal, resetOnlineStatusState } from '@/hooks/useOnlineStatus';
import socketService from '@/utils/socketService';

// Helper function to check internet connectivity (using same approach as useNetworkStatus hook)
const checkInternetConnectivity = async (): Promise<boolean> => {
  try {
    // Try to ping a fast, reliable endpoint (same as your useNetworkStatus hook)
    const response = await fetch("https://www.google.com", { method: "HEAD" });
    return response.ok;
  } catch (error) {
    console.error("Internet connectivity check failed:", error);
    return false;
  }
};

const generateAndStoreNotificationToken = async (userId: string) => {
  try {
    // Check internet connectivity first
    const isConnected = await checkInternetConnectivity();
    if (!isConnected) {
      console.log('No internet connection available for notification token generation');
      return;
    }

    // Request notification permissions
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.log('Notification permission not granted');
      return;
    }

    // FCM token
    const { data: rawFcm } = await Notifications.getDevicePushTokenAsync();
    console.log("FCM token:", rawFcm);

    // Get Expo push token
    // const expoPushToken = (
    //   await Notifications.getExpoPushTokenAsync({
    //     projectId: Constants?.expoConfig?.extra?.eas?.projectId,
    //   })
    // ).data;

    // if (!expoPushToken) {
    //   console.log('Failed to get Expo push token');
    //   return;
    // }

    // console.log('Generated Expo push token:', expoPushToken);

    // Store token in backend
    const token = await AuthStorage.getToken();
    if (token) {
      const response = await axios.post(`${API_URL}/api/notifications/store-token`, {
        userId,
        token: rawFcm,
        tokenType: 'fcm',
        deviceInfo: {
          platform: Constants.platform?.ios ? 'ios' : 'android',
          deviceId: Constants.deviceId,
          appVersion: Constants.expoConfig?.version
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('Token stored successfully:', response.data);
    }
  } catch (error) {
    console.error('Error generating/storing notification token:', error);
  }
};

const removeNotificationToken = async (userId: string) => {
  try {
    const token = await AuthStorage.getToken();
    if (token) {
      await axios.post(`${API_URL}/api/notifications/delete-token`, {
        userId,
        tokenType: 'fcm'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Notification token removed successfully');
    }
  } catch (error) {
    console.error('Error removing notification token:', error);
  }
};

export const login = async (mobileNumber: string, password: string) => {
  try {
    // Detect platform - 'web' for web, 'mobile' for iOS/Android
    const platform = Platform.OS === 'web' ? 'web' : 'mobile';
    
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      mobileNumber,
      password,
      platform,
    });

    console.log("Login response:", response.data);
    console.log("Token get from backend", response.data.token);

    if (response.data.success) {
      // Store token
      await AuthStorage.storeToken(response.data.token);
      const userData = response.data.user;
      await AuthStorage.storeUser({
        userId: userData.user_id,
        mobileNumber: userData.mobile_number,
        isMaster: userData.role === 'master',
        isAdmin: userData.role === 'admin',
        fullName: userData.full_name,
        xetra: userData.xetra,
        mandal: userData.mandal,
        role: userData.role,
        totalSabha: userData.total_sabha,
        presentCount: userData.present_count,
        absentCount: userData.absent_count,
        isApproved: userData.password !== null && userData.password !== '',
      });
      await AuthStorage.storeUserRole(userData.role);
      // Generate and store notification token after successful login
      generateAndStoreNotificationToken(userData.user_id).catch(error => {
        console.error('Error handling notification token after login:', error);
      });

      // Set user as online after successful login
      setTimeout(async () => {
        try {
          await setUserOnlineGlobal(userData.user_id);
        } catch (error) {
          console.error('Error setting user online after login:', error);
        }
      }, 1500);

      // Redirect to announcement page on successful login
      router.replace("/(drawer)");
      return userData;
    } else {
      return response.data;
    }
  } catch (error: any) {
    console.error("Login error", error);
    
    // Check if user doesn't exist (needs to register)
    if (error.response && error.response.status === 404) {
      alert("User not found. Please register first.");
      router.replace("/signup");
      return null;
    }
    
    // Check if user exists but not approved
    if (error.response && error.response.status === 401) {
      if (error.response.data && error.response.data.message && 
          error.response.data.message.includes("not approved")) {
        alert("Your registration is pending. Please wait for admin approval.");
        router.replace("/login");

        return null;
      } else {
        alert("Invalid credentials. Please try again.");
        router.replace("/login");

        return null;
      }
    }
    
    // Network or other errors
    alert("Error while logging in. Please try again later.");
    router.replace("/login");

    return null;
  }
};

export const register = async (mobileNumber: string, userId: string, fullName: string) => {
  try {
    const response = await axios.post(`${API_URL}/api/auth/register`, {
      mobileNumber,
      userId,
      fullName,
    });
    return response.data;
  } catch (error: any) {
    console.error("Registration error", error);
  }
};

export const logout = async () => {
  try {
    // Get current user data before clearing storage
    const userData = await AuthStorage.getUser();
    
    if (userData?.userId) {
      // Set user offline before logging out
      try {
        await setUserOfflineGlobal(userData.userId);
        
        // Wait a bit for the offline status to be broadcast
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Disconnect socket
        socketService.disconnect();
      } catch (error) {
        console.error('Error setting user offline during logout:', error);
      }
      
      // Remove notification token from backend
      await removeNotificationToken(userData.userId);
    }

    // Reset online status state
    resetOnlineStatusState();

    // Clear local storage
    await AuthStorage.clear();
    
    // Redirect to login page
    router.replace("/login");
    
    console.log('Logout successful');
  } catch (error) {
    console.error('Error during logout:', error);
    // Clear storage anyway in case of error
    await AuthStorage.clear();
    resetOnlineStatusState();
    router.replace("/login");
  }
};

// Function to handle token generation when app starts and user is already logged in
export const handleAppStartNotificationToken = async () => {
  try {
    const userData = await AuthStorage.getUser();
    const token = await AuthStorage.getToken();
    
    if (userData?.userId && token) {
      // Check internet connectivity before generating notification token
      const isConnected = await checkInternetConnectivity();
      if (isConnected) {
        // User is already logged in, generate and store notification token
        generateAndStoreNotificationToken(userData.userId).catch(error => {
          console.error('Error handling notification token on app start:', error);
        });
      } else {
        console.log('No internet connection available for notification token generation on app start');
      }
    }
  } catch (error) {
    console.error('Error checking login status for notification token:', error);
  }
};

// Export the connectivity check function for use in other parts of the app
export { checkInternetConnectivity };