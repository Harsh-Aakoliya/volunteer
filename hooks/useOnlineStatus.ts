// hooks/useOnlineStatus.ts
// Simplified hook that wraps the new SocketManager for backward compatibility

import { useCallback } from 'react';
import socketManager from '@/utils/socketManager';
import { AuthStorage } from '@/utils/authStorage';

/**
 * Hook for managing online status
 * This is a simplified wrapper around the new SocketManager
 */
export const useOnlineStatus = () => {
  const setUserOnline = useCallback(async (userId?: string) => {
    try {
      let userIdToUse = userId;
      
      if (!userIdToUse) {
        const userData = await AuthStorage.getUser();
        userIdToUse = userData?.userId;
      }
      
      if (!userIdToUse) {
        console.log('❌ [useOnlineStatus] No user ID available');
        return;
      }

      socketManager.setUserOnline();
    } catch (error) {
      console.error('❌ [useOnlineStatus] Error setting user online:', error);
    }
  }, []);

  const setUserOffline = useCallback(async (userId?: string) => {
    try {
      socketManager.setUserOffline();
    } catch (error) {
      console.error('❌ [useOnlineStatus] Error setting user offline:', error);
    }
  }, []);

  const initializeOnlineStatus = useCallback(async () => {
    // This is now handled by SocketContext.initialize()
    // Kept for backward compatibility
    console.log('⚠️ [useOnlineStatus] initializeOnlineStatus is deprecated, use SocketContext instead');
  }, []);

  return {
    initializeOnlineStatus,
    setUserOnline,
    setUserOffline,
    resetInitialization: () => {
      // No-op for backward compatibility
    },
  };
};

/**
 * Set user online globally (for use in non-hook contexts like auth.ts)
 */
export const setUserOnlineGlobal = async (userId: string) => {
  try {
    console.log('🟢 [Global] Setting user online:', userId);
    
    const userData = await AuthStorage.getUser();
    const user = {
      id: userId,
      name: userData?.fullName || userData?.sevakname || 'Unknown',
    };
    
    await socketManager.connect(user);
    socketManager.setUserOnline();
  } catch (error) {
    console.error('❌ [Global] Error setting user online:', error);
  }
};

/**
 * Set user offline globally (for use in non-hook contexts like auth.ts)
 */
export const setUserOfflineGlobal = async (userId: string) => {
  try {
    console.log('🔴 [Global] Setting user offline:', userId);
    socketManager.setUserOffline();
  } catch (error) {
    console.error('❌ [Global] Error setting user offline:', error);
  }
};

/**
 * Reset online status state (called on logout)
 */
export const resetOnlineStatusState = () => {
  socketManager.disconnect();
};
