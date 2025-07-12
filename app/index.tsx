// app/index.tsx
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { AuthStorage } from '@/utils/authStorage';
import MediaUploadApp from '@/components/chat/MediaUploader';
import Poling from '@/app/(tabs)/chat/Polling';
import * as Application from 'expo-application';
import { checkForUpdates } from '@/utils/updateChecker';

export default function Index() {
  const appVersion = Application.nativeApplicationVersion;
  console.log("current app version",appVersion);
  
  const router = useRouter();

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        // First check for updates
        console.log("Checking for updates...");
        // const updateCheckPassed = await checkForUpdates();
        
        // if (!updateCheckPassed) {
        //   console.log("Update check failed or user cancelled");
        //   return; // Don't proceed with auth check if update failed
        // }
        
        console.log("Update check passed, proceeding with auth check");
        
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
  }, []);

  return null; // This component doesn't render anything
  // return <MediaUploadApp/>
  // return <Poling/>
}

// import { useEvent } from 'expo';
// import { useVideoPlayer, VideoView } from 'expo-video';
// import { StyleSheet, View, Button } from 'react-native';
// import React from 'react';
// const videoSource =
// 'http://192.168.254.33:3000/media/chat/temp/5752729-uhd_3840_2160_30fps.mp4';
//   // 'http://192.168.254.33:3000/media/chat/2025-07-08T10-16-54-504Z_61_USR001_736/88c85ea5-0434-4f8e-ac00-fff8d8314147.mp4';

// export default function VideoScreen() {
//   const player = useVideoPlayer(videoSource, player => {
//     player.loop = true;
//     player.play();
//   });

//   const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

//   return (
//     <View style={styles.contentContainer}>
//       <VideoView style={styles.video} player={player} allowsFullscreen allowsPictureInPicture />
//       <View style={styles.controlsContainer}>
//       </View>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   contentContainer: {
//     flex: 1,
//     padding: 10,
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingHorizontal: 50,
//   },
//   video: {
//     width: 350,
//     height: 275,
//   },
//   controlsContainer: {
//     padding: 10,
//   },
// });