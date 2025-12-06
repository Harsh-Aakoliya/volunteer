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
import { useEffect, useState, useRef } from 'react';
import { Text, ToastAndroid, View, AppState, AppStateStatus } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as React from 'react';

import { AuthStorage } from '@/utils/authStorage';
import "../global.css";
import { initializeNotifications } from '@/utils/notificationSetup';
import { requestChatNotificationPermissions } from '@/utils/chatNotificationHandler';
import useNetworkStatus from '@/hooks/userNetworkStatus';
import OfflinePopup from '@/components/OfflinePopup';
import socketService from '@/utils/socketService';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(true);
  const isConnected = useNetworkStatus();
  const appState = useRef<AppStateStatus>(AppState.currentState);

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

  // Track app state for global online/offline status
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      console.log('📱 AppState changed:', appState.current, '->', nextAppState);

      // App coming to foreground (from background or inactive)
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('✅ App came to foreground');
        
        // Check if user is logged in
        const userData = await AuthStorage.getUser();
        if (userData && userData.userId) {
          console.log('👤 User is logged in, setting online status');
          
          // Connect socket if not connected
          if (!socketService.socket?.connected) {
            socketService.connect();
          }
          
          // Set user as online globally
          if (socketService.socket?.connected) {
            socketService.identify(userData.userId);
            socketService.setUserOnline(userData.userId);
          }
        }
      }

      // App going to background or inactive
      if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        console.log('❌ App going to background');
        
        // Check if user is logged in
        const userData = await AuthStorage.getUser();
        if (userData && userData.userId) {
          console.log('👤 User was logged in, setting offline status');
          
          // Set user as offline globally
          if (socketService.socket?.connected) {
            socketService.setUserOffline(userData.userId);
          }
        }
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
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
        <GestureHandlerRootView style={{ flex: 1 }}>

      <Stack screenOptions={{ headerShown: false, statusBarStyle: "light", statusBarBackgroundColor: "#3b82f6"}} />
      <OfflinePopup isVisible={!isConnected} />
      </GestureHandlerRootView>

    </>
  );
}