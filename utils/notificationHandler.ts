// utils/notificationHandler.ts
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { markAsRead } from "@/api/admin";
import { AuthStorage } from "@/utils/authStorage";
import { socketService } from "@/utils/socketService";
import eventEmitter from "./eventEmitter";

export interface NotificationData {
  type: 'announcement' | 'chat';
  announcementId?: string;
  roomId?: string;
  title?: string;
  body?: string;
  route?: string;
}

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export class NotificationHandler {
  private static instance: NotificationHandler;
  private navigationQueue: NotificationData[] = [];
  private isAppReady = false;

  static getInstance(): NotificationHandler {
    if (!NotificationHandler.instance) {
      NotificationHandler.instance = new NotificationHandler();
    }
    return NotificationHandler.instance;
  }

  // Initialize notification handlers
  initialize() {
    // Handle notification received while app is in foreground
    const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received in foreground:', notification);
      // You can show custom alert or handle differently
      this.showInAppNotification(notification);
    });

    // Handle notification tapped (app in background or closed)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(async response => {
      console.log('Notification tapped:', response);
      
      const notificationData = response.notification.request.content.data as NotificationData;
      
      if (this.isAppReady) {
        await this.handleNotificationNavigation(notificationData);
      } else {
        // Queue the navigation if app is not ready yet
        this.navigationQueue.push(notificationData);
      }
    });

    // Handle notification when app starts from killed state
    this.handleInitialNotification();

    // Cleanup function
    return () => {
      foregroundSubscription.remove();
      responseSubscription.remove();
    };
  }

  // Set app ready state and process queued notifications
  setAppReady(ready: boolean) {
    this.isAppReady = ready;
    
    if (ready && this.navigationQueue.length > 0) {
      // Process all queued notifications
      this.navigationQueue.forEach(async (data) => {
        await this.handleNotificationNavigation(data);
      });
      this.navigationQueue = [];
    }
  }

  // Handle notification when app starts from killed state
  private async handleInitialNotification() {
    const initialNotification = await Notifications.getLastNotificationResponseAsync();
    
    if (initialNotification) {
      console.log('Initial notification found:', initialNotification);
      const notificationData = initialNotification.notification.request.content.data as NotificationData;
      
      if (this.isAppReady) {
        await this.handleNotificationNavigation(notificationData);
      } else {
        this.navigationQueue.push(notificationData);
      }
    }
  }

  // Main navigation handler
  private async handleNotificationNavigation(data: NotificationData) {
    try {
      console.log('Handling notification navigation:', data);

      if (data.type === 'announcement' && data.announcementId) {
        await this.handleAnnouncementNotification(data.announcementId);
      } else if ((data.type === 'chat' || data.type === 'chat_message') && data.roomId) {
        await this.handleChatNotification(data.roomId);
      } else if (data.route) {
        // Fallback to direct route navigation
        router.push(data.route as any);
      }
    } catch (error) {
      console.error('Error handling notification navigation:', error);
    }
  }

  // Handle announcement notification
  private async handleAnnouncementNotification(announcementId: string) {
    try {
      const user = await AuthStorage.getUser();
      if (!user) {
        console.log('No user found, redirecting to login');
        router.replace('/(auth)/login');
        return;
      }

      console.log('📢 Handling announcement notification for ID:', announcementId);

      // Navigate to announcement tab first
      router.replace('/(tabs)/announcement');
      
      // Wait a bit for the tab to load
      setTimeout(async () => {
        try {
          // Mark as read
          await markAsRead(parseInt(announcementId), user.userId);
          console.log('✅ Marked announcement as read:', announcementId);
          
          // Open the specific announcement via EventEmitter
          this.openSpecificAnnouncement(parseInt(announcementId));
        } catch (error) {
          console.error('❌ Error marking announcement as read:', error);
          // Still try to open the announcement even if marking as read fails
          this.openSpecificAnnouncement(parseInt(announcementId));
        }
      }, 800); // Increased timeout to ensure tab is fully loaded

    } catch (error) {
      console.error('❌ Error handling announcement notification:', error);
    }
  }

  // Handle chat notification
  private async handleChatNotification(roomId: string) {
    try {
      const user = await AuthStorage.getUser();
      if (!user) {
        console.log('No user found, redirecting to login');
        router.replace('/(auth)/login');
        return;
      }

      console.log('💬 Handling chat notification for room ID:', roomId);

      // Navigate to chat tab first
      router.replace('/(tabs)/chat');
      
      // Wait a bit for the tab to load
      setTimeout(async () => {
        try {
          // Connect to socket if not already connected
          if (!socketService.isConnected()) {
            console.log('🔌 Connecting to socket...');
            await socketService.connect(user.userId);
          }

          // Wait a moment for socket to fully connect
          setTimeout(async () => {
            try {
              // Join the specific room
              console.log('🚪 Joining room:', roomId);
              socketService.joinRoom(roomId);
              
              // Navigate to the specific chat room
              router.push(`/(tabs)/chat/${roomId}`);
              
              // Emit custom event for chat room opening via EventEmitter
              this.openSpecificChatRoom(roomId);
              
              console.log('✅ Successfully opened chat room:', roomId);
            } catch (roomError) {
              console.error('❌ Error joining room:', roomError);
            }
          }, 300);
          
        } catch (error) {
          console.error('❌ Error handling chat notification:', error);
        }
      }, 800); // Increased timeout to ensure tab is fully loaded

    } catch (error) {
      console.error('❌ Error handling chat notification:', error);
    }
  }

  // Open specific chat room (this will be handled by the chat screen)
  private openSpecificChatRoom(roomId: string) {
    console.log('Emitting openChatRoom event for roomId:', roomId);
    eventEmitter.emit('openChatRoom', { roomId });
  }

  // Open specific announcement (this will be handled by the announcement screen)
  private openSpecificAnnouncement(announcementId: number) {
    console.log('Emitting openAnnouncement event for announcementId:', announcementId);
    eventEmitter.emit('openAnnouncement', { announcementId });
  }

  // Show in-app notification when app is in foreground
  private showInAppNotification(notification: Notifications.Notification) {
    // You can implement a custom in-app notification here
    // For now, we'll just log it
    console.log('Showing in-app notification:', notification.request.content);
  }

  // Clear all notifications
  static async clearAllNotifications() {
    await Notifications.dismissAllNotificationsAsync();
  }

  // Clear specific notification
  static async clearNotification(identifier: string) {
    await Notifications.dismissNotificationAsync(identifier);
  }
}

// Export singleton instance
export const notificationHandler = NotificationHandler.getInstance();

// Helper function to create notification data
export const createNotificationData = (
  type: 'announcement' | 'chat',
  options: {
    announcementId?: number;
    roomId?: string;
    title?: string;
    body?: string;
  }
): NotificationData => {
  return {
    type,
    announcementId: options.announcementId?.toString(),
    roomId: options.roomId,
    title: options.title,
    body: options.body,
    route: type === 'announcement' ? '/(tabs)/announcement' : '/(tabs)/chat'
  };
};
