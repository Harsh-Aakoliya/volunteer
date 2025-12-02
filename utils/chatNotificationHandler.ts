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
    console.log(`🚀 Navigating to chat tab from notification`);
    
    // Always navigate to chat tab (index.tsx) instead of specific room
    // This allows user to see all rooms with unread counts and last messages
    router.push('/(drawer)');
  } catch (error) {
    console.error('Error handling chat notification tap:', error);
    // Fallback navigation
    router.push('/(drawer)');
  }
};

// Create or update grouped notification for a room
export const createGroupedChatNotification = async (
  roomName: string,
  senderName: string,
  messageContent: string,
  roomId: string
) => {
  try {
    const existingGroup = notificationGroups.get(roomId);
    const timestamp = new Date().toISOString();
    
    if (existingGroup) {
      // Update existing group
      existingGroup.messages.push({
        senderName,
        messageContent,
        timestamp
      });
      
      // Keep only last 3 messages to avoid notification being too long
      if (existingGroup.messages.length > 3) {
        existingGroup.messages = existingGroup.messages.slice(-3);
      }
      
      // Cancel previous notification
      await Notifications.cancelScheduledNotificationAsync(existingGroup.notificationId);
    } else {
      // Create new group
      const newGroup: NotificationGroup = {
        roomId,
        roomName,
        messages: [{
          senderName,
          messageContent,
          timestamp
        }],
        notificationId: `chat_${roomId}_${Date.now()}`
      };
      notificationGroups.set(roomId, newGroup);
    }
    
    const group = notificationGroups.get(roomId)!;
    const messageCount = group.messages.length;
    
    // Create notification body based on message count
    let notificationBody: string;
    if (messageCount === 1) {
      notificationBody = `${senderName}: ${messageContent}`;
    } else {
      const uniqueSenders = [...new Set(group.messages.map(m => m.senderName))];
      if (uniqueSenders.length === 1) {
        notificationBody = `${uniqueSenders[0]}: ${messageCount} messages`;
      } else {
        notificationBody = `${uniqueSenders.length} people: ${messageCount} messages`;
      }
    }
    
    // Schedule the notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: roomName,
        body: notificationBody,
        data: {
          type: 'chat_message',
          roomId: roomId,
          roomName: roomName,
          messageCount: messageCount,
          timestamp: timestamp
        },
      },
      trigger: null, // Show immediately
    });
    
    // Update the notification ID in the group
    group.notificationId = `chat_${roomId}_${Date.now()}`;
    
    console.log(`📱 Grouped chat notification created for room ${roomId} with ${messageCount} messages`);
  } catch (error) {
    console.error('Error creating grouped notification:', error);
  }
};

// Create local notification for testing (development only)
export const createTestChatNotification = async (
  roomName: string,
  senderName: string,
  messageContent: string,
  roomId: string
) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: roomName,
        body: `${senderName}: ${messageContent}`,
        data: {
          type: 'chat_message',
          roomId: roomId,
          roomName: roomName,
          senderName: senderName,
          messageType: 'text',
          timestamp: new Date().toISOString()
        },
      },
      trigger: null, // Show immediately
    });
    
    console.log('📱 Test chat notification created');
  } catch (error) {
    console.error('Error creating test notification:', error);
  }
};

// Get notification settings for chat channel
export const getChatNotificationChannelSettings = () => {
  return {
    name: 'Chat Messages',
    description: 'Notifications for chat messages',
    sound: 'default',
    priority: Notifications.AndroidNotificationPriority.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0284c7', // Blue color for chat notifications
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
  };
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

// Clear all chat notifications (useful when user opens chat)
export const clearChatNotifications = async () => {
  try {
    // Get all scheduled notifications
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    
    // Get all delivered notifications
    const deliveredNotifications = await Notifications.getPresentedNotificationsAsync();
    
    // Filter chat notifications
    const chatScheduledIds = scheduledNotifications
      .filter(notif => notif.content.data?.type === 'chat_message')
      .map(notif => notif.identifier);
    
    const chatDeliveredIds = deliveredNotifications
      .filter(notif => notif.request.content.data?.type === 'chat_message')
      .map(notif => notif.request.identifier);
    
    // Cancel scheduled chat notifications
    if (chatScheduledIds.length > 0) {
      await Notifications.cancelScheduledNotificationAsync(chatScheduledIds[0]);
    }
    
    // Dismiss delivered chat notifications
    if (chatDeliveredIds.length > 0) {
      await Notifications.dismissNotificationAsync(chatDeliveredIds[0]); // Dismiss the first one as an example
    }
    
    console.log(`🧹 Cleared ${chatScheduledIds.length + chatDeliveredIds.length} chat notifications`);
  } catch (error) {
    console.error('Error clearing chat notifications:', error);
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

export default {
  setupChatNotificationListeners,
  createTestChatNotification,
  createGroupedChatNotification,
  getChatNotificationChannelSettings,
  requestChatNotificationPermissions,
  clearChatNotifications,
  clearRoomNotifications
};
