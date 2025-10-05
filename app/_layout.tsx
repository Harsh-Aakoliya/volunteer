// app/_layout.tsx
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, ToastAndroid } from 'react-native';
import * as FileSystem from 'expo-file-system';
import React from 'react';

import { AuthStorage } from '@/utils/authStorage';
import "../global.css";
import { initializeNotifications } from '@/utils/notificationSetup';
import { requestChatNotificationPermissions } from '@/utils/chatNotificationHandler';
import { requestAnnouncementNotificationPermissions } from '@/utils/announcementNotificationHandler';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
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
            ToastAndroid.show( 'APK cleanup complete', ToastAndroid.SHORT);
          }
        } catch (cleanupError) {
          console.warn('⚠️ APK cleanup failed:', cleanupError);
        }

        // 🛠️ STEP 2: Initialize notifications and listeners
        await initializeNotifications();
        await requestChatNotificationPermissions();
        await requestAnnouncementNotificationPermissions();

        // ✅ STEP 3: Any other app bootstrap logic (if needed)
        // e.g., await AuthStorage.loadUser(), load settings, etc.

      } catch (error) {
        console.error('Bootstrap error:', error);
      } finally {
        setIsReady(true);
      }
    };

    bootstrap();
  }, []);

  if (!isReady) {
    return <Text>Loading...</Text>; // You can replace with a splash/loading component
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
