// utils/notificationHandler.ts
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { AuthStorage } from "@/utils/authStorage";
import { handleChatNotificationTap } from "./chatNotificationHandler";

export interface NotificationData {
  type: 'chat' | 'chat_message';
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
  private processedNotifications = new Set<string>();

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
    try {
      const initialNotification = await Notifications.getLastNotificationResponseAsync();
      
      if (initialNotification) {
        console.log('📱 Initial notification found (app opened from notification):', initialNotification);
        const notificationData = initialNotification.notification.request.content.data as NotificationData;
        
        console.log('📱 Notification data:', notificationData);
        
        if (this.isAppReady) {
          // Small delay to ensure router is ready
          setTimeout(() => {
            this.handleNotificationNavigation(notificationData);
          }, 500);
        } else {
          console.log('📱 App not ready yet, queuing notification');
          this.navigationQueue.push(notificationData);
        }
      }
    } catch (error) {
      console.error('Error handling initial notification:', error);
    }
  }

  // Main navigation handler
  private async handleNotificationNavigation(data: NotificationData) {
    try {
      console.log('Handling notification navigation:', data);

      // Create a unique key for this notification
      const notificationKey = `${data.type}_${data.announcementId || data.roomId}_${Date.now()}`;
      
      // Check if this notification has already been processed
      if (this.processedNotifications.has(notificationKey)) {
        console.log('🛑 Notification already processed, ignoring:', notificationKey);
        return;
      }

      // Mark as processed
      this.processedNotifications.add(notificationKey);

      if ((data.type === 'chat' || data.type === 'chat_message') && data.roomId) {
        await handleChatNotificationTap(data);
      } else if (data.route) {
        // Fallback to direct route navigation
        router.push(data.route as any);
      }

      // Clean up old processed notifications (keep only last 50)
      if (this.processedNotifications.size > 50) {
        const notificationsArray = Array.from(this.processedNotifications);
        const toRemove = notificationsArray.slice(0, notificationsArray.length - 50);
        toRemove.forEach(key => this.processedNotifications.delete(key));
      }
    } catch (error) {
      console.error('Error handling notification navigation:', error);
    }
  }

  // Show in-app notification when app is in foreground
  private showInAppNotification(notification: Notifications.Notification) {
    // You can implement a custom in-app notification here
    // For now, we'll just log it
    console.log('Showing in-app notification:', notification.request.content);
  }
}
// Export singleton instance
export const notificationHandler = NotificationHandler.getInstance();