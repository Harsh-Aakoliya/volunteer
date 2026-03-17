import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StyleSheet,
} from "react-native";
import * as Application from "expo-application";
import { useApiStore, getApiUrl } from "@/stores/apiStore";
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
  const apiUrlReady = useApiStore((s) => s.apiUrlReady);
  const [updateRequired, setUpdateRequired] = useState(false);
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [versionDescription, setVersionDescription] = useState("");
  const [isCheckingVersion, setIsCheckingVersion] = useState(true);
  const [hasPendingInstall, setHasPendingInstall] = useState(false);
  const currentVersionRef = useRef<string | null>(null);
  /** Incremented when user taps Update Now so Updater remounts and starts download */
  const downloadTriggerRef = useRef(0);

  useEffect(() => {
    if (!apiUrlReady) {
      setIsCheckingVersion(false);
      onUpdateCheckComplete?.(false);
      return;
    }
    setIsCheckingVersion(true);
    const timer = setTimeout(() => initializeAndCheck(), 100);
    return () => clearTimeout(timer);
  }, [apiUrlReady]);

  const initializeAndCheck = async () => {
    const appVersion = Application.nativeApplicationVersion ?? "";
    setCurrentVersion(appVersion);
    currentVersionRef.current = appVersion;

    if (Platform.OS === "android") {
      const pending = await getPendingInstallPath();
      const pendingVersion = await getPendingInstallVersion();
      if (pending) {
        let backendVersion: string | null = null;
        try {
          const apiUrl = getApiUrl();
          if (apiUrl && apiUrl !== "http://localhost:8080") {
            const response = await fetch(`${apiUrl}/api/version`);
            const versionData = await response.json();
            backendVersion = versionData.versiontopublish ?? null;
          }
        } catch (_e) {}

        if (backendVersion && appVersion === backendVersion) {
          await clearLeftoverApk();
          setIsCheckingVersion(false);
          onUpdateCheckComplete?.(false);
          return;
        }

        if (backendVersion && pendingVersion && pendingVersion !== backendVersion) {
          await clearLeftoverApk();
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
    if (!hasPendingInstall && !serverVersion) return;
    downloadTriggerRef.current += 1;
    setIsDownloading(true);
    setDownloadProgress(0);
  };

  if (isCheckingVersion) return null;
  if (!updateRequired) return null;

  const showUpdater = isDownloading || hasPendingInstall;
  const updaterKey = `updater-${downloadTriggerRef.current}-${serverVersion ?? ""}-${hasPendingInstall}`;

  return (
    <View style={styles.fullscreenOverlay} pointerEvents="box-none">
      <View style={styles.modalRoot}>
        <View style={styles.content}>
          <Text style={styles.title}>
            {hasPendingInstall ? "Update Ready" : "Update Required"}
          </Text>

          {!hasPendingInstall && (
            <>
              <Text style={styles.versionText}>
                Current Version: {currentVersion}
              </Text>
              <Text style={styles.versionText}>
                Latest Version: {serverVersion}
              </Text>
            </>
          )}

          <View style={styles.descriptionBox}>
            <Text style={styles.descriptionText}>{versionDescription}</Text>
          </View>

          {isDownloading ? (
            <View style={styles.downloadingBox}>
              <Text style={styles.downloadingTitle}>Downloading Update...</Text>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${downloadProgress * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {Math.round(downloadProgress * 100)}% Complete
              </Text>
              <ActivityIndicator size="large" color="#3B82F6" />
            </View>
          ) : (
            <TouchableOpacity
              onPress={startUpdate}
              style={styles.button}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>
                {hasPendingInstall ? "Install Now" : "Update Now"}
              </Text>
            </TouchableOpacity>
          )}

          <Text style={styles.footer}>
            This update is required to continue using the app
          </Text>
        </View>

        {showUpdater && (
          <View style={styles.hiddenUpdater} pointerEvents="none">
            <Updater
              key={updaterKey}
              version={serverVersion ?? ""}
              onProgress={handleUpdateProgress}
              onDone={handleUpdateComplete}
              forceRunForPending={hasPendingInstall}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullscreenOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    backgroundColor: "#fff",
  },
  modalRoot: {
    flex: 1,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  content: {
    width: "100%",
    maxWidth: 400,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
    color: "#1f2937",
  },
  versionText: {
    textAlign: "center",
    marginBottom: 8,
    color: "#4b5563",
  },
  descriptionBox: {
    backgroundColor: "#eff6ff",
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  descriptionText: {
    fontSize: 14,
    color: "#1e40af",
    textAlign: "center",
  },
  downloadingBox: {
    alignItems: "center",
    marginBottom: 16,
  },
  downloadingTitle: {
    fontSize: 18,
    fontWeight: "500",
    marginBottom: 16,
    color: "#374151",
  },
  progressBarBg: {
    width: "100%",
    height: 16,
    backgroundColor: "#e5e7eb",
    borderRadius: 8,
    marginBottom: 16,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#3b82f6",
    borderRadius: 8,
  },
  progressText: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#3b82f6",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
    fontSize: 18,
  },
  footer: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 16,
  },
  hiddenUpdater: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 1,
    height: 1,
    opacity: 0,
    overflow: "hidden",
    zIndex: -1,
  },
});
