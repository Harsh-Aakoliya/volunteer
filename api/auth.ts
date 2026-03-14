// api/auth.ts
import axios from "axios";
import { Alert, Platform } from "react-native";
import { AuthStorage } from "@/utils/authStorage";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import {
  setUserOfflineGlobal,
  resetOnlineStatusState,
} from "@/hooks/useOnlineStatus";
import { api, publicApi, apiUrl, checkInternetConnectivity } from "@/api/apiClient";

// ==================== NOTIFICATION FUNCTIONS ====================

const generateAndStoreNotificationToken = async (userId: string) => {
  try {
    const isConnected =
      (await checkInternetConnectivity()) || Platform.OS === "web";
    if (!isConnected) {
      console.log(
        "No internet connection available for notification token generation"
      );
      return;
    }

    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") {
      console.log("Notification permission not granted");
      return;
    }

    const { data: rawFcm } = await Notifications.getDevicePushTokenAsync();
    console.log("FCM token: for user name", userId, rawFcm);

    try {
      await api.post(apiUrl("/api/notifications/store-token"), {
        userId,
        token: rawFcm,
        tokenType: "fcm",
        deviceInfo: {
          platform: Constants.platform?.ios ? "ios" : "android",
          deviceId: Constants.deviceId,
          appVersion: Constants.expoConfig?.version,
        },
      });
      console.log("Token stored successfully");
    } catch (error) {
      console.error("Error storing notification token via API:", error);
    }
  } catch (error) {
    console.error("Error generating/storing notification token:", error);
  }
};

const removeNotificationToken = async (userId: string) => {
  try {
    await api.post(apiUrl("/api/notifications/delete-token"), {
      userId,
      tokenType: "fcm",
    });
    console.log("Notification token removed successfully");
  } catch (error) {
    console.error("Error removing notification token:", error);
  }
};

// ==================== AUTH CHECK FUNCTIONS ====================

export const checkAuthStatus = async (): Promise<{
  isAuthenticated: boolean;
  token: string | null;
  user: any | null;
}> => {
  try {
    const token = await AuthStorage.getToken();
    const user = await AuthStorage.getUser();

    if (token && user) {
      return { isAuthenticated: true, token, user };
    }

    return { isAuthenticated: false, token: null, user: null };
  } catch (error) {
    console.error("Error checking auth status:", error);
    return { isAuthenticated: false, token: null, user: null };
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
    const response = await publicApi.post(
      apiUrl("/api/auth/check-mobile"),
      { mobileNumber }
    );

    const data = response.data;
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

    if (error.response) {
      const errorData = error.response.data;
      throw new Error(errorData?.message || "Server error. Please try again later.");
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
  console.log("login", mobileNumber, password);
  try {
    const response = await publicApi.post(apiUrl("/api/auth/login"), {
      mobileNumber,
      password,
    });

    if (response.data.success) {
      const { token, sevak } = response.data;

      await AuthStorage.storeToken(token);
      await AuthStorage.storeUser({
        userId: sevak.seid,
        mobileNumber: sevak.mobileno,
        name: sevak.sevakname,
        fullName: sevak.sevakname,
        role: sevak.usertype,
        ...sevak,
      });

      if (Platform.OS !== "web") {
        console.log("generateAndStoreNotificationToken for user name", sevak.sevakname);
        generateAndStoreNotificationToken(sevak.seid).catch((error) => {
          console.error("Error generating notification token:", error);
        });
      }
      return { success: true, token, sevak };
    } else {
      return {
        success: false,
        message: response.data.message || "Login failed. Please try again.",
      };
    }
  } catch (error: any) {
    if (error.message === "NO_INTERNET") {
      return {
        success: false,
        message: "No internet connection. Please check your network.",
      };
    }

    if (error.response) {
      return {
        success: false,
        message:
          error.response.data?.message ||
          "Invalid credentials. Please try again.",
      };
    } else if (error.request) {
      return {
        success: false,
        message:
          "Unable to connect to server. Please check your internet connection.",
      };
    } else {
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

export const setPasswordToBackend = async (
  mobileNumber: string,
  password: string
): Promise<SetPasswordResponse> => {
  try {
    const response = await publicApi.post(apiUrl("/api/auth/set-password"), {
      mobileNumber,
      password,
    });

    if (response.data.success) {
      const { token, sevak } = response.data;

      await AuthStorage.storeToken(token);
      await AuthStorage.storeUser({
        userId: sevak.seid,
        mobileNumber: sevak.mobileno,
        name: sevak.sevakname,
        fullName: sevak.sevakname,
        role: sevak.usertype,
        ...sevak,
      });

      generateAndStoreNotificationToken(sevak.seid).catch((error) => {
        console.error("Error generating notification token:", error);
      });

      return { success: true, token, sevak };
    } else {
      return {
        success: false,
        message:
          response.data.message || "Failed to set password. Please try again.",
      };
    }
  } catch (error: any) {
    console.error("Set password error:", error);

    if (error.message === "NO_INTERNET") {
      return {
        success: false,
        message: "No internet connection. Please check your network.",
      };
    }

    if (error.response) {
      return {
        success: false,
        message:
          error.response.data?.message ||
          "Failed to set password. Please try again.",
      };
    } else if (error.request) {
      return {
        success: false,
        message:
          "Unable to connect to server. Please check your internet connection.",
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
    const response = await api.post(apiUrl("/api/auth/change-password"), {
      mobileNumber,
      currentPassword,
      newPassword,
    });
    return response.data;
  } catch (error: any) {
    if (error.response) {
      return {
        success: false,
        message:
          error.response.data?.message ||
          "Failed to change password. Please try again.",
      };
    }
    return {
      success: false,
      message: "Unable to change password. Please try again.",
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
      } catch (error) {
        console.error("Error setting user offline during logout:", error);
      }

      await removeNotificationToken(userData.userId);
    }

    resetOnlineStatusState();
    await AuthStorage.clear();
    router.replace({
      pathname: "/(auth)/login",
      params: { from: "logout" },
    });

    console.log("Logout successful");
  } catch (error) {
    console.error("Error during logout:", error);
    await AuthStorage.clear();
    resetOnlineStatusState();
    router.replace({
      pathname: "/(auth)/login",
      params: { from: "logout" },
    });
  }
};

// ==================== APP START HANDLER ====================

export const handleAppStartNotificationToken = async () => {
  try {
    const userData = await AuthStorage.getUser();
    const token = await AuthStorage.getToken();

    if (userData?.userId && token) {
      generateAndStoreNotificationToken(userData.userId).catch((error) => {
        console.error(
          "Error handling notification token on app start:",
          error
        );
      });
    }
  } catch (error) {
    console.error(
      "Error checking login status for notification token:",
      error
    );
  }
};

export { checkInternetConnectivity };
