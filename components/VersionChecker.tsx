import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import * as Application from "expo-application";
import { getApiUrl } from "@/constants/api";
import { Updater } from "./Updater";
import {
  clearLeftoverApk,
  getPendingInstallPath,
  getPendingInstallVersion,
  installPendingApkAndClear,
} from "@/utils/apkUpdateBackgroundService";

interface VersionCheckerProps {
  onUpdateCheckComplete?: (updateRequired: boolean) => void;
}

export function VersionChecker({ onUpdateCheckComplete }: VersionCheckerProps) {
  const [updateRequired, setUpdateRequired] = useState(false);
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [versionDescription, setVersionDescription] = useState("");
  const [isCheckingVersion, setIsCheckingVersion] = useState(true);
  const [hasPendingInstall, setHasPendingInstall] = useState(false);
  const currentVersionRef = useRef<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => initializeAndCheck(), 100);
    return () => clearTimeout(timer);
  }, []);

  const initializeAndCheck = async () => {
    const appVersion = Application.nativeApplicationVersion ?? "";
    setCurrentVersion(appVersion);
    currentVersionRef.current = appVersion;

    if (Platform.OS === "android") {
      const pending = await getPendingInstallPath();
      const pendingVersion = await getPendingInstallVersion();
      if (pending) {
        // Verify with backend: 1) backend version 2) pending version 3) installed version
        let backendVersion: string | null = null;
        try {
          const apiUrl = getApiUrl();
          if (apiUrl && apiUrl !== "http://localhost:8080") {
            const response = await fetch(`${apiUrl}/api/version`);
            const versionData = await response.json();
            backendVersion = versionData.versiontopublish ?? null;
          }
        } catch (_e) {
          // Offline or error: proceed with pending install flow
        }

        // Race: installed already equals backend — pending is leftover, clear and continue
        if (backendVersion && appVersion === backendVersion) {
          await clearLeftoverApk();
          setIsCheckingVersion(false);
          onUpdateCheckComplete?.(false);
          return;
        }

        // Pending APK is stale (server has newer version); clear it and fall through to normal check
        if (backendVersion && pendingVersion && pendingVersion !== backendVersion) {
          await clearLeftoverApk();
          // Fall through to version check below
        } else {
          const ok = await installPendingApkAndClear(appVersion);
          if (!ok) {
            setHasPendingInstall(true);
            setUpdateRequired(true);
            setVersionDescription("Update downloaded. Tap to install.");
            setServerVersion(backendVersion ?? "");
          } else {
            await clearLeftoverApk();
          }
          setIsCheckingVersion(false);
          onUpdateCheckComplete?.(!ok);
          return;
        }
      }
      await clearLeftoverApk();
    }

    try {
      const apiUrl = getApiUrl();
      if (!apiUrl || apiUrl === "http://localhost:8080") {
        setIsCheckingVersion(false);
        onUpdateCheckComplete?.(false);
        return;
      }

      const response = await fetch(`${apiUrl}/api/version`);
      const versionData = await response.json();

      const latest = versionData.versiontopublish;
      console.log("latest", latest);
      console.log("currentVersionRef.current", currentVersionRef.current);
      if (latest && latest !== currentVersionRef.current) {
        setServerVersion(latest);
        setVersionDescription(
          versionData.Description?.[latest] || "New version available"
        );
        setUpdateRequired(true);
      }

      setIsCheckingVersion(false);
      onUpdateCheckComplete?.(latest !== currentVersionRef.current);
    } catch (error) {
      console.error("Error checking for updates:", error);
      setIsCheckingVersion(false);
      onUpdateCheckComplete?.(false);
    }
  };

  const handleUpdateProgress = (progress: number) => {
    setDownloadProgress(progress);
  };

  const handleUpdateComplete = () => {
    setIsDownloading(false);
    setUpdateRequired(false);
  };

  const startUpdate = () => {
    if (hasPendingInstall) {
      setIsDownloading(true);
    } else {
      setIsDownloading(true);
      setDownloadProgress(0);
    }
  };

  if (isCheckingVersion) return null;
  if (!updateRequired) return null;

  return (
    <Modal
      visible={updateRequired}
      animationType="fade"
      transparent={false}
      onRequestClose={() => {}}
    >
      <View className="flex-1 bg-white justify-center items-center p-6">
        <View className="w-full max-w-md">
          <Text className="text-2xl font-bold text-center mb-4 text-gray-800">
            {hasPendingInstall ? "Update Ready" : "Update Required"}
          </Text>

          {!hasPendingInstall && (
            <>
              <Text className="text-center mb-2 text-gray-600">
                Current Version: {currentVersion}
              </Text>
              <Text className="text-center mb-4 text-gray-600">
                Latest Version: {serverVersion}
              </Text>
            </>
          )}

          <View className="bg-blue-50 p-4 rounded-lg mb-6">
            <Text className="text-sm text-blue-800 text-center">
              {versionDescription}
            </Text>
          </View>

          {isDownloading ? (
            <View className="items-center">
              <Text className="text-lg font-medium mb-4 text-gray-700">
                Downloading Update...
              </Text>

              <View className="w-full bg-gray-200 rounded-full h-4 mb-4">
                <View
                  className="bg-blue-500 h-4 rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress * 100}%` }}
                />
              </View>

              <Text className="text-sm text-gray-600 mb-4">
                {Math.round(downloadProgress * 100)}% Complete
              </Text>
              
              <ActivityIndicator size="large" color="#3B82F6" />
            </View>
          ) : (
            <TouchableOpacity
              onPress={startUpdate}
              className="bg-blue-500 py-4 px-6 rounded-lg"
            >
              <Text className="text-white text-center font-semibold text-lg">
                {hasPendingInstall ? "Install Now" : "Update Now"}
              </Text>
            </TouchableOpacity>
          )}

          <Text className="text-xs text-gray-500 text-center mt-4">
            This update is required to continue using the app
          </Text>
        </View>

        {(isDownloading || hasPendingInstall) && (
          <View style={{ position: "absolute", left: -1000, opacity: 0 }}>
            <Updater
              version={serverVersion || ""}
              onProgress={handleUpdateProgress}
              onDone={handleUpdateComplete}
              forceRunForPending={hasPendingInstall}
            />
          </View>
        )}
      </View>
    </Modal>
  );
}
