import React, { useEffect, useRef } from "react";
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
import { AuthStorage } from "@/utils/authStorage";
import { ChatRoomStorage } from "@/utils/chatRoomsStorage";

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
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!version && !forceRunForPending) {
      onDone();
      return;
    }

    cancelledRef.current = false;

    const run = async () => {
      if (Platform.OS !== "android") {
        onDone();
        return;
      }

      const pendingPath = await getPendingInstallPath();
      if (pendingPath) {
        try {
          await AuthStorage.clear();
          await ChatRoomStorage.clearCache();
          const contentUri = await FileSystem.getContentUriAsync(pendingPath);
          await startActivityAsync("android.intent.action.INSTALL_PACKAGE", {
            data: contentUri,
            flags: 1,
          });
          await clearPendingInstall();
        } catch (e) {
          console.warn("Pending install failed:", e);
          Alert.alert(
            "Installation",
            "Update is ready. Please open the app again to install."
          );
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

      onProgress(0);

      try {
        const { usedBackground } = await startApkDownloadTask(
          { url: uri, version },
          (progress) => {
            if (!cancelledRef.current) onProgress(progress);
          }
        );
        if (cancelledRef.current) return;
        if (!usedBackground) {
          onDone();
          return;
        }
        const poll = setInterval(() => {
          if (cancelledRef.current) return;
          if (!isBackgroundServiceRunning()) {
            clearInterval(poll);
            onDone();
          }
        }, 2000);
      } catch (error) {
        if (cancelledRef.current) return;
        console.error("Download failed:", error);
        Alert.alert(
          "Download Failed",
          error instanceof Error ? error.message : "Could not download update"
        );
        onDone();
      }
    };

    run();
    return () => {
      cancelledRef.current = true;
    };
  }, [version, forceRunForPending]);

  return <View />;
}
