/**
 * APK Download Service
 * - Checks if file exists on server before download
 * - Uses native-downloader for Android (notification, background when app killed)
 * - Fallback to expo-file-system for web/other
 */

import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

const DOWNLOAD_TASK_ID = "app-update-apk";
const MAX_RETRIES = 3;

export type DownloadStatus =
  | "idle"
  | "checking"
  | "fileNotFound"
  | "downloading"
  | "failed"
  | "completed";

export interface DownloadState {
  status: DownloadStatus;
  progress: number;
  error: string | null;
  retryCount: number;
}

/**
 * Check if the APK file exists on server (HEAD request)
 */
export async function checkApkExists(apiUrl: string, version: string): Promise<boolean> {
  const uri = `${apiUrl}/media/${version}.apk`;
  try {
    const response = await fetch(uri, { method: "HEAD" });
    return response.ok;
  } catch (e) {
    console.warn("checkApkExists failed:", e);
    return false;
  }
}

/**
 * Get local file path for the APK
 */
export function getApkLocalPath(): string {
  return FileSystem.documentDirectory + "update.apk";
}

/**
 * Delete existing update.apk before new download
 */
export async function clearExistingApk(): Promise<void> {
  const path = getApkLocalPath();
  const info = await FileSystem.getInfoAsync(path);
  if (info.exists) {
    await FileSystem.deleteAsync(path, { idempotent: true });
  }
}
