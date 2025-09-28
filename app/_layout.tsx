// app/_layout.tsx
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { AuthStorage } from '@/utils/authStorage';
import "../global.css";
import { Text } from 'react-native';
import React from 'react';
import { notificationHandler } from '@/utils/notificationHandler';
import { requestChatNotificationPermissions } from '@/utils/chatNotificationHandler';

// Import notification tester in development
if (__DEV__) {
  import('@/utils/notificationTester');
}

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  // console.log = () => {};
  useEffect(() => {
    // Preload any necessary data
    const bootstrap = async () => {
      try {
        // Initialize notification handler
        notificationHandler.initialize();
        
        // Request chat notification permissions
        await requestChatNotificationPermissions();
        
        // Any other initial setup can be done here
        setIsReady(true);
        
        // Mark app as ready for notifications
        notificationHandler.setAppReady(true);
      } catch (error) {
        console.error('Bootstrap error', error);
        setIsReady(true); // Still set ready even if notifications fail
      }
    };

    bootstrap();
  }, []);

  if (!isReady) {
    return <Text>Loading...</Text>; // Or a loading screen
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}