/**
 * Simple OTA update hook using expo-updates.
 * Checks the custom server for OTA updates and applies them.
 *
 * Usage:
 *   const { status, checkForUpdate, downloadAndApply } = useOTAUpdates();
 */

import { useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import * as Application from "expo-application";
import { getApiUrl } from "@/stores/apiStore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const OTA_VERSION_KEY = "@ota_current_version";

let Updates: any = null;
try {
  Updates = require("expo-updates");
} catch {
  console.warn("[OTA] expo-updates not available");
}

export type OTAStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready"
  | "restarting"
  | "up_to_date"
  | "error";

export function useOTAUpdates() {
  const [status, setStatus] = useState<OTAStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [otaDescription, setOtaDescription] = useState<string>("");
  const [latestOtaVersion, setLatestOtaVersion] = useState<number>(0);

  /** Get the locally stored OTA version number */
  const getLocalOtaVersion = useCallback(async (): Promise<number> => {
    try {
      const v = await AsyncStorage.getItem(OTA_VERSION_KEY);
      return v ? parseInt(v, 10) : 0;
    } catch {
      return 0;
    }
  }, []);

  /** Save OTA version after successful install */
  const saveOtaVersion = useCallback(async (version: number) => {
    try {
      await AsyncStorage.setItem(OTA_VERSION_KEY, String(version));
    } catch {}
  }, []);

  /**
   * Step 1: Ask our backend if there's a newer OTA for this APK version.
   * This is a lightweight JSON check (no expo-updates involved yet).
   */
  const checkForUpdate = useCallback(async (): Promise<boolean> => {
    if (__DEV__) {
      setStatus("up_to_date");
      return false;
    }

    try {
      setStatus("checking");
      setError(null);

      const apiUrl = getApiUrl();
      const apkVersion = Application.nativeApplicationVersion ?? "";
      const localOta = await getLocalOtaVersion();

      const res = await fetch(
        `${apiUrl}/api/ota/check?apkVersion=${apkVersion}&otaVersion=${localOta}`
      );
      const data = await res.json();

      if (data.updateAvailable) {
        setLatestOtaVersion(data.latestOta);
        setOtaDescription(data.description || "Update available");
        setStatus("available");
        return true;
      }

      setStatus("up_to_date");
      return false;
    } catch (err: any) {
      console.error("[OTA] Check failed:", err.message);
      setError(err.message);
      setStatus("error");
      return false;
    }
  }, [getLocalOtaVersion]);

  /**
   * Step 2: Use expo-updates to fetch and apply the OTA bundle.
   * expo-updates will call our /api/ota/manifest endpoint (configured in app.config.js).
   */
  const downloadAndApply = useCallback(async (): Promise<boolean> => {
    if (__DEV__ || !Updates) {
      setStatus("up_to_date");
      return false;
    }

    try {
      setStatus("downloading");
      console.log("[OTA] Fetching update via expo-updates...");
      console.log("[OTA] Updates.isEnabled:", Updates.isEnabled);
      console.log("[OTA] Updates.updateId:", Updates.updateId);
      console.log("[OTA] Updates.channel:", Updates.channel);

      const checkResult = await Updates.checkForUpdateAsync();
      console.log("[OTA] checkForUpdateAsync result:", JSON.stringify(checkResult));

      if (!checkResult.isAvailable) {
        console.log("[OTA] expo-updates says no update available");
        setStatus("up_to_date");
        return false;
      }

      console.log("[OTA] Update available, downloading...");
      const fetchResult = await Updates.fetchUpdateAsync();
      console.log("[OTA] fetchUpdateAsync result:", JSON.stringify(fetchResult));

      if (!fetchResult.isNew) {
        setStatus("up_to_date");
        return false;
      }

      console.log("[OTA] Update downloaded, saving version and restarting...");
      await saveOtaVersion(latestOtaVersion);
      setStatus("restarting");

      await new Promise((r) => setTimeout(r, 500));
      await Updates.reloadAsync();
      return true;
    } catch (err: any) {
      console.error("[OTA] Download/apply failed:", err.message);
      console.error("[OTA] Full error:", JSON.stringify(err, Object.getOwnPropertyNames(err)));
      setError(err.message);
      setStatus("error");
      return false;
    }
  }, [latestOtaVersion, saveOtaVersion]);

  return {
    status,
    error,
    otaDescription,
    latestOtaVersion,
    isChecking: status === "checking",
    isDownloading: status === "downloading",
    isAvailable: status === "available",
    isReady: status === "ready",
    checkForUpdate,
    downloadAndApply,
    getLocalOtaVersion,
  };
}
