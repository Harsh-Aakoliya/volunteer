const database = require('../database');
const storageService = require('../services/storage.service');
const { satisfiesVersion } = require('../utils/helpers');

class UpdateController {
  /**
   * GET /api/updates/check
   * 
   * Client query params:
   *   - appKey: string (required)
   *   - platform: 'android' | 'ios' (required)
   *   - appVersion: string - current binary version (required)
   *   - currentBundleHash: string - hash of currently running bundle
   *   - label: string - current label
   *   - deployment: string - default 'production'
   *   - deviceId: string - unique device ID
   */
  check(req, res) {
    const {
      appKey,
      platform,
      appVersion,
      currentBundleHash,
      label: currentLabel,
      deployment = 'production',
      deviceId
    } = req.query;

    // ── Validate ──
    if (!appKey || !platform || !appVersion) {
      return res.status(400).json({
        success: false,
        error: 'appKey, platform, and appVersion are required'
      });
    }

    const db = database.getDb();

    // ── Find app ──
    const app = db.prepare('SELECT * FROM apps WHERE app_key = ?').get(appKey);
    if (!app) {
      return res.status(404).json({ success: false, error: 'App not found' });
    }

    // ── Find deployment ──
    const dep = db.prepare('SELECT * FROM deployments WHERE app_id = ? AND name = ?')
      .get(app.id, deployment);

    if (!dep) {
      return res.json({
        success: true,
        data: { updateAvailable: false, reason: 'No deployment found' }
      });
    }

    // ── Find active release ──
    const activeRelease = db.prepare(`
      SELECT r.* FROM active_releases ar
      JOIN releases r ON ar.release_id = r.id
      WHERE ar.deployment_id = ? AND ar.platform = ?
    `).get(dep.id, platform);

    if (!activeRelease || activeRelease.is_disabled) {
      // Log the check
      this._logUpdate(db, null, app.id, deviceId, platform, appVersion, currentLabel, null, 'checked');
      
      return res.json({
        success: true,
        data: { updateAvailable: false, reason: 'No active release' }
      });
    }

    // ── Check if app version is compatible ──
    const isCompatible = satisfiesVersion(appVersion, activeRelease.target_binary_version);

    if (!isCompatible) {
      this._logUpdate(db, activeRelease.id, app.id, deviceId, platform, appVersion, currentLabel, activeRelease.label, 'checked');
      
      return res.json({
        success: true,
        data: {
          updateAvailable: false,
          reason: 'Binary version mismatch',
          targetBinaryVersion: activeRelease.target_binary_version,
          yourVersion: appVersion
        }
      });
    }

    // ── Check if already on latest ──
    if (currentBundleHash && currentBundleHash === activeRelease.bundle_hash) {
      this._logUpdate(db, activeRelease.id, app.id, deviceId, platform, appVersion, currentLabel, activeRelease.label, 'checked');
      
      return res.json({
        success: true,
        data: { updateAvailable: false, reason: 'Already on latest' }
      });
    }

    // ── Update available! ──
    this._logUpdate(db, activeRelease.id, app.id, deviceId, platform, appVersion, currentLabel, activeRelease.label, 'checked');

    // Build download URL
    const downloadUrl = `${req.protocol}://${req.get('host')}/api/updates/download/${activeRelease.id}`;

    res.json({
      success: true,
      data: {
        updateAvailable: true,
        update: {
          id: activeRelease.id,
          label: activeRelease.label,
          version: activeRelease.version,
          description: activeRelease.description,
          bundleHash: activeRelease.bundle_hash,
          bundleSize: activeRelease.bundle_size,
          isMandatory: !!activeRelease.is_mandatory,
          downloadUrl,
          targetBinaryVersion: activeRelease.target_binary_version,
          createdAt: activeRelease.created_at
        }
      }
    });
  }

  /**
   * GET /api/updates/download/:releaseId
   * Stream the bundle file to the client
   */
  download(req, res) {
    const db = database.getDb();
    const release = db.prepare('SELECT * FROM releases WHERE id = ?')
      .get(req.params.releaseId);

    if (!release || release.is_disabled) {
      return res.status(404).json({ success: false, error: 'Release not found' });
    }

    const bundlePath = storageService.getAbsolutePath(release.bundle_path);

    if (!storageService.exists(release.bundle_path)) {
      return res.status(404).json({ success: false, error: 'Bundle file not found' });
    }

    // Increment download count
    db.prepare('UPDATE releases SET download_count = download_count + 1 WHERE id = ?')
      .run(release.id);

    // Log download
    const deviceId = req.query.deviceId || req.headers['x-device-id'] || 'unknown';
    this._logUpdate(db, release.id, release.app_id, deviceId, release.platform, 
      req.query.appVersion, null, release.label, 'downloaded');

    // Set headers
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${release.label}.bundle"`);
    res.setHeader('Content-Length', release.bundle_size);
    res.setHeader('X-Bundle-Hash', release.bundle_hash);
    res.setHeader('X-OTA-Label', release.label);

    // Stream file
    const readStream = storageService.getReadStream(release.bundle_path);
    readStream.pipe(res);
  }

  /**
   * POST /api/updates/report
   * Client reports update status (installed, failed, etc.)
   */
  report(req, res) {
    const { releaseId, deviceId, status, errorMessage, appVersion, platform } = req.body;

    if (!releaseId || !deviceId || !status) {
      return res.status(400).json({
        success: false,
        error: 'releaseId, deviceId, and status are required'
      });
    }

    const validStatuses = ['installed', 'failed', 'rolledback'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `status must be one of: ${validStatuses.join(', ')}`
      });
    }

    const db = database.getDb();
    const release = db.prepare('SELECT * FROM releases WHERE id = ?').get(releaseId);

    if (!release) {
      return res.status(404).json({ success: false, error: 'Release not found' });
    }

    // Update release counters
    const counterMap = {
      'installed': 'install_count',
      'failed': 'failed_count',
      'rolledback': 'rollback_count'
    };

    const counterField = counterMap[status];
    db.prepare(`UPDATE releases SET ${counterField} = ${counterField} + 1 WHERE id = ?`)
      .run(release.id);

    // Log
    this._logUpdate(db, releaseId, release.app_id, deviceId, platform, appVersion, 
      null, release.label, status, errorMessage);

    res.json({ success: true, message: 'Status reported' });
  }

  /**
   * Log update event
   */
  _logUpdate(db, releaseId, appId, deviceId, platform, appVersion, prevLabel, newLabel, status, errorMsg) {
    try {
      db.prepare(`
        INSERT INTO update_logs (release_id, app_id, device_id, platform, app_version, 
          previous_label, new_label, status, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        releaseId, appId, deviceId || 'unknown', platform || null,
        appVersion || null, prevLabel || null, newLabel || null,
        status, errorMsg || null
      );
    } catch (e) {
      console.warn('Failed to log update:', e.message);
    }
  }
}

module.exports = new UpdateController();