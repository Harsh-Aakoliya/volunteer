// app/_layout.tsx
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { AuthStorage } from '@/utils/authStorage';
import "../global.css";
import { Text } from 'react-native';
import React from 'react';
import { initializeNotifications } from '@/utils/notificationSetup';
import { setupChatNotificationListeners, requestChatNotificationPermissions } from '@/utils/chatNotificationHandler';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  // console.log = () => {};
  useEffect(() => {
    // Preload any necessary data
    const bootstrap = async () => {
      try {
        // Initialize notifications
        await initializeNotifications();
        
        // Request chat notification permissions
        await requestChatNotificationPermissions();
        
        // Setup chat notification listeners
        setupChatNotificationListeners();
        
        // Any other initial setup can be done here
        setIsReady(true);
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