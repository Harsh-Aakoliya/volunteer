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
        const updateCheckPassed = await checkForUpdates();
        
        if (!updateCheckPassed) {
          console.log("Update check failed or user cancelled");
          return; // Don't proceed with auth check if update failed
        }
        
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

// const videoSource =
// "http://34.131.199.168:8080/?filename=temp.mp4";

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
//         <Button
//           title={isPlaying ? 'Pause' : 'Play'}
//           onPress={() => {
//             if (isPlaying) {
//               player.pause();
//             } else {
//               player.play();
//             }
//           }}
//         />
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




// // App.tsx - Usage Example
// // import React, { useState } from 'react';
// // import { View, Text, SafeAreaView } from 'react-native';
// // import DateTimePicker from '@/components/chat/DateTimePicker';

// // export default function App() {
// //   const [selectedDate, setSelectedDate] = useState<Date | null>(null);
// //   const [selectedTime, setSelectedTime] = useState<string | null>(null);

// //   return (
// //     <SafeAreaView className="flex-1 bg-gray-50">
// //       <View className="flex-1 justify-center px-4">
// //         <Text className="text-2xl font-bold text-center mb-8 text-gray-800">
// //           Schedule Message
// //         </Text>

// //         {/* Basic Usage */}
// //         <DateTimePicker
// //           selectedDate={selectedDate}
// //           setSelectedDate={setSelectedDate}
// //           selectedTime={selectedTime}
// //           setSelectedTime={setSelectedTime}
// //         />

// //         {/* Custom Styled Usage */}
// //         <View className="mt-8">
// //           <Text className="text-lg font-semibold mb-4 text-gray-700">
// //             Custom Styled:
// //           </Text>
// //           <DateTimePicker
// //             selectedDate={selectedDate}
// //             setSelectedDate={setSelectedDate}
// //             selectedTime={selectedTime}
// //             setSelectedTime={setSelectedTime}
// //             containerClassName="gap-2"
// //             dateButtonClassName="bg-blue-50 border-blue-200 shadow-sm"
// //             timeButtonClassName="bg-green-50 border-green-200 shadow-sm"
// //             dateButtonTextClassName="text-blue-700 font-medium"
// //             timeButtonTextClassName="text-green-700 font-medium"
// //           />
// //         </View>

// //         {/* Display Selected Values */}
// //         {(selectedDate || selectedTime) && (
// //           <View className="mt-8 p-4 bg-white rounded-lg shadow-sm">
// //             <Text className="text-lg font-semibold mb-2 text-gray-800">
// //               Selected:
// //             </Text>
// //             {selectedDate && (
// //               <Text className="text-gray-600">
// //                 Date: {selectedDate.toDateString()}
// //               </Text>
// //             )}
// //             {selectedTime && (
// //               <Text className="text-gray-600">
// //                 Time: {selectedTime}
// //               </Text>
// //             )}
// //           </View>
// //         )}
// //       </View>
// //     </SafeAreaView>
// //   );
// // }