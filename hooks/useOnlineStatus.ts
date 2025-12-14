// hooks/useOnlineStatus.ts
import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import socketService from '@/utils/socketService';
import { AuthStorage } from '@/utils/authStorage';

// Global state to prevent multiple initializations
let isInitialized = false;
let currentUserId: string | null = null;

export const useOnlineStatus = () => {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isSettingStatus = useRef(false);

  const setUserOnline = useCallback(async (userId?: string) => {
    if (isSettingStatus.current) {
      console.log('⏳ Already setting online status, skipping...');
      return;
    }

    try {
      isSettingStatus.current = true;
      const targetUserId = userId || currentUserId;
      
      if (!targetUserId) {
        const userData = await AuthStorage.getUser();
        if (!userData?.userId) {
          console.log('❌ No user ID available for online status');
          return;
        }
        currentUserId = userData.userId;
      }

      const userIdToUse = targetUserId || currentUserId;
      if (!userIdToUse) return;

      console.log('🟢 Setting user online:', userIdToUse);
      await socketService.setUserOnlineSafe(userIdToUse);
    } catch (error) {
      console.error('❌ Error in setUserOnline:', error);
    } finally {
      isSettingStatus.current = false;
    }
  }, []);

  const setUserOffline = useCallback(async (userId?: string) => {
    try {
      const targetUserId = userId || currentUserId;
      
      if (!targetUserId) {
        const userData = await AuthStorage.getUser();
        if (!userData?.userId) return;
        currentUserId = userData.userId;
      }

      const userIdToUse = targetUserId || currentUserId;
      if (!userIdToUse) return;

      console.log('🔴 Setting user offline:', userIdToUse);
      if (socketService.isConnected()) {
        socketService.setUserOffline(userIdToUse);
      }
    } catch (error) {
      console.error('❌ Error in setUserOffline:', error);
    }
  }, []);

  const initializeOnlineStatus = useCallback(async () => {
    if (isInitialized) {
      console.log('⏳ Online status already initialized');
      return;
    }

    try {
      const userData = await AuthStorage.getUser();
      const token = await AuthStorage.getToken();

      if (!userData?.userId || !token) {
        console.log('❌ User not logged in, skipping online status init');
        return;
      }

      currentUserId = userData.userId;
      isInitialized = true;

      console.log('🚀 Initializing online status for:', userData.userId);
      await setUserOnline(userData.userId);
    } catch (error) {
      console.error('❌ Error initializing online status:', error);
    }
  }, [setUserOnline]);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextAppState;

      // Don't process if same state
      if (prevState === nextAppState) return;

      console.log('📱 App state changed:', prevState, '->', nextAppState);

      // App came to foreground
      if (prevState.match(/inactive|background/) && nextAppState === 'active') {
        console.log('✅ App came to foreground');
        await setUserOnline();
      }

      // App went to background
      if (prevState === 'active' && nextAppState.match(/inactive|background/)) {
        console.log('❌ App went to background');
        await setUserOffline();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [setUserOnline, setUserOffline]);

  return {
    initializeOnlineStatus,
    setUserOnline,
    setUserOffline,
    resetInitialization: () => {
      isInitialized = false;
      currentUserId = null;
    },
  };
};

// Export for use in non-hook contexts (like auth.ts)
export const setUserOnlineGlobal = async (userId: string) => {
  try {
    console.log('🟢 [Global] Setting user online:', userId);
    currentUserId = userId;
    await socketService.setUserOnlineSafe(userId);
  } catch (error) {
    console.error('❌ [Global] Error setting user online:', error);
  }
};

export const setUserOfflineGlobal = async (userId: string) => {
  try {
    console.log('🔴 [Global] Setting user offline:', userId);
    if (socketService.isConnected()) {
      socketService.setUserOffline(userId);
    }
  } catch (error) {
    console.error('❌ [Global] Error setting user offline:', error);
  }
};

export const resetOnlineStatusState = () => {
  isInitialized = false;
  currentUserId = null;
};
