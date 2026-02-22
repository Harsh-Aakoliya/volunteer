// utils/chatNotificationHandler.ts
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Message } from '@/types/type';
import { MessageStorage } from '@/utils/messageStorage';

// Store for managing notification groups
interface NotificationGroup {
  roomId: string;
  roomName: string;
  messages: Array<{
    senderName: string;
    messageContent: string;
    timestamp: string;
  }>;
  notificationId: string;
}

// In-memory store for notification groups
const notificationGroups = new Map<string, NotificationGroup>();
// Track if we've already navigated from a notification to prevent duplicate navigation
let hasNavigatedFromNotification = false;
let lastNavigatedRoomId: string | null = null;

// Configure notification behavior when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data;
    
    // Check if it's a chat notification
    if (data?.type === 'chat_message') {
      console.log('📱 Chat notification received in foreground:', data);
      
      // For chat notifications, we might want to show them differently
      // or handle them based on current app state
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      };
    }

    // Default behavior for other notifications
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    };
  },
});

// Handle notification taps (when user taps on notification)
export const setupChatNotificationListeners = () => {
  // Listen for notification taps
  const subscription = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data;
    
    console.log('🔔 Notification tapped:', data);
    console.log("notification data", data);
    
    if (data?.type === 'chat_message') {
      handleChatNotificationTap(data);
    }
  });

  return subscription;
};

/** Build a Message from notification payload for local storage (so room can show it immediately on open). */
export function buildMessageFromNotificationData(data: any): Message | null {
  const roomId = data?.roomId ?? data?.room_id;
  const messageId = data?.messageId ?? data?.message_id;
  if (!roomId || !messageId) return null;

  const id = typeof messageId === 'string' && /^\d+$/.test(messageId) ? parseInt(messageId, 10) : messageId;
  const createdAt = data?.timestamp ?? data?.createdAt ?? new Date().toISOString();

  const num = (v: any): number | undefined => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = typeof v === 'number' ? v : parseInt(String(v), 10);
    return isNaN(n) ? undefined : n;
  };

  return {
    id,
    roomId,
    senderId: data?.senderId ?? data?.sender_id ?? '',
    senderName: data?.senderName ?? data?.sender_name ?? '',
    messageText: data?.messageText ?? data?.message_text ?? '',
    createdAt,
    messageType: data?.messageType ?? data?.message_type ?? 'text',
    replyMessageId: num(data?.replyMessageId ?? data?.reply_message_id),
    replyMessageText: data?.replyMessageText ?? data?.reply_message_text ?? undefined,
    replySenderName: data?.replySenderName ?? data?.reply_sender_name ?? undefined,
    replyMessageType: data?.replyMessageType ?? data?.reply_message_type ?? undefined,
    mediaFilesId: num(data?.mediaFilesId ?? data?.media_files_id),
    pollId: num(data?.pollId ?? data?.poll_id),
    tableId: num(data?.tableId ?? data?.table_id),
  };
}

/** Store notification message in local chat storage so opening the room shows it immediately. */
export async function storeMessageFromNotificationData(data: any): Promise<void> {
  try {
    const roomId = data?.roomId ?? data?.room_id;
    const message = buildMessageFromNotificationData(data);
    if (!roomId || !message) return;
    await MessageStorage.addMessage(roomId, message);
    console.log(`💾 [ChatNotification] Stored message ${message.id} for room ${roomId} from notification`);
  } catch (error) {
    console.error('❌ [ChatNotification] Error storing message from notification:', error);
  }
}

// Handle chat notification tap navigation
export const handleChatNotificationTap = async (data: any) => {
  try {
    console.log(`🚀 Handling chat notification tap:`, data);

    // Store message in local cache first so room can show it immediately when opened
    await storeMessageFromNotificationData(data);

    // Extract roomId from notification data
    const roomId = data?.roomId || data?.room_id;

    if (roomId) {
      // Prevent duplicate navigation if we're already navigating to this room
      if (hasNavigatedFromNotification && lastNavigatedRoomId === roomId) {
        console.log(`⚠️  Already navigated to room ${roomId}, skipping duplicate navigation`);
        return;
      }

      const canSendMessage = data?.canSendMessage === 'true' || data?.canSendMessage === '1';
      const roomName = data?.roomName || '';

      console.log(`📱 Navigating to chat room: ${roomId}, canSendMessage: ${canSendMessage}`);
      hasNavigatedFromNotification = true;
      lastNavigatedRoomId = roomId;

      // Use replace - pass canSendMessage so room shows message input immediately without waiting for API
      router.replace({
        pathname: `/chat/${roomId}`,
        params: {
          roomName,
          canSendMessage: canSendMessage ? 'true' : 'false',
        },
      });
      
      // Reset flag after a delay to allow normal navigation
      setTimeout(() => {
        hasNavigatedFromNotification = false;
        lastNavigatedRoomId = null;
      }, 2000);
    } else {
      console.log(`⚠️  No roomId found in notification data, navigating to chat list`);
      // Fallback: navigate to chat list if roomId is missing
      router.replace('/(drawer)');
    }
  } catch (error) {
    console.error('Error handling chat notification tap:', error);
    // Fallback navigation
    router.replace('/(drawer)');
  }
};

// Request notification permissions
export const requestChatNotificationPermissions = async () => {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    
    if (status !== 'granted') {
      console.log('❌ Notification permission not granted');
      return false;
    }
    
    console.log('✅ Chat notification permissions granted');
    return true;
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
};

// Clear all pending notifications from the notification panel (when user opens app)
export const clearAllNotifications = async () => {
  try {
    const deliveredNotifications = await Notifications.getPresentedNotificationsAsync();
    for (const notif of deliveredNotifications) {
      await Notifications.dismissNotificationAsync(notif.request.identifier);
    }
    if (deliveredNotifications.length > 0) {
      console.log(`🧹 Cleared ${deliveredNotifications.length} notification(s) from panel`);
    }
  } catch (error) {
    console.error('Error clearing all notifications:', error);
  }
};

// Clear notifications for a specific chat room
export const clearRoomNotifications = async (roomId: string) => {
  try {
    const deliveredNotifications = await Notifications.getPresentedNotificationsAsync();
    
    // Filter notifications for this specific room
    const roomNotificationIds = deliveredNotifications
      .filter(notif => 
        notif.request.content.data?.type === 'chat_message' && 
        notif.request.content.data?.roomId === roomId
      )
      .map(notif => notif.request.identifier);
    
    // Dismiss notifications for this room
    for (const id of roomNotificationIds) {
      await Notifications.dismissNotificationAsync(id);
    }
    
    // Clear the notification group from memory
    notificationGroups.delete(roomId);
    
    console.log(`🧹 Cleared ${roomNotificationIds.length} notifications for room ${roomId}`);
  } catch (error) {
    console.error('Error clearing room notifications:', error);
  }
};