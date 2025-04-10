import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import "../global.css"
export default function RootLayout() {
  const { isLoading, userToken } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    // const inAuthGroup = segments[0] === '(auth)';
    const inAuthGroup = true;

    if (!userToken && !inAuthGroup) {
      router.replace('/');
    } else if (userToken && inAuthGroup) {
      router.replace('/user/profile');
    }
  }, [userToken, segments, isLoading]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
