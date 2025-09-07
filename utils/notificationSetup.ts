// utils/notificationSetup.ts
import * as Notifications from "expo-notifications";
import { handleAppStartNotificationToken } from "@/api/auth";

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Setup notification listeners
export const setupNotificationListeners = () => {
  // Handle notification received while app is in foreground
  const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
    console.log('Notification received in foreground:', notification);
  });

  // Handle notification tapped
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
    console.log('Notification tapped:', response);
    
    // Handle navigation based on notification data
    const notificationData = response.notification.request.content.data;
    if (notificationData?.route) {
      // Navigate to the appropriate screen
      // You can implement navigation logic here based on the route
      console.log('Navigate to:', notificationData.route);
    }
  });

  // Cleanup function
  return () => {
    foregroundSubscription.remove();
    responseSubscription.remove();
  };
};

// Initialize notifications when app starts
export const initializeNotifications = async () => {
  try {
    // Setup notification listeners
    const cleanup = setupNotificationListeners();
    
    // Handle notification token for already logged in users
    await handleAppStartNotificationToken();
    
    return cleanup;
  } catch (error) {
    console.error('Error initializing notifications:', error);
  }
};
