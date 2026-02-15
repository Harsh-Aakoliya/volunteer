/**
 * APK Update Background Service
 * Uses react-native-background-actions for downloads that continue when app is:
 * - Open, in recent menu, or killed
 * Notification shows "X MB / Y MB" progress after 1 second
 * Auto-installs on complete; leftover APK cleaned on next app open
 */

import * as FileSystem from 'expo-file-system';
import { startActivityAsync } from 'expo-intent-launcher';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const PENDING_INSTALL_KEY = '@apk_update_pending_install_path';
const PENDING_INSTALL_VERSION_KEY = '@apk_update_pending_install_version';

// react-native-background-actions may be null if native module not linked
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let BackgroundService: any = null;
try {
  BackgroundService = require('react-native-background-actions').default;
} catch {}

function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

export type ApkDownloadParams = {
  url: string;
  version: string;
};

export async function startApkDownloadTask(
  params: ApkDownloadParams,
  onProgress?: (progress: number, writtenMb: string, totalMb: string) => void
): Promise<{ usedBackground: boolean }> {
  if (Platform.OS !== 'android') {
    throw new Error('APK update is only supported on Android');
  }

  const { url, version } = params;
  const localFilePath = FileSystem.documentDirectory + `update_${version}.apk`;

  const downloadTask = async (taskParams: ApkDownloadParams | undefined) => {
    const { url: downloadUrl } = taskParams || params;

    // Delete existing file
    const fileInfo = await FileSystem.getInfoAsync(localFilePath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(localFilePath, { idempotent: true });
    }

    let lastNotificationUpdate = 0;
    const NOTIFICATION_UPDATE_INTERVAL = 1000; // 1 second

    return new Promise<void>((resolve, reject) => {
      const downloadResumable = FileSystem.createDownloadResumable(
        downloadUrl,
        localFilePath,
        {},
        (progress) => {
          const written = progress.totalBytesWritten;
          const total = progress.totalBytesExpectedToWrite;
          const progressPct = total > 0 ? written / total : 0;
          const writtenMb = formatMb(written);
          const totalMb = total > 0 ? formatMb(total) : '?';

          // In-app progress (only when app is in foreground)
          onProgress?.(progressPct, writtenMb, totalMb);

          // Notification: update after 1 second, then throttled
          const now = Date.now();
          if (BackgroundService?.isRunning?.() && (now - lastNotificationUpdate > NOTIFICATION_UPDATE_INTERVAL || progressPct >= 1)) {
            lastNotificationUpdate = now;
            BackgroundService?.updateNotification?.({
              taskDesc: `${writtenMb} MB / ${totalMb} MB`,
              progressBar: total > 0
                ? { max: 100, value: Math.round(progressPct * 100), indeterminate: false }
                : { max: 0, value: 0, indeterminate: true },
            }).catch(() => {});
          }
        }
      );

      downloadResumable
        .downloadAsync()
        .then(async (result) => {
          if (!result?.uri) {
            reject(new Error('Download failed'));
            return;
          }

          // Final notification
          if (BackgroundService?.isRunning?.()) {
            await BackgroundService?.updateNotification?.({
              taskDesc: 'Download complete. Installing...',
              progressBar: { max: 100, value: 100, indeterminate: false },
            });
          }

          await BackgroundService?.stop?.();

          try {
            const contentUri = await FileSystem.getContentUriAsync(localFilePath);
            await startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
              data: contentUri,
              flags: 1,
            });
            // Installation triggered - file will be cleaned on next app open
          } catch (installErr) {
            // If we can't launch install (e.g. headless), save path for next app open
            await AsyncStorage.setItem(PENDING_INSTALL_KEY, localFilePath);
            await AsyncStorage.setItem(PENDING_INSTALL_VERSION_KEY, version);
          }
          resolve();
        })
        .catch((err) => {
          if (BackgroundService?.isRunning?.()) {
            BackgroundService?.stop?.();
          }
          reject(err);
        });
    });
  };

  // Fallback: BackgroundService may be null if native module not linked
  if (!BackgroundService?.start) {
    await fallbackDownload(params, onProgress);
    return { usedBackground: false };
  }

  const options = {
    taskName: 'ApkUpdate',
    taskTitle: 'Updating App',
    taskDesc: 'Preparing download...',
    taskIcon: { name: 'ic_launcher', type: 'mipmap' },
    color: '#3b82f6',
    progressBar: { max: 0, value: 0, indeterminate: true },
    parameters: params,
  };

  await BackgroundService.start(downloadTask, options);

  setTimeout(async () => {
    if (BackgroundService?.isRunning?.()) {
      try {
        await BackgroundService.updateNotification({
          taskDesc: 'Downloading...',
          progressBar: { max: 0, value: 0, indeterminate: true },
        });
      } catch {}
    }
  }, 1000);

  return { usedBackground: true };
}

