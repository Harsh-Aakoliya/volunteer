// app/index.tsx
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { AuthStorage } from '@/utils/authStorage';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const token = await AuthStorage.getToken();
        console.log(`Token: ${token}`); // Log the token for debugging
        if (token) {
          // User is authenticated, redirect to announcement
          router.replace("/announcement");
        } else {
          // No token, redirect to login
          router.replace("/login");
        }
      } catch (error) {
        console.error('Auth check error', error);
        router.replace("/login");
      }
    };

    checkAuthStatus();
  }, []);

  return null; // This component doesn't render anything
}