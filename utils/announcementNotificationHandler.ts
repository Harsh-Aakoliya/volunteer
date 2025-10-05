// utils/announcementNotificationHandler.ts
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { markAsRead } from "@/api/admin";
import { AuthStorage } from "@/utils/authStorage";

// Store for managing announcement notification groups
interface AnnouncementNotificationGroup {
  announcementId: string;
  announcementTitle: string;
  authorName: string;
  notifications: Array<{
    notificationId: string;
    timestamp: string;
  }>;
}

// In-memory store for announcement notification groups
const announcementNotificationGroups = new Map<string, AnnouncementNotificationGroup>();

// Store to track processed notifications to prevent duplicates
const processedNotifications = new Set<string>();
const navigationInProgress = new Set<string>();

// Handle announcement notification tap navigation - called by main notification handler
export const handleAnnouncementNotificationTap = async (data: any) => {
  try {
    const announcementId = data.announcementId;
    
    if (!announcementId) {
      console.log('No announcement ID found, redirecting to announcements tab');
      router.push('/(tabs)/announcement');
      return;
    }

    // Create a unique key for this notification
    const notificationKey = `${announcementId}_${data.timestamp || Date.now()}`;
    
    // Check if this notification has already been processed
    if (processedNotifications.has(notificationKey)) {
      console.log('🛑 Notification already processed, ignoring:', notificationKey);
      return;
    }

    // Check if navigation is already in progress for this announcement
    if (navigationInProgress.has(announcementId)) {
      console.log('🛑 Navigation already in progress for announcement:', announcementId);
      return;
    }

    // Mark as processed and in progress
    processedNotifications.add(notificationKey);
    navigationInProgress.add(announcementId);

    console.log(`🚀 Navigating to announcement from notification: ${announcementId}`);
    
    // Wait a bit to ensure app is fully loaded when coming from killed state
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const user = await AuthStorage.getUser();
    if (!user) {
      console.log('No user found, redirecting to login');
      router.replace('/(auth)/login');
      navigationInProgress.delete(announcementId);
      return;
    }

    // Navigate to the specific announcement
    router.push(`/announcement/${announcementId}`);
    
    // Mark as read after a short delay to ensure the announcement loads
    setTimeout(async () => {
      try {
        await markAsRead(parseInt(announcementId), user.userId);
        console.log('✅ Marked announcement as read:', announcementId);
      } catch (error) {
        console.error('❌ Error marking announcement as read:', error);
      } finally {
        // Remove from navigation in progress after processing
        navigationInProgress.delete(announcementId);
      }
    }, 1500);

    // Clean up old processed notifications (keep only last 50)
    if (processedNotifications.size > 50) {
      const notificationsArray = Array.from(processedNotifications);
      const toRemove = notificationsArray.slice(0, notificationsArray.length - 50);
      toRemove.forEach(key => processedNotifications.delete(key));
    }

  } catch (error) {
    console.error('Error handling announcement notification tap:', error);
    // Fallback navigation
    router.push('/(tabs)/announcement');
    navigationInProgress.delete(data.announcementId);
  }
};

// Create or update grouped notification for an announcement
export const createGroupedAnnouncementNotification = async (
  announcementTitle: string,
  authorName: string,
  announcementId: string,
  notificationType: 'announcement' | 'announcement_published' = 'announcement'
) => {
  try {
    const existingGroup = announcementNotificationGroups.get(announcementId);
    const timestamp = new Date().toISOString();
    const notificationId = `announcement_${announcementId}_${Date.now()}`;
    
    if (existingGroup) {
      // Update existing group
      existingGroup.notifications.push({
        notificationId,
        timestamp
      });
      
      // Keep only last 3 notifications to avoid notification being too long
      if (existingGroup.notifications.length > 3) {
        existingGroup.notifications = existingGroup.notifications.slice(-3);
      }
      
      // Cancel previous notification
      await Notifications.cancelScheduledNotificationAsync(existingGroup.notifications[existingGroup.notifications.length - 2]?.notificationId);
    } else {
      // Create new group
      const newGroup: AnnouncementNotificationGroup = {
        announcementId,
        announcementTitle,
        authorName,
        notifications: [{
          notificationId,
          timestamp
        }]
      };
      announcementNotificationGroups.set(announcementId, newGroup);
    }
    
    const group = announcementNotificationGroups.get(announcementId)!;
    const notificationCount = group.notifications.length;
    
    // Create notification body based on notification type and count
    let notificationTitle: string;
    let notificationBody: string;
    
    if (notificationType === 'announcement_published') {
      notificationTitle = 'Your announcement has been published';
      notificationBody = `"${announcementTitle}" has been successfully published`;
    } else {
      notificationTitle = `New Announcement from ${authorName}`;
      notificationBody = announcementTitle;
    }
    
    // Schedule the notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: notificationTitle,
        body: notificationBody,
        data: {
          type: notificationType,
          announcementId: announcementId,
          authorName: authorName,
          announcementTitle: announcementTitle,
          timestamp: timestamp
        },
      },
      trigger: null, // Show immediately
    });
    
    console.log(`📢 Grouped announcement notification created for announcement ${announcementId}`);
  } catch (error) {
    console.error('Error creating grouped announcement notification:', error);
  }
};

