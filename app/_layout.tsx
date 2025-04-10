// app/_layout.tsx
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { AuthStorage } from '@/utils/authStorage';
import "../global.css";

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Preload any necessary data
    const bootstrap = async () => {
      try {
        // Any initial setup can be done here
        setIsReady(true);
      } catch (error) {
        console.error('Bootstrap error', error);
      }
    };

    bootstrap();
  }, []);

  if (!isReady) {
    return null; // Or a loading screen
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}