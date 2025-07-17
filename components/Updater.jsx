import React, { useEffect } from "react";
import { View } from "react-native";
import * as FileSystem from "expo-file-system";
import { startActivityAsync } from "expo-intent-launcher";
import { API_URL } from "@/constants/api";

export function Updater({ version, onProgress, onDone }) {
  useEffect(() => {
    if (version) {
      updateApk();
    }
  }, [version]);

  async function updateApk() {
    const uri = `${API_URL}/media/${version}.apk`;
    const localFilePath = FileSystem.documentDirectory + "update.apk";
    
    try {
      console.log(`Downloading APK from: ${uri}`);
      
      const downloadResumable = FileSystem.createDownloadResumable(
        uri,
        localFilePath,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          // console.log(`Download progress: ${Math.round(progress * 100)}%`);
          if (onProgress) onProgress(progress);
        }
      );
      
      const result = await downloadResumable.downloadAsync();
      console.log('APK download completed:', result);
      
      const localUri = await FileSystem.getContentUriAsync(localFilePath);
      console.log('Installing APK from:', localUri);
      
      await startActivityAsync("android.intent.action.INSTALL_PACKAGE", {
        data: localUri,
        flags: 1,
      });
      
      if (onDone) onDone();
    } catch (error) {
      console.error('Error during APK update:', error);
      alert(`Error during installing APK: ${error.message}`);
      if (onDone) onDone();
    }
  }

  return <View />;
}