import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Linking } from 'react-native';
// import { Linking } from 'react-native';
import * as Application from 'expo-application';

const AutoUpdater = () => {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  
  // Hardcoded values as requested
  const SERVER_APK_URL = 'http://192.168.148.33:3000/media/1.0.4.apk';
  const NEW_VERSION = '1.0.4';
  const SEVAK_FOLDER_URI = "content://com.android.externalstorage.documents/tree/primary%3ASevak";
  
  // Check for updates on component mount
  useEffect(() => {
    checkForUpdates();
  }, []);
  
  const checkForUpdates = async () => {
    try {
      const currentVersion = Application.nativeApplicationVersion;
      console.log('Current version:', currentVersion);
      console.log('Available version:', NEW_VERSION);
      
      // Compare versions (simple string comparison)
      if (currentVersion !== NEW_VERSION) {
        setIsUpdateAvailable(true);
        Alert.alert(
          'Update Available',
          `A new version (${NEW_VERSION}) is available. Current version: ${currentVersion}`,
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Update Now', onPress: downloadAndInstallUpdate }
          ]
        );
      } else {
        Alert.alert('No Updates', 'You are using the latest version');
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
      Alert.alert('Error', 'Failed to check for updates');
    }
  };
  
  const downloadAndInstallUpdate = async () => {
    try {
      setIsDownloading(true);
      setDownloadProgress(0);
      
      // Step 1: Download APK to cache first
      const tempDownloadPath = FileSystem.cacheDirectory + 'temp_update.apk';
      const downloadResumable = FileSystem.createDownloadResumable(
        SERVER_APK_URL,
        tempDownloadPath,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          setDownloadProgress(Math.round(progress * 100));
        }
      );
      
      const result = await downloadResumable.downloadAsync();
      console.log('Download completed:', result.uri);
      
      // Step 2: Save APK to Sevak folder using Storage Access Framework
      const apkUri = await saveToSevakFolder(result.uri);
      
      setIsDownloading(false);
      
      // Step 3: Install the APK
      await installAPK(apkUri);
      
    } catch (error) {
      console.error('Download/Install error:', error);
      setIsDownloading(false);
      Alert.alert('Error', 'Failed to download or install update');
    }
  };
  
  const saveToSevakFolder = async (tempFilePath) => {
    try {
      // Step 1: Create APK file in Sevak folder
      const apkUri = await FileSystem.StorageAccessFramework.createFileAsync(
        SEVAK_FOLDER_URI,
        'update.apk',
        'application/vnd.android.package-archive'
      );
      
      // Step 2: Read temp file as base64
      const fileData = await FileSystem.readAsStringAsync(tempFilePath, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Step 3: Write to SAF folder
      await FileSystem.StorageAccessFramework.writeAsStringAsync(apkUri, fileData, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Step 4: Clean up temp file
      await FileSystem.deleteAsync(tempFilePath);
      
      console.log('APK saved to Sevak folder:', apkUri);
      return apkUri;
      
    } catch (error) {
      console.error('Error saving to Sevak folder:', error);
      throw error;
    }
  };
  
  const installAPK = async (apkUri) => {
    try {
      // Use Linking to open the APK for installation
      const canOpen = await Linking.canOpenURL(apkUri);
      
      if (canOpen) {
        await Linking.openURL(apkUri);
        Alert.alert('Installation', 'APK installation started. Please follow the on-screen instructions.');
      } else {
        Alert.alert('Error', 'Cannot open APK file for installation');
      }
      
    } catch (error) {
      console.error('Installation error:', error);
      Alert.alert('Error', 'Failed to start installation');
    }
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Auto Updater</Text>
      
      <TouchableOpacity 
        style={styles.button} 
        onPress={checkForUpdates}
        disabled={isDownloading}
      >
        <Text style={styles.buttonText}>Check for Updates</Text>
      </TouchableOpacity>
      
      {isUpdateAvailable && (
        <View style={styles.updateInfo}>
          <Text style={styles.updateText}>Update Available: v{NEW_VERSION}</Text>
          <TouchableOpacity 
            style={[styles.button, styles.updateButton]} 
            onPress={downloadAndInstallUpdate}
            disabled={isDownloading}
          >
            <Text style={styles.buttonText}>
              {isDownloading ? `Downloading... ${downloadProgress}%` : 'Download & Install'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      
      {isDownloading && (
        <View style={styles.progressContainer}>
          <Text>Download Progress: {downloadProgress}%</Text>
          <View style={styles.progressBar}>
            <View 
              style={[styles.progressFill, { width: `${downloadProgress}%` }]} 
            />
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#333',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginVertical: 10,
    minWidth: 200,
    alignItems: 'center',
  },
  updateButton: {
    backgroundColor: '#28a745',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  updateInfo: {
    marginTop: 20,
    alignItems: 'center',
  },
  updateText: {
    fontSize: 16,
    color: '#28a745',
    marginBottom: 10,
    fontWeight: '600',
  },
  progressContainer: {
    marginTop: 20,
    alignItems: 'center',
    width: '100%',
  },
  progressBar: {
    width: '80%',
    height: 10,
    backgroundColor: '#e0e0e0',
    borderRadius: 5,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 5,
  },
});

export default AutoUpdater;