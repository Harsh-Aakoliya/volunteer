// utils/notificationSetup.ts
import { handleAppStartNotificationToken } from "@/api/auth";
import { notificationHandler } from "@/utils/notificationHandler";

// Initialize notifications when app starts
export const initializeNotifications = async () => {
  try {
    // Initialize the notification handler
    const cleanup = notificationHandler.initialize();
    
    // Handle notification token for already logged in users
    await handleAppStartNotificationToken();
    
    // Set app as ready to process queued notifications
    notificationHandler.setAppReady(true);
    
    return cleanup;
  } catch (error) {
    console.error('Error initializing notifications:', error);
  }
};