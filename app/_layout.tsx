// app/_layout.tsx
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ToastAndroid, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as React from 'react';

import "../global.css";
import { initializeNotifications } from '@/utils/notificationSetup';
import { requestChatNotificationPermissions, setupChatNotificationListeners } from '@/utils/chatNotificationHandler';
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
        // 🧹 STEP 1: Clean up leftover APK first
        const apkPath = FileSystem.documentDirectory + 'update.apk';
        try {
          const info = await FileSystem.getInfoAsync(apkPath);
          if (info.exists) {
            ToastAndroid.show('Cleaning leftover update.apk', ToastAndroid.SHORT);
            console.log('🧹 Cleaning leftover update.apk:', apkPath);
            await FileSystem.deleteAsync(apkPath, { idempotent: true });
            console.log('✅ APK cleanup complete');
            ToastAndroid.show('APK cleanup complete', ToastAndroid.SHORT);
          }
        } catch (cleanupError) {
          console.warn('⚠️ APK cleanup failed:', cleanupError);
        }

        // 🛠️ STEP 2: Initialize notifications and listeners
        if (Platform.OS !== 'web') {
          await initializeNotifications();
          await requestChatNotificationPermissions();
          
          // Setup chat notification listeners for deep linking
          setupChatNotificationListeners();
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SocketProvider>
        <VideoCallProvider>
          <AppContent />
        </VideoCallProvider>
      </SocketProvider>
    </GestureHandlerRootView>
  );
}