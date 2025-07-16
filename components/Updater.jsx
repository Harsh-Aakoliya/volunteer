import React from "react";
import { Button, View } from "react-native";
import * as FileSystem from "expo-file-system";
import { startActivityAsync } from "expo-intent-launcher";

export function Updater() {
  async function updateApk() {
    const uri = "http://192.168.166.33:3000/media/1.0.5.apk";
    const localFilePath = FileSystem.documentDirectory + "test.apk";
    console.log(localFilePath);
    try {
      // Download to the file path first
      await FileSystem.downloadAsync(uri, localFilePath);
      
      // Then get the content URI for the install activity
      const localUri = await FileSystem.getContentUriAsync(localFilePath);

      await startActivityAsync("android.intent.action.INSTALL_PACKAGE", {
        data: localUri,
        flags: 1,
      });
    } catch (error) {
      alert(`Error during installing APK: ${error}`);
    }
  }

  return (
    <View>
      <Button title="Reset APK" onPress={updateApk} />
    </View>
  );
}