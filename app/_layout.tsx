// app/_layout.tsx
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Text, ToastAndroid, View } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as React from 'react';

import "../global.css";
import { initializeNotifications } from '@/utils/notificationSetup';
import { requestChatNotificationPermissions } from '@/utils/chatNotificationHandler';
import useNetworkStatus from '@/hooks/userNetworkStatus';
import OfflinePopup from '@/components/OfflinePopup';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SocketProvider, useSocket } from '@/contexts/SocketContext';

// Inner component that uses socket context
function AppContent() {
  const [isReady, setIsReady] = useState(true);
  const isConnected = useNetworkStatus();

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
        }

        // ✅ NOTE: Socket initialization is now done lazily in the chat screens
        // after API URL is configured in app/index.tsx

      } catch (error) {
        console.error('Bootstrap error:', error);
      } finally {
        setIsReady(true);
      }
    };

    bootstrap();
  }, []);

  if (!isReady) {
    return (
      <View className="flex-1 items-center justify-center bg-blue-500">
        <Text className="text-white text-2xl font-bold">
          Loading...
        </Text>
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false, statusBarStyle: "light", statusBarBackgroundColor: "#3b82f6" }} />
      {Platform.OS !== 'web' && <OfflinePopup isVisible={!isConnected} />}
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SocketProvider>
        <AppContent />
      </SocketProvider>
    </GestureHandlerRootView>
  );
}
