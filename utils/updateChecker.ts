import { Alert } from 'react-native';
import * as Application from 'expo-application';
import { getCurrentVersion, downloadAPK, installAPK, deleteOldAPK } from '@/api/version';

export const checkForUpdates = async (): Promise<boolean> => {
  try {
    // Get current app version
    const currentAppVersion = Application.nativeApplicationVersion;
    console.log('Current app version:', currentAppVersion);

    // Get server version
    const serverResponse = await getCurrentVersion();
    const serverVersion = serverResponse.currentVersion;
    console.log('Server version:', serverVersion);
     console.log("cheking condition")
    console.log("currentAppVersion",currentAppVersion);
    console.log("currentserverVersion",serverVersion);
    // Compare versions
    if (currentAppVersion !== serverVersion) {
      console.log('Update available!');
      
      return new Promise((resolve) => {
        Alert.alert(
          'Update Available',
          `A new version (${serverVersion}) is available. Your current version is ${currentAppVersion}. Please update to continue using the app.`,
          [
            {
              text: 'Cancel',
              onPress: () => {
                console.log('User cancelled update');
                // Exit the app
                // Note: In React Native, you can't directly exit the app
                // The user will need to manually close it
                resolve(false);
              },
              style: 'cancel',
            },
            {
              text: 'Download & Install',
              onPress: async () => {
                try {
                  console.log('Starting update process...');
                  
                  // Download the new APK
                  const apkUri = await downloadAPK(serverVersion);
                  console.log('APK downloaded:', apkUri);
                  
                  // Delete old APK files if they exist
                  await deleteOldAPK(apkUri);
                  
                  // Show success message with instructions
                  Alert.alert(
                    'Download Complete',
                    `APK downloaded successfully. Please install it manually:\n\n1. Open your file manager\n2. Navigate to Downloads folder\n3. Find "app-${serverVersion}.apk"\n4. Tap to install\n\nNote: You may need to enable "Install from unknown sources" in settings.`,
                    [
                      {
                        text: 'OK',
                        onPress: () => {
                          console.log('User acknowledged download completion');
                          resolve(true);
                        }
                      }
                    ]
                  );
                  
                } catch (error) {
                  console.error('Error during update:', error);
                  Alert.alert(
                    'Update Failed',
                    'Failed to download the update. Please try again or contact support.',
                    [{ text: 'OK' }]
                  );
                  resolve(false);
                }
              },
            },
          ],
          { cancelable: false }
        );
      });
    } else {
      console.log('App is up to date');
      return true;
    }
  } catch (error) {
    console.error('Error checking for updates:', error);
    // If we can't check for updates, allow the app to continue
    return true;
  }
}; 