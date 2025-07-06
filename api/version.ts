import axios from 'axios';
import { API_URL } from '@/constants/api';
import * as FileSystem from 'expo-file-system';
import { Linking } from 'react-native';

// Get current version from server
export const getCurrentVersion = async () => {
  try {
    const response = await axios.get(`${API_URL}/api/version/current`);
    console.log("response from getCurrentVersion",response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching current version:', error);
    throw error;
  }
};

// Download APK file
export const downloadAPK = async (version: string) => {
  try {
    const downloadUrl = `${API_URL}/api/version/download/${version}`;
    const fileName = `app-${version}.apk`;
    // Use document directory for better compatibility with package installer
    const fileUri = `${FileSystem.documentDirectory}${fileName}`;
    
    console.log('Downloading APK from:', downloadUrl);
    console.log('Saving to:', fileUri);
    
    const downloadResumable = FileSystem.createDownloadResumable(
      downloadUrl,
      fileUri,
      {},
      (downloadProgress) => {
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        console.log(`Download progress: ${progress * 100}%`);
      }
    );

    const downloadResult = await downloadResumable.downloadAsync();
    if (!downloadResult) {
      throw new Error('Download failed - no result returned');
    }
    
    console.log('Download completed:', downloadResult.uri);
    
    // Try to copy to a more accessible location for manual installation
    try {
      const accessibleUri = `${FileSystem.documentDirectory}Downloads/${fileName}`;
      await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}Downloads/`, { intermediates: true });
      await FileSystem.copyAsync({
        from: downloadResult.uri,
        to: accessibleUri
      });
      console.log('APK copied to accessible location:', accessibleUri);
      return accessibleUri;
    } catch (copyError) {
      console.log('Could not copy to accessible location, using original:', copyError);
      return downloadResult.uri;
    }
  } catch (error) {
    console.error('Error downloading APK:', error);
    throw error;
  }
};

// Install APK file
export const installAPK = async (fileUri: string) => {
  try {
    console.log('Installing APK from:', fileUri);
    
    // For Android, we need to handle the installation differently
    // Let's try to open the APK file directly
    try {
      await Linking.openURL(fileUri);
      console.log('APK installation initiated via direct URI');
    } catch (directError) {
      console.log('Direct URI failed, trying file:// protocol:', directError);
      
      // Try with file:// protocol
      const fileUrl = `file://${fileUri}`;
      await Linking.openURL(fileUrl);
      console.log('APK installation initiated via file:// protocol');
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error installing APK:', error);
    throw error;
  }
};

// Delete old APK file
export const deleteOldAPK = async (fileUri: string) => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(fileUri);
      console.log('Old APK deleted:', fileUri);
    }
  } catch (error) {
    console.error('Error deleting old APK:', error);
    // Don't throw error as this is not critical
  }
}; 