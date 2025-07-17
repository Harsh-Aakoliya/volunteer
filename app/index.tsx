// app/index.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { AuthStorage } from '@/utils/authStorage';
import MediaUploadApp from '@/components/chat/MediaUploader';
import Poling from '@/app/(tabs)/chat/Polling';
import * as Application from 'expo-application';
import { checkForUpdates } from '@/utils/updateChecker';
import React from 'react';
import { Updater } from '@/components/Updater';
import { VersionChecker } from '@/components/VersionChecker';

export default function Index() {
  const appVersion = Application.nativeApplicationVersion;
  console.log("current app version", appVersion);
  
  const router = useRouter();
  const [versionCheckComplete, setVersionCheckComplete] = useState(false);

  const handleUpdateCheckComplete = (updateRequired: boolean) => {
    console.log("Version check complete, update required:", updateRequired);
    setVersionCheckComplete(true);
  };

  useEffect(() => {
    // Only check auth status after version check is complete
    if (!versionCheckComplete) {
      return;
    }

    const checkAuthStatus = async () => {
      try {
        const token = await AuthStorage.getToken();
        console.log(`Token: ${token}`); // Log the token for debugging
        if (token) {
          // User is authenticated, redirect to announcement
          console.log("redirecting to announcement");
          router.replace("/announcement");
        } else {
          // No token, redirect to login
          console.log("redirecting to login");
          router.replace("/login");
        }
      } catch (error) {
        console.error('Auth check error', error);
        router.replace("/login");
      }
    };

    checkAuthStatus();
  }, [versionCheckComplete]);

  return (
    <VersionChecker onUpdateCheckComplete={handleUpdateCheckComplete} />
  );
  // return <MediaUploadApp/>
  // return <Poling/>
}