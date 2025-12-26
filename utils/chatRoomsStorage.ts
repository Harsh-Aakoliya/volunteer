// utils/chatRoomStorage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatRoom } from '@/types/type';

const CHAT_ROOMS_KEY = 'chat_rooms_cache';
const LAST_MESSAGES_KEY = 'last_messages_cache';

interface CachedChatRooms {
  rooms: ChatRoom[];
  timestamp: number;
}

interface CachedLastMessages {
  messages: { [key: string]: any };
  timestamp: number;
}

export const ChatRoomStorage = {
  // Save chat rooms to cache
  saveChatRooms: async (rooms: ChatRoom[]): Promise<void> => {
    try {
      const cacheData: CachedChatRooms = {
        rooms,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem(CHAT_ROOMS_KEY, JSON.stringify(cacheData));
      console.log('💾 Chat rooms saved to cache');
    } catch (error) {
      console.error('❌ Error saving chat rooms to cache:', error);
    }
  },

  // Get cached chat rooms
  getChatRooms: async (): Promise<CachedChatRooms | null> => {
    try {
      const data = await AsyncStorage.getItem(CHAT_ROOMS_KEY);
      if (data) {
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error('❌ Error getting chat rooms from cache:', error);
      return null;
    }
  },

  // Save last messages to cache
  saveLastMessages: async (messages: { [key: string]: any }): Promise<void> => {
    try {
      const cacheData: CachedLastMessages = {
        messages,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem(LAST_MESSAGES_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.error('❌ Error saving last messages to cache:', error);
    }
  },

  // Get cached last messages
  getLastMessages: async (): Promise<CachedLastMessages | null> => {
    try {
      const data = await AsyncStorage.getItem(LAST_MESSAGES_KEY);
      if (data) {
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error('❌ Error getting last messages from cache:', error);
      return null;
    }
  },

  // Clear all cache
  clearCache: async (): Promise<void> => {
    try {
      await AsyncStorage.multiRemove([CHAT_ROOMS_KEY, LAST_MESSAGES_KEY]);
      console.log('🗑️ Chat room cache cleared');
    } catch (error) {
      console.error('❌ Error clearing chat rooms cache:', error);
    }
  },

  // Check if cache is stale (older than X minutes)
  isCacheStale: (timestamp: number, maxAgeMinutes: number = 5): boolean => {
    const now = Date.now();
    const maxAge = maxAgeMinutes * 60 * 1000;
    return (now - timestamp) > maxAge;
  }
};