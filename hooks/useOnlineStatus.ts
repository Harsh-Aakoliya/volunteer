// hooks/useOnlineStatus.ts
// Simplified hook that wraps the new SocketManager for backward compatibility
import socketManager from '@/utils/socketManager';

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
