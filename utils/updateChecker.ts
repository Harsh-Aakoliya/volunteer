//utils/updateChecker.ts
import { Alert, Linking } from 'react-native';
import * as Application from 'expo-application';
import * as FileSystem from 'expo-file-system';
import { API_URL } from '@/constants/api';
import axios from 'axios';

export interface UpdateProgress {
  isChecking: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  isInstalling: boolean;
  error?: string;
}

export type UpdateProgressCallback = (progress: UpdateProgress) => void;

// Store the granted SAF folder URI
let SEVAK_FOLDER_URI: string | null = null;

export const checkForUpdates = async (
  onProgress?: UpdateProgressCallback
): Promise<boolean> => {
  try {
    // Reset progress
    onProgress?.({
      isChecking: true,
      isDownloading: false,
      downloadProgress: 0,
      isInstalling: false,
    });

    // Get current app version
    const currentAppVersion = Application.nativeApplicationVersion || '1.0.0';
    console.log('🚀 Current app version:', currentAppVersion);

    // Get server version
    const serverResponse = await axios.get(`${API_URL}/api/version/current`);
    const serverVersion = serverResponse.data.currentenduserversion;
    console.log('🌐 Server version:', serverVersion);

    onProgress?.({
      isChecking: false,
      isDownloading: false,
      downloadProgress: 0,
      isInstalling: false,
    });

    // Compare versions
    if (currentAppVersion !== serverVersion) {
      console.log('🔄 Update available!');
      
      return new Promise((resolve) => {
        Alert.alert(
          'Update Available',
          `A new version (${serverVersion}) is available. Current version: ${currentAppVersion}. Would you like to update now?`,
          [
            {
              text: 'Later',
              onPress: () => resolve(false),
              style: 'cancel',
            },
            {
              text: 'Update Now',
              onPress: async () => {
                try {
                  await downloadAndInstallUpdate(serverVersion, onProgress);
                  resolve(true);
                } catch (error: any) {
                  console.error('❌ Update failed:', error);
                  onProgress?.({
                    isChecking: false,
                    isDownloading: false,
                    downloadProgress: 0,
                    isInstalling: false,
                    error: 'Update failed. Please try again.',
                  });
                  resolve(false);
                }
              },
            },
          ]
        );
      });
    } else {
      console.log('✅ App is up to date');
      return false;
    }
  } catch (error) {
    console.error('❌ Error checking for updates:', error);
    onProgress?.({
      isChecking: false,
      isDownloading: false,
      downloadProgress: 0,
      isInstalling: false,
      error: 'Failed to check for updates. Please try again.',
    });
    return false;
  }
};

// Request SAF permission and get the Sevak folder URI
const requestSAFPermission = async (): Promise<string | null> => {
  try {
    console.log('🔑 Requesting SAF permission...');
    
    return new Promise((resolve) => {
      Alert.alert(
        'Storage Permission Required',
        'Please select or create a "Sevak" folder in your device storage to download the update.',
        [
          {
            text: 'Cancel',
            onPress: () => resolve(null),
            style: 'cancel',
          },
          {
            text: 'Select Folder',
            onPress: async () => {
              try {
                const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
                if (permissions.granted) {
                  console.log('✅ SAF permission granted:', permissions.directoryUri);
                  SEVAK_FOLDER_URI = permissions.directoryUri;
                  resolve(permissions.directoryUri);
                } else {
                  console.log('❌ SAF permission denied');
                  resolve(null);
                }
              } catch (error) {
                console.error('❌ Error requesting SAF permission:', error);
                resolve(null);
              }
            },
          },
        ]
      );
    });
  } catch (error) {
    console.error('❌ Error in requestSAFPermission:', error);
    return null;
  }
};

// Check if SAF folder exists and what files are in it
const checkSAFFolder = async (folderUri: string): Promise<string[]> => {
  try {
    console.log('📁 Checking SAF folder contents...');
    const files = await FileSystem.StorageAccessFramework.readDirectoryAsync(folderUri);
    const fileNames = files.map(fileUri => {
      const decodedUri = decodeURIComponent(fileUri);
      return decodedUri.split('/').pop() || '';
    });
    console.log('📄 Files found in SAF folder:', fileNames);
    return fileNames;
  } catch (error) {
    console.error('❌ Error checking SAF folder:', error);
    return [];
  }
};

// Get MIME type for APK files
const getMimeType = (filename: string): string => {
  if (filename.endsWith('.apk')) {
    return 'application/vnd.android.package-archive';
  }
  return 'application/octet-stream';
};

