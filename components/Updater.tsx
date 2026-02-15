import React, { useEffect, useState } from "react";
import { View, Platform, Alert } from "react-native";
import * as FileSystem from "expo-file-system";
import { startActivityAsync } from "expo-intent-launcher";
import { getApiUrl } from "@/constants/api";
import {
  startApkDownloadTask,
  getPendingInstallPath,
  clearPendingInstall,
  isBackgroundServiceRunning,
} from "@/utils/apkUpdateBackgroundService";

export function Updater({
  version,
  onProgress,
  onDone,
  forceRunForPending,
}: {
  version: string;
  onProgress: (progress: number) => void;
  onDone: () => void;
  forceRunForPending?: boolean;
}) {
  useEffect(() => {
    if (!version && !forceRunForPending) return;

    const run = async () => {
      if (Platform.OS !== "android") {
        onDone();
        return;
      }

      // Check for pending install (download completed while app was killed)
      const pendingPath = await getPendingInstallPath();
      if (pendingPath) {
        try {
          const contentUri = await FileSystem.getContentUriAsync(pendingPath);
          await startActivityAsync("android.intent.action.INSTALL_PACKAGE", {
            data: contentUri,
            flags: 1,
          });
          await clearPendingInstall();
        } catch (e) {
          console.warn("Pending install failed:", e);
          Alert.alert("Installation", "Update is ready. Please open the app again to install.");
        }
        onDone();
        return;
      }

      if (!version) {
        onDone();
        return;
      }

      const apiUrl = getApiUrl();
      const uri = `${apiUrl}/media/${version}.apk`;

      try {
        const { usedBackground } = await startApkDownloadTask(
          { url: uri, version },
          (progress) => onProgress(progress)
        );
        if (!usedBackground) {
          onDone();
          return;
        }
        // Background task runs async - poll until it stops
        const poll = setInterval(() => {
          if (!isBackgroundServiceRunning()) {
            clearInterval(poll);
            onDone();
          }
        }, 2000);
        return () => clearInterval(poll);
      } catch (error) {
        console.error("Download failed:", error);
        Alert.alert(
          "Download Failed",
          error instanceof Error ? error.message : "Could not download update"
        );
        onDone();
      }
    };

    run();
  }, [version]);

  return <View />;
}
