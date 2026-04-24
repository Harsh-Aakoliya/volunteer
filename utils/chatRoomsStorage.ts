// utils/chatRoomStorage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatRoom, Community } from '@/types/type';

const CHAT_ROOMS_KEY = 'chat_rooms_cache';
const LAST_MESSAGES_KEY = 'last_messages_cache';
const COMMUNITIES_KEY = 'communities_cache';

interface CachedChatRooms {
  rooms: ChatRoom[];
  timestamp: number;
}

interface CachedLastMessages {
  messages: { [key: string]: any };
  timestamp: number;
}

interface CachedCommunities {
  communities: Community[];
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
  // Update a single room's last message
updateRoomLastMessage: async (roomId: string, lastMessage: any): Promise<void> => {
  try {
    const cached = await ChatRoomStorage.getChatRooms();
    if (cached?.rooms) {
      const updatedRooms = cached.rooms.map((room) => {
        if (room.roomId?.toString() === roomId) {
          return {
            ...room,
            lastMessage,
          };
        }
        return room;
      });
      await ChatRoomStorage.saveChatRooms(updatedRooms);
      console.log(`📝 Updated last message for room ${roomId}`);
    }
  } catch (error) {
    console.error('❌ Error updating room last message:', error);
  }
},

// Update a single room's unread count
updateRoomUnreadCount: async (roomId: string, unreadCount: number): Promise<void> => {
  try {
    const cached = await ChatRoomStorage.getChatRooms();
    if (cached?.rooms) {
      const updatedRooms = cached.rooms.map((room) => {
        if (room.roomId?.toString() === roomId) {
          return {
            ...room,
            unreadCount,
          };
        }
        return room;
      });
      await ChatRoomStorage.saveChatRooms(updatedRooms);
      console.log(`📝 Updated unread count for room ${roomId}: ${unreadCount}`);
    }
  } catch (error) {
    console.error('❌ Error updating room unread count:', error);
  }
},

  // Save communities to cache
  saveCommunities: async (communities: Community[]): Promise<void> => {
    try {
      const cacheData: CachedCommunities = {
        communities,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(COMMUNITIES_KEY, JSON.stringify(cacheData));
      console.log('💾 Communities saved to cache');
    } catch (error) {
      console.error('❌ Error saving communities to cache:', error);
    }
  },

  // Get cached communities
  getCommunities: async (): Promise<CachedCommunities | null> => {
    try {
      const data = await AsyncStorage.getItem(COMMUNITIES_KEY);
      if (data) {
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error('❌ Error getting communities from cache:', error);
      return null;
    }
  },

  // Clear all cache
  clearCache: async (): Promise<void> => {
    try {
      await AsyncStorage.multiRemove([CHAT_ROOMS_KEY, LAST_MESSAGES_KEY, COMMUNITIES_KEY]);
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