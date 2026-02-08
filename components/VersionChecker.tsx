import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import * as Application from "expo-application";
import { Ionicons } from "@expo/vector-icons";
import { getApiUrl } from "@/constants/api";
import { Updater, type UpdaterHandle } from "./Updater";
import type { DownloadStatus } from "@/utils/apkDownloadService";

interface VersionCheckerProps {
  onUpdateCheckComplete?: (updateRequired: boolean) => void;
}

export function VersionChecker({ onUpdateCheckComplete }: VersionCheckerProps) {
  const [updateRequired, setUpdateRequired] = useState(false);
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>("idle");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [versionDescription, setVersionDescription] = useState("");
  const [isCheckingVersion, setIsCheckingVersion] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);

  const updaterRef = useRef<UpdaterHandle>(null);

  useEffect(() => {
    const timer = setTimeout(() => checkForUpdates(), 100);
    return () => clearTimeout(timer);
  }, []);

  const checkForUpdates = async () => {
    try {
      const appVersion = Application.nativeApplicationVersion;
      setCurrentVersion(appVersion as string);
      const apiUrl = getApiUrl();

      if (!apiUrl || apiUrl === "http://localhost:8080") {
        setIsCheckingVersion(false);
        onUpdateCheckComplete?.(false);
        return;
      }

      const response = await fetch(`${apiUrl}/api/version`);
      const versionData = await response.json();

      if (versionData.versiontopublish !== appVersion) {
        setServerVersion(versionData.versiontopublish);
        setVersionDescription(
          versionData.Description?.[versionData.versiontopublish] ||
            "New version available"
        );
        setUpdateRequired(true);
      } else {
        onUpdateCheckComplete?.(false);
      }
    } catch (error) {
      console.error("Error checking for updates:", error);
      onUpdateCheckComplete?.(false);
    } finally {
      setIsCheckingVersion(false);
    }
  };

  const handleStateChange = (status: DownloadStatus) => {
    setDownloadStatus(status);
    if (status === "fileNotFound") {
      setErrorMessage("Update file not found on server");
    }
  };

  const handleFailed = (error: string, retryPossible: boolean) => {
    setErrorMessage(error);
    setCanRetry(retryPossible);
  };

  const startUpdate = () => {
    setDownloadStatus("checking");
    setDownloadProgress(0);
    setErrorMessage(null);
  };

  const handleRetry = () => {
    setRetryCount((c) => c + 1);
    setErrorMessage(null);
    setDownloadStatus("downloading");
    updaterRef.current?.retry();
  };

  const handlePause = async () => {
    await updaterRef.current?.pause();
  };

  const handleResume = async () => {
    await updaterRef.current?.resume();
  };

  const handleUpdateComplete = () => {
    setUpdateRequired(false);
  };

  const isDownloading = ["checking", "downloading"].includes(downloadStatus);
  const isPaused = downloadStatus === "paused";
  const isFailed = downloadStatus === "failed";
  const isFileNotFound = downloadStatus === "fileNotFound";

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
            Update Required
          </Text>
          <Text className="text-center mb-2 text-gray-600">
            Current: {currentVersion} → Latest: {serverVersion}
          </Text>
          <View className="bg-blue-50 p-4 rounded-lg mb-6">
            <Text className="text-sm text-blue-800 text-center">
              {versionDescription}
            </Text>
          </View>

          {/* File not found */}
          {isFileNotFound && (
            <View className="items-center mb-4">
              <Ionicons name="cloud-offline-outline" size={48} color="#EF4444" />
              <Text className="text-red-600 font-medium mt-2 text-center">
                Update file not available
              </Text>
              <Text className="text-gray-600 text-sm mt-1 text-center">
                The update file for this version is not present on the server.
                Please try again later.
              </Text>
            </View>
          )}

          {/* Failed with retry */}
          {isFailed && (
            <View className="items-center mb-4">
              <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
              <Text className="text-red-600 font-medium mt-2 text-center">
                Download failed
              </Text>
              <Text className="text-gray-600 text-sm mt-1 text-center">
                {errorMessage}
              </Text>
              {canRetry && (
                <TouchableOpacity
                  onPress={handleRetry}
                  className="mt-4 bg-blue-500 py-3 px-6 rounded-lg flex-row items-center gap-2"
                >
                  <Ionicons name="refresh" size={20} color="white" />
                  <Text className="text-white font-semibold">Retry</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Download in progress */}
          {(isDownloading || isPaused) && !isFileNotFound && (
            <View className="items-center mb-4">
              <Text className="text-lg font-medium mb-4 text-gray-700">
                {downloadStatus === "checking"
                  ? "Checking update file..."
                  : isPaused
                  ? "Download paused"
                  : "Downloading update..."}
              </Text>
              <Text className="text-xs text-gray-500 mb-2">
                Progress appears in notification when app is in background
              </Text>
              <View className="w-full bg-gray-200 rounded-full h-4 mb-4">
                <View
                  className="bg-blue-500 h-4 rounded-full"
                  style={{ width: `${downloadProgress * 100}%` }}
                />
              </View>
              <Text className="text-sm text-gray-600 mb-4">
                {Math.round(downloadProgress * 100)}%
              </Text>
              <View className="flex-row gap-3">
                {isPaused ? (
                  <TouchableOpacity
                    onPress={handleResume}
                    className="bg-green-500 py-3 px-6 rounded-lg flex-row items-center gap-2"
                  >
                    <Ionicons name="play" size={20} color="white" />
                    <Text className="text-white font-semibold">Resume</Text>
                  </TouchableOpacity>
                ) : downloadStatus === "downloading" ? (
                  <TouchableOpacity
                    onPress={handlePause}
                    className="bg-amber-500 py-3 px-6 rounded-lg flex-row items-center gap-2"
                  >
                    <Ionicons name="pause" size={20} color="white" />
                    <Text className="text-white font-semibold">Pause</Text>
                  </TouchableOpacity>
                ) : null}
                {isFailed && canRetry && (
                  <TouchableOpacity
                    onPress={handleRetry}
                    className="bg-blue-500 py-3 px-6 rounded-lg flex-row items-center gap-2"
                  >
                    <Ionicons name="refresh" size={20} color="white" />
                    <Text className="text-white font-semibold">Retry</Text>
                  </TouchableOpacity>
                )}
              </View>
              {downloadStatus === "checking" && (
                <ActivityIndicator size="large" color="#3B82F6" className="mt-4" />
              )}
            </View>
          )}

          {/* Update Now button - only when idle and not file-not-found */}
          {downloadStatus === "idle" && !isFileNotFound && (
            <TouchableOpacity
              onPress={startUpdate}
              className="bg-blue-500 py-4 px-6 rounded-lg"
            >
              <Text className="text-white text-center font-semibold text-lg">
                Update Now
              </Text>
            </TouchableOpacity>
          )}

          <Text className="text-xs text-gray-500 text-center mt-4">
            This update is required to continue using the app
          </Text>
        </View>

        {/* Updater - keep mounted when download started (incl. failed, for retry) */}
        {(isDownloading || isPaused || isFailed) && serverVersion && (
          <Updater
            ref={updaterRef}
            version={serverVersion}
            onProgress={setDownloadProgress}
            onDone={handleUpdateComplete}
            onFileNotFound={() => {
              setDownloadStatus("fileNotFound");
            }}
            onFailed={handleFailed}
            onStateChange={handleStateChange}
            onPaused={() => setDownloadStatus("paused")}
            onResumed={() => setDownloadStatus("downloading")}
            retryCount={retryCount}
            maxRetries={3}
          />
        )}
      </View>
    </Modal>
  );
}
