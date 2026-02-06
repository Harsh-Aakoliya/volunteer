// utils/chatNotificationHandler.ts
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

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

// Handle chat notification tap navigation
export const handleChatNotificationTap = async (data: any) => {
  try {
    console.log(`🚀 Handling chat notification tap:`, data);
    
    // Extract roomId from notification data
    const roomId = data?.roomId || data?.room_id;
    
    if (roomId) {
      // Prevent duplicate navigation if we're already navigating to this room
      if (hasNavigatedFromNotification && lastNavigatedRoomId === roomId) {
        console.log(`⚠️  Already navigated to room ${roomId}, skipping duplicate navigation`);
        return;
      }
      
      console.log(`📱 Navigating to chat room: ${roomId}`);
      hasNavigatedFromNotification = true;
      lastNavigatedRoomId = roomId;
      
      // Use replace instead of push to avoid adding to navigation stack
      // This ensures back button goes to chat list, not re-opens the room
      router.replace(`/chat/${roomId}`);
      
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