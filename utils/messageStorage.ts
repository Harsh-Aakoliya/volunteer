// utils/messageStorage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Message } from '@/types/type';

const MESSAGE_CACHE_PREFIX = 'chat_messages_';
const MESSAGE_METADATA_PREFIX = 'chat_metadata_';

interface CachedMessages {
  messages: Message[];
  timestamp: number;
  lastMessageId: number | null;
}

interface MessageMetadata {
  lastSyncTimestamp: number;
  totalMessages: number;
  lastMessageId: number | null;
}

export const MessageStorage = {
  // Get cache key for a specific room
  getCacheKey: (roomId: string): string => {
    return `${MESSAGE_CACHE_PREFIX}${roomId}`;
  },

  getMetadataKey: (roomId: string): string => {
    return `${MESSAGE_METADATA_PREFIX}${roomId}`;
  },

  // Save messages for a specific room
  saveMessages: async (roomId: string, messages: Message[]): Promise<void> => {
    try {
      const cacheKey = MessageStorage.getCacheKey(roomId);
      const lastMessage = messages[messages.length - 1];
      
      const cacheData: CachedMessages = {
        messages,
        timestamp: Date.now(),
        lastMessageId: lastMessage?.id as number || null
      };
      
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
      
      // Also save metadata
      const metadataKey = MessageStorage.getMetadataKey(roomId);
      const metadata: MessageMetadata = {
        lastSyncTimestamp: Date.now(),
        totalMessages: messages.length,
        lastMessageId: lastMessage?.id as number || null
      };
      await AsyncStorage.setItem(metadataKey, JSON.stringify(metadata));
      
      console.log(`💾 Saved ${messages.length} messages for room ${roomId}`);
    } catch (error) {
      console.error('❌ Error saving messages to cache:', error);
    }
  },

  // Get cached messages for a specific room
  getMessages: async (roomId: string): Promise<CachedMessages | null> => {
    try {
      const cacheKey = MessageStorage.getCacheKey(roomId);
      const data = await AsyncStorage.getItem(cacheKey);
      
      if (data) {
        const parsed = JSON.parse(data) as CachedMessages;
        console.log(`📦 Found ${parsed.messages.length} cached messages for room ${roomId}`);
        return parsed;
      }
      return null;
    } catch (error) {
      console.error('❌ Error getting messages from cache:', error);
      return null;
    }
  },

  // Add a single message to cache (for real-time updates)
  addMessage: async (roomId: string, message: Message): Promise<void> => {
    try {
      const cachedData = await MessageStorage.getMessages(roomId);
      
      if (cachedData) {
        // Check if message already exists
        const exists = cachedData.messages.some(m => m.id === message.id);
        if (!exists) {
          cachedData.messages.push(message);
          await MessageStorage.saveMessages(roomId, cachedData.messages);
          console.log(`➕ Added message ${message.id} to cache for room ${roomId}`);
        }
      } else {
        // No cache exists, create new one
        await MessageStorage.saveMessages(roomId, [message]);
      }
    } catch (error) {
      console.error('❌ Error adding message to cache:', error);
    }
  },

  // Update a single message in cache (for edits)
  updateMessage: async (roomId: string, messageId: string | number, updates: Partial<Message>): Promise<void> => {
    try {
      const cachedData = await MessageStorage.getMessages(roomId);
      
      if (cachedData) {
        const messageIndex = cachedData.messages.findIndex(m => m.id === messageId);
        if (messageIndex !== -1) {
          cachedData.messages[messageIndex] = {
            ...cachedData.messages[messageIndex],
            ...updates
          };
          await MessageStorage.saveMessages(roomId, cachedData.messages);
          console.log(`✏️ Updated message ${messageId} in cache for room ${roomId}`);
        }
      }
    } catch (error) {
      console.error('❌ Error updating message in cache:', error);
    }
  },

  // Remove messages from cache (for deletions)
  removeMessages: async (roomId: string, messageIds: (string | number)[]): Promise<void> => {
    try {
      const cachedData = await MessageStorage.getMessages(roomId);
      
      if (cachedData) {
        cachedData.messages = cachedData.messages.filter(
          m => !messageIds.includes(m.id)
        );
        await MessageStorage.saveMessages(roomId, cachedData.messages);
        console.log(`🗑️ Removed ${messageIds.length} messages from cache for room ${roomId}`);
      }
    } catch (error) {
      console.error('❌ Error removing messages from cache:', error);
    }
  },

  // Detect changes between cached and fresh messages
  detectChanges: (cachedMessages: Message[], freshMessages: Message[]): {
    newMessages: Message[];
    updatedMessages: Message[];
    deletedMessageIds: (string | number)[];
    hasChanges: boolean;
  } => {
    const cachedMap = new Map(cachedMessages.map(m => [m.id, m]));
    const freshMap = new Map(freshMessages.map(m => [m.id, m]));

    const newMessages: Message[] = [];
    const updatedMessages: Message[] = [];
    const deletedMessageIds: (string | number)[] = [];

    // Find new and updated messages
    for (const freshMsg of freshMessages) {
      const cachedMsg = cachedMap.get(freshMsg.id);
      
      if (!cachedMsg) {
        // New message
        newMessages.push(freshMsg);
      } else {
        // Check if message was updated
        if (MessageStorage.isMessageUpdated(cachedMsg, freshMsg)) {
          updatedMessages.push(freshMsg);
        }
      }
    }

    // Find deleted messages
    for (const cachedMsg of cachedMessages) {
      if (!freshMap.has(cachedMsg.id)) {
        deletedMessageIds.push(cachedMsg.id);
      }
    }

    const hasChanges = newMessages.length > 0 || updatedMessages.length > 0 || deletedMessageIds.length > 0;

    if (hasChanges) {
      console.log(`🔍 Changes detected: ${newMessages.length} new, ${updatedMessages.length} updated, ${deletedMessageIds.length} deleted`);
    }

    return { newMessages, updatedMessages, deletedMessageIds, hasChanges };
  },

  // Check if a message was updated
  isMessageUpdated: (cached: Message, fresh: Message): boolean => {
    return (
      cached.messageText !== fresh.messageText ||
      cached.isEdited !== fresh.isEdited ||
      cached.editedAt !== fresh.editedAt ||
      cached.editedBy !== fresh.editedBy ||
      cached.editorName !== fresh.editorName ||
      cached.createdAt !== fresh.createdAt ||
      cached.editedAt !== fresh.editedAt ||
      cached.mediaFilesId !== fresh.mediaFilesId ||
      cached.pollId !== fresh.pollId ||
      cached.tableId !== fresh.tableId ||
      cached.replyMessageId !== fresh.replyMessageId ||
      cached.replySenderName !== fresh.replySenderName ||
      cached.replyMessageText !== fresh.replyMessageText ||
      cached.replyMessageType !== fresh.replyMessageType ||
      cached.senderName !== fresh.senderName ||
      cached.senderId !== fresh.senderId ||
      cached.messageType !== fresh.messageType
    );
  }
};