import { useEffect, useState, useCallback, useRef } from 'react';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Safe import: expo-updates module-level code can crash if the native module
// isn't properly initialized (e.g. dev builds, missing native config).
let Updates = null;
try {
  Updates = require('expo-updates');
} catch (e) {
  console.warn('[OTA] expo-updates not available:', e.message);
}

export const UPDATE_STATUS = {
  IDLE: 'idle',
  CHECKING: 'checking',
  AVAILABLE: 'available',
  DOWNLOADING: 'downloading',
  READY: 'ready',
  RESTARTING: 'restarting',
  UP_TO_DATE: 'up_to_date',
  ERROR: 'error',
};

export default function useOTAUpdates(options = {}) {
  const {
    autoCheck = true,
    autoDownload = false,
    autoApply = false,
    checkInterval = 0,
    onUpdateAvailable = null,
    onUpdateReady = null,
    onError = null,
  } = options;

  const [status, setStatus] = useState(UPDATE_STATUS.IDLE);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [error, setError] = useState(null);
  const [lastCheckTime, setLastCheckTime] = useState(null);
  const intervalRef = useRef(null);

  const getCurrentInfo = useCallback(() => {
    if (!Updates) {
      return {
        updateId: null,
        channel: null,
        createdAt: null,
        isEmbeddedLaunch: true,
        isEmergencyLaunch: false,
        runtimeVersion: Constants.expoConfig?.runtimeVersion,
        appVersion: Constants.expoConfig?.version,
      };
    }
    return {
      updateId: Updates.updateId,
      channel: Updates.channel,
      createdAt: Updates.createdAt,
      isEmbeddedLaunch: Updates.isEmbeddedLaunch,
      isEmergencyLaunch: Updates.isEmergencyLaunch,
      runtimeVersion: Constants.expoConfig?.runtimeVersion,
      appVersion: Constants.expoConfig?.version,
    };
  }, []);

  const checkForUpdate = useCallback(async () => {
    if (__DEV__ || !Updates) {
      setStatus(UPDATE_STATUS.UP_TO_DATE);
      return null;
    }

    try {
      setStatus(UPDATE_STATUS.CHECKING);
      setError(null);

      console.log('[OTA] Checking for updates...');
      const result = await Updates.checkForUpdateAsync();
      setLastCheckTime(new Date());

      if (result.isAvailable) {
        console.log('[OTA] Update available!', result.manifest?.id);
        setUpdateInfo({
          manifestId: result.manifest?.id,
          createdAt: result.manifest?.createdAt,
          runtimeVersion: result.manifest?.runtimeVersion,
          metadata: result.manifest?.metadata,
        });
        setStatus(UPDATE_STATUS.AVAILABLE);
        onUpdateAvailable?.(result);
        reportToServer('checked', result.manifest?.id);

        if (autoDownload) {
          return await downloadUpdate();
        }
        return result;
      } else {
        console.log('[OTA] App is up to date');
        setStatus(UPDATE_STATUS.UP_TO_DATE);
        return null;
      }
    } catch (err) {
      console.error('[OTA] Check failed:', err.message);
      setError(err.message);
      setStatus(UPDATE_STATUS.ERROR);
      onError?.(err);
      return null;
    }
  }, [autoDownload, onUpdateAvailable, onError]);

  const downloadUpdate = useCallback(async () => {
    if (__DEV__ || !Updates) return null;

    try {
      setStatus(UPDATE_STATUS.DOWNLOADING);
      console.log('[OTA] Downloading update...');

      const result = await Updates.fetchUpdateAsync();

      if (result.isNew) {
        console.log('[OTA] Update downloaded successfully!');
        setStatus(UPDATE_STATUS.READY);
        onUpdateReady?.(result);
        reportToServer('downloaded', updateInfo?.manifestId);

        if (autoApply) {
          await applyUpdate();
        }
        return result;
      } else {
        setStatus(UPDATE_STATUS.UP_TO_DATE);
        return null;
      }
    } catch (err) {
      console.error('[OTA] Download failed:', err.message);
      setError(err.message);
      setStatus(UPDATE_STATUS.ERROR);
      reportToServer('failed', updateInfo?.manifestId, err.message);
      onError?.(err);
      return null;
    }
  }, [autoApply, updateInfo, onUpdateReady, onError]);

  const applyUpdate = useCallback(async () => {
    if (!Updates) return;
    try {
      console.log('[OTA] Restarting to apply update...');
      setStatus(UPDATE_STATUS.RESTARTING);
      reportToServer('installed', updateInfo?.manifestId);
      await new Promise(r => setTimeout(r, 500));
      await Updates.reloadAsync();
    } catch (err) {
      console.error('[OTA] Restart failed:', err.message);
      setError(err.message);
      setStatus(UPDATE_STATUS.ERROR);
      onError?.(err);
    }
  }, [updateInfo, onError]);

  const downloadAndApply = useCallback(async () => {
    const checkResult = await checkForUpdate();
    if (!checkResult?.isAvailable) return false;

    const downloadResult = await downloadUpdate();
    if (!downloadResult?.isNew) return false;

    await applyUpdate();
    return true;
  }, [checkForUpdate, downloadUpdate, applyUpdate]);

  function reportToServer(reportStatus, updateId, errorMessage) {
    try {
      const serverUrl = Constants.expoConfig?.extra?.otaServerUrl;
      if (!serverUrl || !updateId) return;

      fetch(`${serverUrl}/api/expo/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updateId,
          status: reportStatus,
          errorMessage,
          platform: Platform.OS,
          runtimeVersion: Constants.expoConfig?.runtimeVersion,
        }),
      }).catch(() => {});
    } catch (e) {
      // Silently fail
    }
  }

  useEffect(() => {
    if (autoCheck && !__DEV__ && Updates) {
      const timer = setTimeout(() => checkForUpdate(), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (checkInterval > 0 && !__DEV__ && Updates) {
      intervalRef.current = setInterval(() => {
        if (status !== UPDATE_STATUS.DOWNLOADING && status !== UPDATE_STATUS.RESTARTING) {
          checkForUpdate();
        }
      }, checkInterval);
      return () => clearInterval(intervalRef.current);
    }
  }, [checkInterval, status]);

  return {
    status,
    updateInfo,
    error,
    lastCheckTime,
    currentInfo: getCurrentInfo(),
    isChecking: status === UPDATE_STATUS.CHECKING,
    isDownloading: status === UPDATE_STATUS.DOWNLOADING,
    isUpdateAvailable: status === UPDATE_STATUS.AVAILABLE,
    isReady: status === UPDATE_STATUS.READY,
    checkForUpdate,
    downloadUpdate,
    applyUpdate,
    downloadAndApply,
  };
}
