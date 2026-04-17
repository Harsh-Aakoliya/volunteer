/**
 * OTA Update Client for React Native
 * 
 * Usage:
 *   import OTAUpdater from './OTAUpdater';
 * 
 *   // Initialize
 *   OTAUpdater.configure({
 *     serverUrl: 'http://your-server:3000',
 *     appKey: 'your-app-key',
 *     deploymentKey: 'production',
 *   });
 * 
 *   // Check for updates
 *   await OTAUpdater.checkForUpdate();
 */

import { Platform, NativeModules, Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';

const STORAGE_KEYS = {
  CURRENT_BUNDLE_HASH: '@ota_bundle_hash',
  CURRENT_LABEL: '@ota_label',
  PENDING_UPDATE: '@ota_pending_update',
  FAILED_UPDATES: '@ota_failed_updates',
  LAST_CHECK: '@ota_last_check',
  DEVICE_ID: '@ota_device_id',
};

class OTAUpdateClient {
  constructor() {
    this.config = null;
    this.isChecking = false;
    this.deviceId = null;
    this._appStateSubscription = null;
  }

  // ─────────────────────────────────────────────
  // CONFIGURATION
  // ─────────────────────────────────────────────

  /**
   * Configure the OTA client
   * @param {Object} options
   * @param {string} options.serverUrl - OTA server URL
   * @param {string} options.appKey - Your app key
   * @param {string} options.deploymentKey - Deployment (production/staging)
   * @param {string} options.appVersion - Current binary version (e.g., '1.0.0')
   * @param {boolean} options.checkOnResume - Check for updates when app resumes
   * @param {number} options.checkInterval - Minimum seconds between checks
   * @param {Function} options.onUpdateAvailable - Callback when update is available
   * @param {Function} options.onDownloadProgress - Download progress callback
   * @param {Function} options.onUpdateInstalled - Called after update is applied
   * @param {Function} options.onError - Error callback
   */
  configure(options) {
    this.config = {
      serverUrl: options.serverUrl.replace(/\/$/, ''),
      appKey: options.appKey,
      deploymentKey: options.deploymentKey || 'production',
      appVersion: options.appVersion,
      checkOnResume: options.checkOnResume !== false,
      checkInterval: options.checkInterval || 300, // 5 minutes
      installMode: options.installMode || 'ON_NEXT_RESTART', // or 'IMMEDIATE'
      onUpdateAvailable: options.onUpdateAvailable,
      onDownloadProgress: options.onDownloadProgress,
      onUpdateInstalled: options.onUpdateInstalled,
      onError: options.onError || console.error,
    };

    this._initDeviceId();

    // Listen for app state changes
    if (this.config.checkOnResume) {
      this._setupAppStateListener();
    }

    // Check for pending updates on startup
    this._applyPendingUpdate();

    return this;
  }

  // ─────────────────────────────────────────────
  // CORE API
  // ─────────────────────────────────────────────

  /**
   * Check server for available updates
   * @returns {Object|null} Update info or null
   */
  async checkForUpdate() {
    if (!this.config) throw new Error('OTAUpdater not configured. Call configure() first.');
    if (this.isChecking) return null;

    // Rate limiting
    const lastCheck = await AsyncStorage.getItem(STORAGE_KEYS.LAST_CHECK);
    if (lastCheck) {
      const elapsed = (Date.now() - parseInt(lastCheck)) / 1000;
      if (elapsed < this.config.checkInterval) {
        console.log(`[OTA] Skipping check (${Math.round(this.config.checkInterval - elapsed)}s until next)`);
        return null;
      }
    }

    this.isChecking = true;

    try {
      const currentHash = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_BUNDLE_HASH);
      const currentLabel = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_LABEL);
      const deviceId = await this._getDeviceId();

      const params = new URLSearchParams({
        appKey: this.config.appKey,
        platform: Platform.OS,
        appVersion: this.config.appVersion,
        deployment: this.config.deploymentKey,
        deviceId,
        ...(currentHash && { currentBundleHash: currentHash }),
        ...(currentLabel && { label: currentLabel }),
      });

      const url = `${this.config.serverUrl}/api/updates/check?${params}`;
      console.log('[OTA] Checking for updates...');

      const response = await fetch(url);
      const result = await response.json();

      await AsyncStorage.setItem(STORAGE_KEYS.LAST_CHECK, Date.now().toString());

      if (result.success && result.data.updateAvailable) {
        const update = result.data.update;
        console.log(`[OTA] Update available: ${update.label}`);

        // Check if this update previously failed
        const failedUpdates = JSON.parse(
          await AsyncStorage.getItem(STORAGE_KEYS.FAILED_UPDATES) || '[]'
        );
        if (failedUpdates.includes(update.bundleHash)) {
          console.log('[OTA] Skipping previously failed update');
          return null;
        }

        if (this.config.onUpdateAvailable) {
          this.config.onUpdateAvailable(update);
        }

        return update;
      }

      console.log(`[OTA] No update available: ${result.data?.reason || 'up to date'}`);
      return null;

    } catch (error) {
      console.error('[OTA] Check failed:', error.message);
      this.config.onError?.(error);
      return null;
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Download and install an update
   * @param {Object} update - Update info from checkForUpdate()
   * @param {Object} options - { installMode: 'IMMEDIATE' | 'ON_NEXT_RESTART' }
   */
  async downloadAndInstall(update, options = {}) {
    if (!update) throw new Error('No update provided');

    const installMode = options.installMode || this.config.installMode;

    try {
      console.log(`[OTA] Downloading update ${update.label}...`);

      // ── Create bundle directory ──
      const bundleDir = `${RNFS.DocumentDirectoryPath}/ota_bundles`;
      const bundlePath = `${bundleDir}/${update.label}.bundle`;

      await RNFS.mkdir(bundleDir);

      // ── Download with progress ──
      const downloadResult = await RNFS.downloadFile({
        fromUrl: update.downloadUrl,
        toFile: bundlePath,
        headers: { 'X-Device-Id': await this._getDeviceId() },
        progress: (res) => {
          const progress = res.bytesWritten / res.contentLength;
          this.config.onDownloadProgress?.({
            received: res.bytesWritten,
            total: res.contentLength,
            progress: Math.round(progress * 100),
          });
        },
        progressDivider: 5,
      }).promise;

      if (downloadResult.statusCode !== 200) {
        throw new Error(`Download failed with status ${downloadResult.statusCode}`);
      }

      // ── Verify hash ──
      const fileHash = await RNFS.hash(bundlePath, 'sha256');
      if (fileHash !== update.bundleHash) {
        await RNFS.unlink(bundlePath);
        throw new Error('Bundle hash mismatch - download corrupted');
      }

      console.log('[OTA] Bundle verified ✓');

      // ── Save metadata ──
      await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_BUNDLE_HASH, update.bundleHash);
      await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_LABEL, update.label);
      await AsyncStorage.setItem(STORAGE_KEYS.PENDING_UPDATE, JSON.stringify({
        bundlePath,
        label: update.label,
        hash: update.bundleHash,
        installedAt: new Date().toISOString(),
      }));

      // ── Report to server ──
      await this._reportStatus(update.id, 'installed');

      console.log(`[OTA] Update ${update.label} ready!`);
      this.config.onUpdateInstalled?.(update);

      // ── Apply update ──
      if (installMode === 'IMMEDIATE') {
        this.restartApp();
      } else {
        // Will be applied on next restart via native module
        console.log('[OTA] Update will be applied on next restart');
      }

      return true;

    } catch (error) {
      console.error('[OTA] Download/install failed:', error.message);
      
      // Mark as failed
      const failedUpdates = JSON.parse(
        await AsyncStorage.getItem(STORAGE_KEYS.FAILED_UPDATES) || '[]'
      );
      failedUpdates.push(update.bundleHash);
      await AsyncStorage.setItem(STORAGE_KEYS.FAILED_UPDATES, JSON.stringify(failedUpdates));

      await this._reportStatus(update.id, 'failed', error.message);
      this.config.onError?.(error);
      return false;
    }
  }

  /**
   * Check + Download + Install in one call
   */
  async sync(options = {}) {
    const update = await this.checkForUpdate();
    
    if (!update) return { status: 'UP_TO_DATE' };

    if (update.isMandatory || options.installMode === 'IMMEDIATE') {
      const success = await this.downloadAndInstall(update, { installMode: 'IMMEDIATE' });
      return { status: success ? 'UPDATE_INSTALLED' : 'FAILED', update };
    }

    // For non-mandatory, show a prompt
    return new Promise((resolve) => {
      Alert.alert(
        'Update Available',
        update.description || `Version ${update.label} is available. Would you like to update?`,
        [
          {
            text: 'Later',
            style: 'cancel',
            onPress: () => resolve({ status: 'SKIPPED', update }),
          },
          {
            text: 'Update Now',
            onPress: async () => {
              const success = await this.downloadAndInstall(update, options);
              resolve({ status: success ? 'UPDATE_INSTALLED' : 'FAILED', update });
            },
          },
        ]
      );
    });
  }

  /**
   * Get the path to the current OTA bundle (for native module)
   */
  async getCurrentBundlePath() {
    try {
      const pendingStr = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_UPDATE);
      if (pendingStr) {
        const pending = JSON.parse(pendingStr);
        const exists = await RNFS.exists(pending.bundlePath);
        if (exists) return pending.bundlePath;
      }
    } catch (e) {
      console.warn('[OTA] Error getting bundle path:', e);
    }
    return null;
  }

  /**
   * Get current OTA metadata
   */
  async getMetadata() {
    return {
      currentHash: await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_BUNDLE_HASH),
      currentLabel: await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_LABEL),
      deviceId: await this._getDeviceId(),
      hasPendingUpdate: !!(await AsyncStorage.getItem(STORAGE_KEYS.PENDING_UPDATE)),
    };
  }

  /**
   * Clear all OTA data (reset to original bundle)
   */
  async clearUpdates() {
    const bundleDir = `${RNFS.DocumentDirectoryPath}/ota_bundles`;
    try {
      const exists = await RNFS.exists(bundleDir);
      if (exists) await RNFS.unlink(bundleDir);
    } catch (e) { /* ignore */ }

    await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
    console.log('[OTA] All updates cleared. Restart to use original bundle.');
  }

  /**
   * Restart the app (requires native module)
   */
  restartApp() {
    if (NativeModules.OTAUpdater) {
      NativeModules.OTAUpdater.restart();
    } else {
      console.warn('[OTA] Native restart module not available. User must manually restart.');
      Alert.alert(
        'Update Ready',
        'Please restart the app to apply the update.',
        [{ text: 'OK' }]
      );
    }
  }

  // ─────────────────────────────────────────────
  // PRIVATE METHODS
  // ─────────────────────────────────────────────

  async _initDeviceId() {
    let id = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);
    if (!id) {
      id = 'device_' + Math.random().toString(36).substr(2, 16) + Date.now().toString(36);
      await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, id);
    }
    this.deviceId = id;
  }

  async _getDeviceId() {
    if (!this.deviceId) await this._initDeviceId();
    return this.deviceId;
  }

  async _applyPendingUpdate() {
    try {
      const pendingStr = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_UPDATE);
      if (pendingStr) {
        const pending = JSON.parse(pendingStr);
        const exists = await RNFS.exists(pending.bundlePath);
        if (exists) {
          console.log(`[OTA] Running OTA bundle: ${pending.label}`);
        } else {
          // Bundle file missing, clear pending
          await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_UPDATE);
          await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_BUNDLE_HASH);
          await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_LABEL);
        }
      }
    } catch (e) {
      console.warn('[OTA] Error checking pending update:', e);
    }
  }

  async _reportStatus(releaseId, status, errorMessage) {
    try {
      await fetch(`${this.config.serverUrl}/api/updates/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          releaseId,
          deviceId: await this._getDeviceId(),
          status,
          errorMessage,
          appVersion: this.config.appVersion,
          platform: Platform.OS,
        }),
      });
    } catch (e) {
      // Silently fail - don't break the app for analytics
    }
  }

  _setupAppStateListener() {
    this._appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        this.checkForUpdate().catch(() => {});
      }
    });
  }

  destroy() {
    this._appStateSubscription?.remove();
  }
}

export default new OTAUpdateClient();