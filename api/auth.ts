// api/auth.ts
import axios from "axios";
import { Alert, Platform } from "react-native";
import { API_URL } from "../constants/api";
import { AuthStorage } from "@/utils/authStorage";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { setUserOnlineGlobal, setUserOfflineGlobal, resetOnlineStatusState } from '@/hooks/useOnlineStatus';
import socketService from '@/utils/socketService';

// ==================== HELPER FUNCTIONS ====================

// Helper function to check internet connectivity
const checkInternetConnectivity = async (): Promise<boolean> => {
  try {
    const response = await fetch("https://www.google.com", { method: "HEAD" });
    return response.ok;
  } catch (error) {
    console.error("Internet connectivity check failed:", error);
    return false;
  }
};

// ==================== NOTIFICATION FUNCTIONS ====================

const generateAndStoreNotificationToken = async (userId: string) => {
  try {
    const isConnected = await checkInternetConnectivity();
    if (!isConnected) {
      console.log('No internet connection available for notification token generation');
      return;
    }

    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.log('Notification permission not granted');
      return;
    }

    const { data: rawFcm } = await Notifications.getDevicePushTokenAsync();
    console.log("FCM token:", rawFcm);

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

// ==================== AUTH CHECK FUNCTIONS ====================

// Check if user is already authenticated
export const checkAuthStatus = async (): Promise<{
  isAuthenticated: boolean;
  token: string | null;
  user: any | null;
}> => {
  try {
    const token = await AuthStorage.getToken();
    const user = await AuthStorage.getUser();
    const sevakData = await AuthStorage.getSevakData();

    if (token && (user || sevakData)) {
      return {
        isAuthenticated: true,
        token,
        user: user || sevakData,
      };
    }

    return {
      isAuthenticated: false,
      token: null,
      user: null,
    };
  } catch (error) {
    console.error("Error checking auth status:", error);
    return {
      isAuthenticated: false,
      token: null,
      user: null,
    };
  }
};

// ==================== MOBILE CHECK FUNCTION ====================

export interface CheckMobileResponse {
  exists: boolean;
  isPasswordSet: boolean;
  message?: string;
  canlogin: number;
}

export const checkMobileExists = async (
  mobileNumber: string
): Promise<CheckMobileResponse> => {
  try {
    // Check internet connectivity first
    const isConnected = await checkInternetConnectivity();
    if (!isConnected) {
      throw new Error("NO_INTERNET");
    }

    const response = await fetch(`${API_URL}/api/auth/check-mobile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mobileNumber }),
    });
    // console.log("response in check mobile exists", await response.json());

    if (!response.ok) {
      // console.log("response in check mobile exists", await response.json());
      const errorData = await response.json();
      throw new Error(errorData.message || "SERVER_ERROR");
    }

    const data = await response.json();
    return {
      exists: data.exists ?? false,
      isPasswordSet: data.isPasswordSet ?? data.ispasswordSet ?? false,
      canlogin: data.canlogin ?? 0,
      message: data.message,
    };
  } catch (error: any) {
    console.error("Check mobile error:", error);
    
    if (error.message === "NO_INTERNET") {
      throw new Error("No internet connection. Please check your network.");
    }
    
    if (error.message === "SERVER_ERROR") {
      throw new Error("Server error. Please try again later.");
    }
    
    throw new Error("Failed to verify mobile number. Please try again.");
  }
};

// ==================== LOGIN FUNCTION ====================

export interface LoginResponse {
  success: boolean;
  message?: string;
  token?: string;
  sevak?: any;
}

export const login = async (
  mobileNumber: string,
  password: string
): Promise<LoginResponse> => {
  try {
    // Check internet connectivity first
    const isConnected = await checkInternetConnectivity();
    if (!isConnected) {
      return {
        success: false,
        message: "No internet connection. Please check your network.",
      };
    }

    const response = await axios.post(`${API_URL}/api/auth/login`, {
      mobileNumber,
      password,
    });

    console.log("Response in login:", response.data);

    if (response.data.success) {
      const { token, sevak } = response.data;

      // Store authentication data
      await AuthStorage.storeToken(token);
      await AuthStorage.storeSevakData(sevak);
      await AuthStorage.storeUser({
        userId: sevak.seid,
        mobileNumber: sevak.mobileno,
        name: sevak.sename || sevak.sevakname,
        role: sevak.usertype,
      });
      await AuthStorage.storeUserRole(sevak.usertype);

      // Generate notification token after successful login
      generateAndStoreNotificationToken(sevak.seid).catch((error) => {
        console.error("Error generating notification token:", error);
      });

      return {
        success: true,
        token,
        sevak,
      };
    } else {
      console.log("response in login", response.data);
      return {
        success: false,
        message: response.data.message || "Login failed. Please try again.",
      };
    }
  } catch (error: any) {
    // console.error("Login error:", error);

    if (error.response) {
      // Server responded with error
      return {
        success: false,
        message: error.response.data?.message || "Invalid credentials. Please try again.",
      };
    } else if (error.request) {
      // No response received
      return {
        success: false,
        message: "Unable to connect to server. Please check your internet connection.",
      };
    } else {
      // Other error
      return {
        success: false,
        message: "Something went wrong. Please try again.",
      };
    }
  }
};

// ==================== SET PASSWORD FUNCTION ====================

export interface SetPasswordResponse {
  success: boolean;
  message?: string;
  token?: string;
  sevak?: any;
}

export const setPassword = async (
  mobileNumber: string,
  password: string
): Promise<SetPasswordResponse> => {
  try {
    // Check internet connectivity first
    const isConnected = await checkInternetConnectivity();
    if (!isConnected) {
      return {
        success: false,
        message: "No internet connection. Please check your network.",
      };
    }

    const response = await axios.post(`${API_URL}/api/auth/set-password`, {
      mobileNumber,
      password,
    });

    console.log("Response in set password:", response.data);

    if (response.data.success) {
      const { token, sevak } = response.data;

      // Store authentication data
      await AuthStorage.storeToken(token);
      await AuthStorage.storeSevakData(sevak);
      await AuthStorage.storeUser({
        userId: sevak.seid,
        mobileNumber: sevak.mobileno,
        name: sevak.sename || sevak.sevakname,
        role: sevak.usertype,
      });
      await AuthStorage.storeUserRole(sevak.usertype);

      // Generate notification token after successful password set
      generateAndStoreNotificationToken(sevak.seid).catch((error) => {
        console.error("Error generating notification token:", error);
      });

      return {
        success: true,
        token,
        sevak,
      };
    } else {
      return {
        success: false,
        message: response.data.message || "Failed to set password. Please try again.",
      };
    }
  } catch (error: any) {
    console.error("Set password error:", error);

    if (error.response) {
      return {
        success: false,
        message: error.response.data?.message || "Failed to set password. Please try again.",
      };
    } else if (error.request) {
      return {
        success: false,
        message: "Unable to connect to server. Please check your internet connection.",
      };
    } else {
      return {
        success: false,
        message: "Something went wrong. Please try again.",
      };
    }
  }
};

// ==================== CHANGE PASSWORD FUNCTION ====================
export const changePassword = async (
  mobileNumber: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; message?: string }> => {
  try {
    const token = await AuthStorage.getToken();
    const response = await axios.post(
      `${API_URL}/api/auth/change-password`,
      { mobileNumber, currentPassword, newPassword },
      { headers: { Authorization: token ? `Bearer ${token}` : "" } }
    );

    return response.data;
  } catch (error: any) {
    if (error.response) {
      return {
        success: false,
        message: error.response.data?.message || "Failed to change password. Please try again.",
      };
    }
    return { success: false, message: "Unable to change password. Please try again." };
  }
};

// ==================== REGISTER FUNCTION ====================

export const register = async (
  mobileNumber: string,
  userId: string,
  fullName: string
) => {
  try {
    const response = await axios.post(`${API_URL}/api/auth/register`, {
      mobileNumber,
      userId,
      fullName,
    });
    return response.data;
  } catch (error: any) {
    console.error("Registration error", error);
    return {
      success: false,
      message: error.response?.data?.message || "Registration failed.",
    };
  }
};

// ==================== LOGOUT FUNCTION ====================

export const logout = async () => {
  try {
    const userData = await AuthStorage.getUser();

    if (userData?.userId) {
      try {
        await setUserOfflineGlobal(userData.userId);
        await new Promise((resolve) => setTimeout(resolve, 500));
        socketService.disconnect();
      } catch (error) {
        console.error("Error setting user offline during logout:", error);
      }

      await removeNotificationToken(userData.userId);
    }

    resetOnlineStatusState();
    await AuthStorage.clear();
    router.replace({
      pathname: "/(auth)/login",
      params: { from: "logout" }
    });

    console.log("Logout successful");
  } catch (error) {
    console.error("Error during logout:", error);
    await AuthStorage.clear();
    resetOnlineStatusState();
    router.replace({
      pathname: "/(auth)/login",
      params: { from: "logout" }
    });
  }
};

// ==================== APP START HANDLER ====================

export const handleAppStartNotificationToken = async () => {
  try {
    const userData = await AuthStorage.getUser();
    const token = await AuthStorage.getToken();

    if (userData?.userId && token) {
      const isConnected = await checkInternetConnectivity();
      if (isConnected) {
        generateAndStoreNotificationToken(userData.userId).catch((error) => {
          console.error("Error handling notification token on app start:", error);
        });
      } else {
        console.log("No internet connection available for notification token generation on app start");
      }
    }
  } catch (error) {
    console.error("Error checking login status for notification token:", error);
  }
};

// Export the connectivity check function
export { checkInternetConnectivity };