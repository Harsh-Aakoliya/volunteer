import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface User {
  userId: string;
  mobileNumber: string;
  isAdmin: boolean;
  fullName?: string;
  departments?: string[];
  isApproved?: boolean;
}

interface WebPermissions {
  accessLevel: 'master' | 'admin';
  canCreateAnnouncement: boolean;
  canCreateChatGroup: boolean;
  canEditUserProfile: boolean;
  canEditDepartments: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  webPermissions: WebPermissions | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setWebPermissions: (webPermissions: WebPermissions | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  login: (user: User, token: string, webPermissions?: WebPermissions | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      webPermissions: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => set({ token }),
      setWebPermissions: (webPermissions) => set({ webPermissions }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      
      login: (user, token, webPermissions = null) => {
        set({
          user,
          token,
          webPermissions,
          isAuthenticated: true,
          error: null,
        });
      },
      
      logout: () => {
        set({
          user: null,
          token: null,
          webPermissions: null,
          isAuthenticated: false,
          error: null,
        });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined') {
          return localStorage;
        }
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
    }
  )
);
