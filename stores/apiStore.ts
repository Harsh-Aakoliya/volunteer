import { create } from "zustand";
import { Platform } from "react-native";

interface ApiState {
  apiUrl: string;
  apiUrlReady: boolean;
  setApiUrl: (url: string) => void;
  getApiUrl: () => string;
}

export const useApiStore = create<ApiState>((set, get) => ({
  apiUrl: EXTERNAL_IP,
  apiUrlReady: false,

  setApiUrl: (url: string) => {
    set({ apiUrl: url, apiUrlReady: true });
    console.log("🔗 [ApiStore] API_URL configured:", url);
  },

  getApiUrl: () => get().apiUrl,
}));

export function getApiUrl(): string {
  return useApiStore.getState().getApiUrl();
}

export function setApiUrl(url: string): void {
  useApiStore.getState().setApiUrl(url);
}

export function apiUrl(path: string): string {
  return `${useApiStore.getState().apiUrl}${path}`;
}

async function pingServer(baseUrl: string, timeoutMs = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${baseUrl}/api/test?from=app&ip=${baseUrl}`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    return data.message === "API is running";
  } catch {
    return false;
  }
}

/**
 * Resolve the best API URL: try external first, fall back to internal.
 * Sets the URL in the store and marks it ready. Safe to call multiple times.
 */
export async function resolveApiUrl(): Promise<string> {
  if (Platform.OS === ("web" as any)) {
    setApiUrl("http://localhost:8080");
    return "http://localhost:8080";
  }

  console.log("🌐 [ApiStore] Resolving API URL...");

  const externalOk = await pingServer(EXTERNAL_IP);
  if (externalOk) {
    console.log("✅ [ApiStore] External IP reachable");
    setApiUrl(EXTERNAL_IP);
    return EXTERNAL_IP;
  }

  console.log("⚠️ [ApiStore] External failed, trying internal...");
  const internalOk = await pingServer(INTERNAL_IP);
  if (internalOk) {
    console.log("✅ [ApiStore] Internal IP reachable");
    setApiUrl(INTERNAL_IP);
    return INTERNAL_IP;
  }

  console.log("❌ [ApiStore] Both IPs unreachable, defaulting to external");
  setApiUrl(EXTERNAL_IP);
  return EXTERNAL_IP;
}

export { EXTERNAL_IP, INTERNAL_IP };