// Create local notification for testing (development only)
export const createTestAnnouncementNotification = async (
  announcementTitle: string,
  authorName: string,
  announcementId: string,
  notificationType: 'announcement' | 'announcement_published' = 'announcement'
) => {
  try {
    let notificationTitle: string;
    let notificationBody: string;
    
    if (notificationType === 'announcement_published') {
      notificationTitle = 'Your announcement has been published';
      notificationBody = `"${announcementTitle}" has been successfully published`;
    } else {
      notificationTitle = `New Announcement from ${authorName}`;
      notificationBody = announcementTitle;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: notificationTitle,
        body: notificationBody,
        data: {
          type: notificationType,
          announcementId: announcementId,
          authorName: authorName,
          announcementTitle: announcementTitle,
          timestamp: new Date().toISOString()
        },
      },
      trigger: null, // Show immediately
    });
    
    console.log('📢 Test announcement notification created');
  } catch (error) {
    console.error('Error creating test announcement notification:', error);
  }
};

// Get notification settings for announcement channel
export const getAnnouncementNotificationChannelSettings = () => {
  return {
    name: 'Announcements',
    description: 'Notifications for announcements',
    sound: 'default',
    priority: Notifications.AndroidNotificationPriority.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#10b981', // Green color for announcement notifications
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
  };
};

// Request notification permissions
export const requestAnnouncementNotificationPermissions = async () => {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    
    if (status !== 'granted') {
      console.log('❌ Notification permission not granted');
      return false;
    }
    
    console.log('✅ Announcement notification permissions granted');
    return true;
  } catch (error) {
    console.error('Error requesting announcement notification permissions:', error);
    return false;
  }
};

// Clear all announcement notifications (useful when user opens announcements)
export const clearAnnouncementNotifications = async () => {
  try {
    // Get all scheduled notifications
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    
    // Get all delivered notifications
    const deliveredNotifications = await Notifications.getPresentedNotificationsAsync();
    
    // Filter announcement notifications
    const announcementScheduledIds = scheduledNotifications
      .filter(notif => notif.content.data?.type === 'announcement' || notif.content.data?.type === 'announcement_published')
      .map(notif => notif.identifier);
    
    const announcementDeliveredIds = deliveredNotifications
      .filter(notif => notif.request.content.data?.type === 'announcement' || notif.request.content.data?.type === 'announcement_published')
      .map(notif => notif.request.identifier);
    
    // Cancel scheduled announcement notifications
    if (announcementScheduledIds.length > 0) {
      await Notifications.cancelScheduledNotificationAsync(announcementScheduledIds[0]);
    }
    
    // Dismiss delivered announcement notifications
    if (announcementDeliveredIds.length > 0) {
      await Notifications.dismissNotificationAsync(announcementDeliveredIds[0]); // Dismiss the first one as an example
    }
    
    console.log(`🧹 Cleared ${announcementScheduledIds.length + announcementDeliveredIds.length} announcement notifications`);
  } catch (error) {
    console.error('Error clearing announcement notifications:', error);
  }
};

// Clear notifications for a specific announcement
export const clearAnnouncementNotificationsById = async (announcementId: string) => {
  try {
    const deliveredNotifications = await Notifications.getPresentedNotificationsAsync();
    
    // Filter notifications for this specific announcement
    const announcementNotificationIds = deliveredNotifications
      .filter(notif => 
        (notif.request.content.data?.type === 'announcement' || notif.request.content.data?.type === 'announcement_published') && 
        notif.request.content.data?.announcementId === announcementId
      )
      .map(notif => notif.request.identifier);
    
    // Dismiss notifications for this announcement
    for (const id of announcementNotificationIds) {
      await Notifications.dismissNotificationAsync(id);
    }
    
    // Clear the notification group from memory
    announcementNotificationGroups.delete(announcementId);
    
    console.log(`🧹 Cleared ${announcementNotificationIds.length} notifications for announcement ${announcementId}`);
  } catch (error) {
    console.error('Error clearing announcement notifications:', error);
  }
};

export default {
  handleAnnouncementNotificationTap,
  createTestAnnouncementNotification,
  createGroupedAnnouncementNotification,
  getAnnouncementNotificationChannelSettings,
  requestAnnouncementNotificationPermissions,
  clearAnnouncementNotifications,
  clearAnnouncementNotificationsById
};
