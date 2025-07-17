import React, { useState, useEffect } from "react";
import { View, Text, Alert, Modal, TouchableOpacity, ActivityIndicator } from "react-native";
import * as Application from 'expo-application';
import { API_URL } from "@/constants/api";
import { Updater } from "./Updater";

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

  useEffect(() => {
    checkForUpdates();
  }, []);

  const checkForUpdates = async () => {
    try {
      const appVersion = Application.nativeApplicationVersion;
      setCurrentVersion(appVersion as string);
      
      console.log("Current app version:", appVersion);
      
      const response = await fetch(`${API_URL}/api/version`);
      const versionData = await response.json();
      
      console.log("Server version data:", versionData);
      
      if (versionData.versiontopublish !== appVersion) {
        setServerVersion(versionData.versiontopublish);
        setVersionDescription(versionData.Description[versionData.versiontopublish] || "New version available");
        setUpdateRequired(true);
        setIsCheckingVersion(false);
      } else {
        // No update required, notify parent component
        setIsCheckingVersion(false);
        if (onUpdateCheckComplete) {
          onUpdateCheckComplete(false); // false means no update required
        }
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
      setIsCheckingVersion(false);
      // If error in checking, proceed with app normally
      if (onUpdateCheckComplete) {
        onUpdateCheckComplete(false);
      }
    }
  };

  const handleUpdateProgress = (progress: number) => {
    setDownloadProgress(progress);
  };

  const handleUpdateComplete = () => {
    setIsDownloading(false);
    setUpdateRequired(false);
    // After successful update, we don't need to call onUpdateCheckComplete
    // because the app will restart with the new version
  };

  const startUpdate = () => {
    setIsDownloading(true);
    setDownloadProgress(0);
  };

  // Show loading while checking for updates
  if (isCheckingVersion) {
    return (
      <View className="flex-1 bg-white justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="mt-4 text-gray-600">Checking for updates...</Text>
      </View>
    );
  }

  // If no update required, don't render anything
  if (!updateRequired) {
    return null;
  }

  return (
    <Modal
      visible={updateRequired}
      animationType="fade"
      transparent={false}
      onRequestClose={() => {}} // Prevent closing
    >
      <View className="flex-1 bg-white justify-center items-center p-6">
        <View className="w-full max-w-md">
          <Text className="text-2xl font-bold text-center mb-4 text-gray-800">
            Update Required
          </Text>
          
          <Text className="text-center mb-2 text-gray-600">
            Current Version: {currentVersion}
          </Text>
          
          <Text className="text-center mb-4 text-gray-600">
            Latest Version: {serverVersion}
          </Text>
          
          <View className="bg-blue-50 p-4 rounded-lg mb-6">
            <Text className="text-sm text-blue-800 text-center">
              New Update Description: {versionDescription}
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
                Update Now
              </Text>
            </TouchableOpacity>
          )}
          
          <Text className="text-xs text-gray-500 text-center mt-4">
            This update is required to continue using the app
          </Text>
        </View>
        
        {/* Hidden Updater component */}
        {isDownloading && (
          <View style={{ position: 'absolute', left: -1000 }}>
            <Updater
              version={serverVersion}
              onProgress={handleUpdateProgress}
              onDone={handleUpdateComplete}
            />
          </View>
        )}
      </View>
    </Modal>
  );
} 