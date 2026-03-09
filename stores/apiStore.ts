// Centralized API URL state so socket and API calls use the same URL after setup
import { create } from "zustand";

const DEFAULT_URL = "http://localhost:8080";

interface ApiState {
  apiUrl: string;
  apiUrlReady: boolean;
  setApiUrl: (url: string) => void;
  setApiUrlReady: (ready: boolean) => void;
  getApiUrl: () => string;
}

export const useApiStore = create<ApiState>((set, get) => ({
  apiUrl: DEFAULT_URL,
  apiUrlReady: false,

  setApiUrl: (url: string) => {
    set({ apiUrl: url, apiUrlReady: true });
    console.log("🔗 [ApiStore] API_URL configured:", url);
  },

  setApiUrlReady: (ready: boolean) => set({ apiUrlReady: ready }),

  getApiUrl: () => get().apiUrl,
}));
