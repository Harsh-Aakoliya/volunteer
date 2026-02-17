// app/_layout.tsx
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Alert, AppState } from 'react-native';
import * as React from 'react';

import "../global.css";
import { initializeNotifications } from '@/utils/notificationSetup';
import { requestChatNotificationPermissions, setupChatNotificationListeners, clearAllNotifications } from '@/utils/chatNotificationHandler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SocketProvider } from '@/contexts/SocketContext';
import { VideoCallProvider } from '@/contexts/VideoCallContext';
import SplashScreen from '@/components/SplashScreen';

// Inner component that uses socket context
function AppContent() {
  const [isReady, setIsReady] = useState(true);

  useEffect(() => {
    if (Platform.OS === "web") {
      setIsReady(true);
      return;
    }

    const bootstrap = async () => {
      try {
        // Initialize notifications and listeners (don't delete update.apk on startup -
        // it may have been downloaded in background and user needs to install)
        if (Platform.OS !== 'web') {
          await initializeNotifications();
          await requestChatNotificationPermissions();
          
          // Setup chat notification listeners for deep linking
          setupChatNotificationListeners();

          // Clear all pending notifications when app opens (cold start)
          await clearAllNotifications();
        }

      } catch (error: any) {
        console.error('Bootstrap error:', error);
        if (Platform.OS !== 'web') {
          Alert.alert(
            'Startup Error',
            error?.message || 'Something went wrong during startup. Please try again.'
          );
        }
      } finally {
        setIsReady(true);
      }
    };

    bootstrap();

    // Clear notifications whenever app comes to foreground (from notification tap, app icon, recent apps)
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        clearAllNotifications();
      }
    });

    return () => subscription.remove();
  }, []);

  if (!isReady) {
    return <SplashScreen />;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false, statusBarStyle: "light", statusBarBackgroundColor: "#3b82f6" }} />
      {/* {Platform.OS !== 'web' && <OfflinePopup isVisible={!isConnected} />} */}
      {/* Global video call notification overlay */}
      {/* <GlobalVideoCallNotification /> */}
    </>
  );
}

export default function RootLayout() {
  return (
    // <GestureHandlerRootView style={{ flex: 1 }}>
      <SocketProvider>
        <VideoCallProvider>
          <AppContent />
        </VideoCallProvider>
      </SocketProvider>
    // </GestureHandlerRootView>
  );
}