/** Fallback download using expo-file-system (works when app is open) */
async function fallbackDownload(
  params: ApkDownloadParams,
  onProgress?: (progress: number, writtenMb: string, totalMb: string) => void
): Promise<void> {
  const { url, version } = params;
  const localFilePath = FileSystem.documentDirectory + `update_${version}.apk`;

  const fileInfo = await FileSystem.getInfoAsync(localFilePath);
  if (fileInfo.exists) {
    await FileSystem.deleteAsync(localFilePath, { idempotent: true });
  }

  const downloadResumable = FileSystem.createDownloadResumable(
    url,
    localFilePath,
    {},
    (progress) => {
      const written = progress.totalBytesWritten;
      const total = progress.totalBytesExpectedToWrite;
      const pct = total > 0 ? written / total : 0;
      onProgress?.(pct, formatMb(written), total > 0 ? formatMb(total) : '?');
    }
  );

  const result = await downloadResumable.downloadAsync();
  if (!result?.uri) throw new Error('Download failed');

  const contentUri = await FileSystem.getContentUriAsync(localFilePath);
  await startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
    data: contentUri,
    flags: 1,
  });
  await FileSystem.deleteAsync(localFilePath, { idempotent: true });
}

export async function getPendingInstallPath(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PENDING_INSTALL_KEY);
  } catch {
    return null;
  }
}

export async function getPendingInstallVersion(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PENDING_INSTALL_VERSION_KEY);
  } catch {
    return null;
  }
}

export async function clearPendingInstall(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([PENDING_INSTALL_KEY, PENDING_INSTALL_VERSION_KEY]);
  } catch {}
}

/** Extract version from path like ".../update_1.0.15.apk" */
function getVersionFromPath(path: string): string | null {
  const match = path.match(/update_([^.]+)\.apk$/);
  return match ? match[1] : null;
}

/**
 * Install pending APK if any. Returns false if we should show "Update Ready" UI.
 * If current app version already matches pending version, we already installed - clear and skip.
 */
export async function installPendingApkAndClear(currentAppVersion: string): Promise<boolean> {
  const path = await getPendingInstallPath();
  const pendingVersion = (await getPendingInstallVersion()) ?? getVersionFromPath(path ?? '');
  if (!path) return false;

  // Already on this version - we installed before (process was killed before we could clear)
  if (pendingVersion && pendingVersion === currentAppVersion) {
    await clearPendingInstall();
    return true; // No UI needed, proceed
  }

  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) {
      await clearPendingInstall();
      return true;
    }
    const contentUri = await FileSystem.getContentUriAsync(path);
    await startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
      data: contentUri,
      flags: 1,
    });
    await clearPendingInstall();
    return true;
  } catch {
    return false;
  }
}

export async function clearLeftoverApk(): Promise<void> {
  try {
    const pendingPath = await AsyncStorage.getItem(PENDING_INSTALL_KEY);
    if (pendingPath) {
      const info = await FileSystem.getInfoAsync(pendingPath);
      if (info.exists) {
        await FileSystem.deleteAsync(pendingPath, { idempotent: true });
      }
      await AsyncStorage.multiRemove([PENDING_INSTALL_KEY, PENDING_INSTALL_VERSION_KEY]);
    }

    // Also clean any update_*.apk in document directory
    const dir = FileSystem.documentDirectory;
    if (dir) {
      const files = await FileSystem.readDirectoryAsync(dir);
      for (const f of files) {
        if (f.startsWith('update_') && f.endsWith('.apk')) {
          await FileSystem.deleteAsync(dir + f, { idempotent: true });
        }
      }
    }

    // Legacy: update.apk
    const legacyPath = FileSystem.documentDirectory + 'update.apk';
    const legacyInfo = await FileSystem.getInfoAsync(legacyPath);
    if (legacyInfo.exists) {
      await FileSystem.deleteAsync(legacyPath, { idempotent: true });
    }
  } catch (e) {
    console.warn('clearLeftoverApk:', e);
  }
}

export function isBackgroundServiceRunning(): boolean {
  return !!BackgroundService?.isRunning?.();
}
