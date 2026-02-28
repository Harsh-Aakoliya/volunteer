// api/apiClient.ts
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { Alert, Platform } from "react-native";
import { API_URL } from "@/constants/api";
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
    if (!payload.exp) return false; // no expiry claim → trust the server
    return payload.exp < Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}

// ==================== CONNECTIVITY CHECK ====================

let lastConnectivityCheck = 0;
let lastConnectivityResult = true;
const CONNECTIVITY_CACHE_MS = 5000;

async function checkInternetConnectivity(): Promise<boolean> {
  if (Platform.OS === "web") return true;

  const now = Date.now();
  if (now - lastConnectivityCheck < CONNECTIVITY_CACHE_MS) {
    return lastConnectivityResult;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const response = await fetch("https://www.google.com", {
      method: "HEAD",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    lastConnectivityResult = response.ok;
  } catch {
    lastConnectivityResult = false;
  }
  lastConnectivityCheck = now;
  return lastConnectivityResult;
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
  // 1. Check internet
  const connected = await checkInternetConnectivity();
  if (!connected) {
    Alert.alert(
      "No Internet",
      "Please check your network connection and try again."
    );
    throw new Error("NO_INTERNET");
  }

  // 2. Check token validity
  const token = await AuthStorage.getToken();
  if (!token) {
    await handleSessionExpired();
    throw new Error("TOKEN_EXPIRED");
  }

  if (isTokenExpired(token)) {
    await handleSessionExpired();
    throw new Error("TOKEN_EXPIRED");
  }

  // 3. Set auth header and make request
  config.headers = {
    ...config.headers,
    Authorization: `Bearer ${token}`,
  };

  try {
    return await axios(config);
  } catch (error: any) {
    if (error?.response?.status === 401) {
      await handleSessionExpired();
    }
    throw error;
  }
}

async function publicRequest<T = any>(
  config: AxiosRequestConfig
): Promise<AxiosResponse<T>> {
  const connected = await checkInternetConnectivity();
  if (!connected) {
    throw new Error("NO_INTERNET");
  }
  return axios(config);
}

// ==================== EXPORTED API OBJECTS ====================

/**
 * Authenticated API client.
 * Every call validates the JWT token and checks internet connectivity first.
 * If the token is expired → redirects to login.
 * If no internet → shows an alert.
 */
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

/**
 * Public API client — no token check.
 * Only checks internet connectivity.
 * Use for login, registration, check-mobile, etc.
 */
export const publicApi = {
  get<T = any>(url: string, config?: AxiosRequestConfig) {
    return publicRequest<T>({ method: "GET", url, ...config });
  },

  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
    return publicRequest<T>({ method: "POST", url, data, ...config });
  },
};

/**
 * Build full API URL from a relative path.
 * Example: apiUrl("/api/chat/rooms") → "http://host:port/api/chat/rooms"
 */
export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}

export { checkInternetConnectivity, isTokenExpired };
