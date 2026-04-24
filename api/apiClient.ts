// api/apiClient.ts
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { Alert, Platform, AppState, AppStateStatus } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { getApiUrl, apiUrl } from "@/stores/apiStore";
import { AuthStorage } from "@/utils/authStorage";
import { router } from "expo-router";

// ==================== JWT HELPERS ====================

function decodeBase64Url(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";

  if (typeof atob === "function") {
    return atob(base64);
  }

  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  let bits = 0;
  let buffer = 0;
  for (let i = 0; i < base64.length; i++) {
    if (base64[i] === "=") break;
    const idx = chars.indexOf(base64[i]);
    if (idx === -1) continue;
    buffer = (buffer << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      result += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return result;
}

function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const payload = JSON.parse(decodeBase64Url(parts[1]));
    if (!payload.exp) return false;
    return payload.exp < Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}

// ==================== CONNECTIVITY CHECK WITH NETINFO ====================

let lastConnectivityCheck = 0;
let lastConnectivityResult = true;
const CONNECTIVITY_CACHE_MS = 3000; // Reduced cache time for better responsiveness

// Invalidate cache when app returns from background
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (nextState: AppStateStatus) => {
    if (nextState === "active") {
      lastConnectivityCheck = 0;
      lastConnectivityResult = true;
    }
  });
}

async function checkInternetConnectivity(): Promise<boolean> {
  if (Platform.OS === "web") return true;

  const now = Date.now();
  if (now - lastConnectivityCheck < CONNECTIVITY_CACHE_MS) {
    return lastConnectivityResult;
  }

  try {
    const state = await NetInfo.fetch();
    
    // Check both connection status and internet reachability
    // isConnected: device has active network interface
    // isInternetReachable: device can actually reach the internet
    lastConnectivityResult = 
      state.isConnected === true && 
      state.isInternetReachable !== false;
    
    lastConnectivityCheck = Date.now();
    return lastConnectivityResult;
  } catch (error) {
    console.error("NetInfo connectivity check error:", error);
    // On error, assume no connection to be safe
    lastConnectivityResult = false;
    lastConnectivityCheck = Date.now();
    return false;
  }
}

// Optional: Invalidate cache manually (useful for retry buttons)
export function invalidateConnectivityCache() {
  lastConnectivityCheck = 0;
}

// ==================== SESSION EXPIRED REDIRECT ====================

let isRedirecting = false;

async function handleSessionExpired() {
  if (isRedirecting) return;
  isRedirecting = true;
  try {
    await AuthStorage.clear();
    router.replace({ pathname: "/(auth)/login", params: { from: "expired" } });
  } finally {
    setTimeout(() => {
      isRedirecting = false;
    }, 2000);
  }
}

// ==================== CORE REQUEST FUNCTIONS ====================

async function authenticatedRequest<T = any>(
  config: AxiosRequestConfig
): Promise<AxiosResponse<T>> {
  // 1. Check token validity FIRST (no network needed)
  const token = await AuthStorage.getToken();
  if (!token) {
    await handleSessionExpired();
    throw new Error("TOKEN_EXPIRED");
  }

  if (isTokenExpired(token)) {
    await handleSessionExpired();
    throw new Error("TOKEN_EXPIRED");
  }

  // 2. Set auth header
  config.headers = {
    ...config.headers,
    Authorization: `Bearer ${token}`,
  };

  // 3. Make the request - check connectivity only on failure
  try {
    return await axios(config);
  } catch (error: any) {
    console.log("error in authenticatedRequest", error);
    // Handle 401 Unauthorized
    if (error?.response?.status === 401) {
      await handleSessionExpired();
      throw error;
    }

    // Network error (no response received) — check connectivity
    if (!error?.response) {
      const connected = await checkInternetConnectivity();
      if (!connected) {
        // Uncomment if you want to show alert
        // Alert.alert(
        //   "No Internet",
        //   "Please check your network connection and try again."
        // );
        throw new Error("NO_INTERNET");
      }

      // Connected but request failed — server issue
      Alert.alert(
        "Server Error",
        "Unable to reach the server. Please try again later."
      );
      throw new Error("SERVER_UNREACHABLE");
    }

    throw error;
  }
}

async function publicRequest<T = any>(
  config: AxiosRequestConfig
): Promise<AxiosResponse<T>> {
  try {
    return await axios(config);
  } catch (error: any) {
    // Network error (no response received) — check connectivity
    if (!error?.response) {
      const connected = await checkInternetConnectivity();
      if (!connected) {
        throw new Error("NO_INTERNET");
      }
      throw new Error("SERVER_UNREACHABLE");
    }
    throw error;
  }
}

// ==================== EXPORTED API OBJECTS ====================

export const api = {
  get<T = any>(url: string, config?: AxiosRequestConfig) {
    return authenticatedRequest<T>({ method: "GET", url, ...config });
  },
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
    return authenticatedRequest<T>({ method: "POST", url, data, ...config });
  },
  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
    return authenticatedRequest<T>({ method: "PUT", url, data, ...config });
  },
  delete<T = any>(url: string, config?: AxiosRequestConfig) {
    return authenticatedRequest<T>({ method: "DELETE", url, ...config });
  },
  patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
    return authenticatedRequest<T>({ method: "PATCH", url, data, ...config });
  },
};

export const publicApi = {
  get<T = any>(url: string, config?: AxiosRequestConfig) {
    return publicRequest<T>({ method: "GET", url, ...config });
  },
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
    console.log("POST request to:", url);
    return publicRequest<T>({ method: "POST", url, data, ...config });
  },
};

export { apiUrl, checkInternetConnectivity, isTokenExpired };