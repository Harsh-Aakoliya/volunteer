// import { Slot, useRouter, useSegments } from 'expo-router';
// import { useEffect, useState } from 'react';
// import { View, ActivityIndicator } from 'react-native';
// import { storage } from '../utils/storage';

// export default function RootLayout() {
//   const [isLoading, setIsLoading] = useState(true);
//   const router = useRouter();
//   const segments = useSegments();

//   useEffect(() => {
//     checkAuth();
//   }, []);

//   const checkAuth = async () => {
//     const token = await storage.getToken();
//     setIsLoading(false);

//     if (!token) {
//       router.replace('/(auth)/login');
//     } else if (segments[0] !== '(main)') {
//       router.replace('/(main)/(tabs)/announcement');
//     }
//   };

//   if (isLoading) {
//     return (
//       <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
//         <ActivityIndicator size="large" color="#4A90E2" />
//       </View>
//     );
//   }

//   return <Slot />;
// }

// app/_layout.tsx
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, ToastAndroid, View } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as React from 'react';

import { AuthStorage } from '@/utils/authStorage';
import "../global.css";
import { initializeNotifications } from '@/utils/notificationSetup';
import { requestChatNotificationPermissions } from '@/utils/chatNotificationHandler';
import useNetworkStatus from '@/hooks/userNetworkStatus';
import OfflinePopup from '@/components/OfflinePopup';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(true);
  const isConnected = useNetworkStatus();

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
      <Stack screenOptions={{ headerShown: false }} />
      <OfflinePopup isVisible={!isConnected} />
    </>
  );
}