const downloadAndInstallUpdate = async (
  version: string,
  onProgress?: UpdateProgressCallback
): Promise<void> => {
  try {
    console.log('📥 Starting download for version:', version);
    
    // Step 1: Get SAF permission if not already granted
    if (!SEVAK_FOLDER_URI) {
      SEVAK_FOLDER_URI = await requestSAFPermission();
      if (!SEVAK_FOLDER_URI) {
        throw new Error('Storage permission is required to download updates');
      }
    }
    
    onProgress?.({
      isChecking: false,
      isDownloading: true,
      downloadProgress: 0,
      isInstalling: false,
    });

    // Check existing files first
    const existingFiles = await checkSAFFolder(SEVAK_FOLDER_URI);
    const apkFileName = `Sevak-${version}.apk`;
    
    // If APK already exists, skip download and install directly
    if (existingFiles.includes(apkFileName)) {
      console.log('📦 APK already exists, skipping download');
      onProgress?.({
        isChecking: false,
        isDownloading: false,
        downloadProgress: 100,
        isInstalling: true,
      });
      
      // Find the existing APK file URI
      const files = await FileSystem.StorageAccessFramework.readDirectoryAsync(SEVAK_FOLDER_URI);
      const existingApkUri = files.find(uri => decodeURIComponent(uri).includes(apkFileName));
      
      if (existingApkUri) {
        await installAPK(existingApkUri, apkFileName, version);
        return;
      }
    }

    // Step 2: Download to cache directory first
    const tempFileName = `temp_${apkFileName}`;
    const tempFilePath = FileSystem.cacheDirectory + tempFileName;
    
    console.log('🔄 Downloading to cache:', tempFilePath);
    
    const downloadResumable = FileSystem.createDownloadResumable(
      `${API_URL}/api/version/download/${version}`,
      tempFilePath,
      {},
      ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
        if (totalBytesExpectedToWrite > 0) {
          const progress = (totalBytesWritten / totalBytesExpectedToWrite) * 100;
          const progressMB = (totalBytesWritten / (1024 * 1024)).toFixed(1);
          const totalMB = (totalBytesExpectedToWrite / (1024 * 1024)).toFixed(1);
          
          console.log(`📊 Download progress: ${progress.toFixed(1)}% (${progressMB}MB/${totalMB}MB)`);
          
          onProgress?.({
            isChecking: false,
            isDownloading: true,
            downloadProgress: progress,
            isInstalling: false,
          });
        }
      }
    );

    const result = await downloadResumable.downloadAsync();
    
    if (!result?.uri) {
      throw new Error('Download failed - no file URI returned');
    }

    console.log('✅ Download completed to cache:', result.uri);

    // Step 3: Create file in SAF folder
    console.log('📁 Creating file in SAF folder...');
    const safFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
      SEVAK_FOLDER_URI,
      apkFileName,
      getMimeType(apkFileName)
    );

    console.log('📄 SAF file created:', safFileUri);

    // Step 4: Read the downloaded APK file and write to SAF
    console.log('📖 Reading APK file as Base64...');
    const fileData = await FileSystem.readAsStringAsync(result.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log('✍️ Writing APK file to SAF folder...');
    await FileSystem.StorageAccessFramework.writeAsStringAsync(safFileUri, fileData, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Step 5: Clean up cache file
    await FileSystem.deleteAsync(result.uri);
    console.log('🧹 Cleaned up cache file');

    // Step 6: Verify the file was created successfully
    console.log('🔍 Verifying file creation...');
    const verifyFiles = await checkSAFFolder(SEVAK_FOLDER_URI);
    if (!verifyFiles.includes(apkFileName)) {
      throw new Error('APK file was not created successfully in SAF folder');
    }

    console.log('✅ APK file successfully stored in SAF folder');

    // Step 7: Install the APK
    onProgress?.({
      isChecking: false,
      isDownloading: false,
      downloadProgress: 100,
      isInstalling: true,
    });

    await installAPK(safFileUri, apkFileName, version);

  } catch (error: any) {
    console.error('❌ Error during download and install:', error);
    onProgress?.({
      isChecking: false,
      isDownloading: false,
      downloadProgress: 0,
      isInstalling: false,
      error: `Update failed: ${error.message}`,
    });
    throw error;
  }
};

const installAPK = async (fileUri: string, fileName: string, version: string): Promise<void> => {
  try {
    console.log('🔧 Installing APK:', fileName);
    console.log('📍 File URI:', fileUri);
    
    // Get content URI for the APK file
    const contentUri = await FileSystem.getContentUriAsync(fileUri);
    console.log('🔗 Content URI:', contentUri);

    // Open the APK file with the system package installer
    const result = await Linking.openURL(contentUri);
    console.log('📱 APK installation initiated:', result);

    // Show success message
    Alert.alert(
      'Installation Started',
      `APK for version ${version} has been opened with the system installer. Please follow the on-screen instructions to complete the installation.`,
      [{ text: 'OK' }]
    );

  } catch (error: any) {
    console.error('❌ Error installing APK:', error);
    Alert.alert(
      'Installation Error',
      `Failed to install the APK: ${error.message}. Please try installing manually from the selected folder.`,
      [{ text: 'OK' }]
    );
    throw error;
  }
}; 