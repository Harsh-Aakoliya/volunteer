const path = require('path');
const fs = require('fs');
const config = require('../config');
const database = require('../database');

class ExpoController {
  /**
   * GET /api/expo/manifest
   * 
   * This is the endpoint that expo-updates calls to check for updates.
   * 
   * expo-updates sends these headers:
   *   - expo-platform: 'android' | 'ios'
   *   - expo-runtime-version: string
   *   - expo-current-update-id: UUID (optional)
   *   - expo-protocol-version: '0' | '1'
   * 
   * And these query params (set in app.config):
   *   - app_key: our app identifier
   *   - deployment: 'production' | 'staging' etc.
   */
  getManifest(req, res) {
    try {
      const platform = req.headers['expo-platform'];
      const runtimeVersion = req.headers['expo-runtime-version'];
      const currentUpdateId = req.headers['expo-current-update-id'];
      const protocolVersion = req.headers['expo-protocol-version'] || '0';

      // App key from query params (set in updates.url in app.config)
      const appKey = req.query.app_key;
      const deployment = req.query.deployment || 'production';

      // ── Validate ──
      if (!platform || !runtimeVersion) {
        return this._sendNoUpdate(res, protocolVersion, 'Missing platform or runtimeVersion headers');
      }

      if (!appKey) {
        return this._sendNoUpdate(res, protocolVersion, 'Missing app_key query param');
      }

      const db = database.getDb();

      // ── Find app ──
      const app = db.prepare('SELECT * FROM apps WHERE app_key = ?').get(appKey);
      if (!app) {
        return this._sendNoUpdate(res, protocolVersion, 'App not found');
      }

      // ── Find latest active update ──
      const update = db.prepare(`
        SELECT * FROM expo_updates
        WHERE app_id = ? AND platform = ? AND deployment = ?
          AND runtime_version = ? AND is_active = 1
        ORDER BY created_at DESC
        LIMIT 1
      `).get(app.id, platform, deployment, runtimeVersion);

      if (!update) {
        this._logCheck(db, null, app.id, platform, runtimeVersion);
        return this._sendNoUpdate(res, protocolVersion, 'No update available');
      }

      // ── Check if client already has this update ──
      if (currentUpdateId && currentUpdateId === update.update_id) {
        this._logCheck(db, update.update_id, app.id, platform, runtimeVersion);
        return this._sendNoUpdate(res, protocolVersion, 'Already up to date');
      }

      // ── Fetch assets ──
      const assets = db.prepare('SELECT * FROM expo_assets WHERE update_id = ?')
        .all(update.update_id);

      // ── Build manifest ──
      const serverUrl = config.serverUrl;

      const manifest = {
        id: update.update_id,
        createdAt: update.created_at,
        runtimeVersion: update.runtime_version,
        launchAsset: {
          hash: update.bundle_hash,
          key: update.bundle_key,
          contentType: update.bundle_content_type,
          url: `${serverUrl}/api/expo/assets/${update.update_id}/${update.bundle_key}`,
        },
        assets: assets.map(a => ({
          hash: a.hash,
          key: a.asset_key,
          contentType: a.content_type,
          fileExtension: a.file_extension || '',
          url: `${serverUrl}/api/expo/assets/${update.update_id}/${a.asset_key}`,
        })),
        metadata: {},
        extra: {
          expoClient: update.extra_json ? JSON.parse(update.extra_json).expoClient : {},
        },
      };

      // ── Increment download count ──
      db.prepare('UPDATE expo_updates SET download_count = download_count + 1 WHERE update_id = ?')
        .run(update.update_id);

      // ── Log ──
      this._logCheck(db, update.update_id, app.id, platform, runtimeVersion, 'downloaded');

      console.log(`📦 Serving update ${update.update_id} to ${platform}/${runtimeVersion}`);

      // ── Send response based on protocol version ──
      if (protocolVersion === '1') {
        return this._sendMultipartManifest(res, manifest);
      } else {
        // Protocol v0 — plain JSON
        res.setHeader('expo-protocol-version', '0');
        res.setHeader('expo-sfv-version', '0');
        res.setHeader('cache-control', 'private, max-age=0');
        return res.json(manifest);
      }
    } catch (error) {
      console.error('❌ Manifest error:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/expo/assets/:updateId/:assetKey
   * 
   * Serve an individual asset or bundle file
   */
  getAsset(req, res) {
    const { updateId, assetKey } = req.params;
    const db = database.getDb();

    // Check if it's the launch asset (bundle)
    const update = db.prepare('SELECT * FROM expo_updates WHERE update_id = ?').get(updateId);

    if (!update) {
      return res.status(404).json({ success: false, error: 'Update not found' });
    }

    let filePath, contentType;

    if (update.bundle_key === assetKey) {
      // Serving the JS bundle
      filePath = path.join(config.storagePath, update.bundle_file_path);
      contentType = update.bundle_content_type;
    } else {
      // Serving a regular asset
      const asset = db.prepare(
        'SELECT * FROM expo_assets WHERE update_id = ? AND asset_key = ?'
      ).get(updateId, assetKey);

      if (!asset) {
        return res.status(404).json({ success: false, error: 'Asset not found' });
      }

      filePath = path.join(config.storagePath, asset.file_path);
      contentType = asset.content_type;
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found on disk' });
    }

    const stat = fs.statSync(filePath);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    fs.createReadStream(filePath).pipe(res);
  }

  /**
   * POST /api/expo/report
   * Client reports install/failure
   */
  report(req, res) {
    const { updateId, status, errorMessage, platform, runtimeVersion } = req.body;

    if (!updateId || !status) {
      return res.status(400).json({ success: false, error: 'updateId and status required' });
    }

    const db = database.getDb();
    const update = db.prepare('SELECT * FROM expo_updates WHERE update_id = ?').get(updateId);

    if (update) {
      if (status === 'installed') {
        db.prepare('UPDATE expo_updates SET install_count = install_count + 1 WHERE update_id = ?')
          .run(updateId);
      } else if (status === 'failed') {
        db.prepare('UPDATE expo_updates SET failed_count = failed_count + 1 WHERE update_id = ?')
          .run(updateId);
      }
    }

    try {
      db.prepare(`
        INSERT INTO update_logs (update_id, app_id, platform, runtime_version, status, error_message)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(updateId, update?.app_id, platform, runtimeVersion, status, errorMessage);
    } catch (e) { /* ignore logging errors */ }

    res.json({ success: true });
  }

  /**
   * GET /api/expo/stats/:appKey
   */
  stats(req, res) {
    const db = database.getDb();
    const app = db.prepare('SELECT * FROM apps WHERE app_key = ?').get(req.params.appKey);
    if (!app) return res.status(404).json({ success: false, error: 'App not found' });

    const updates = db.prepare(`
      SELECT update_id, platform, runtime_version, deployment, description,
             bundle_size, is_active, download_count, install_count, failed_count, created_at
      FROM expo_updates WHERE app_id = ?
      ORDER BY created_at DESC LIMIT 50
    `).all(app.id);

    const totals = db.prepare(`
      SELECT 
        COUNT(*) as total_updates,
        COALESCE(SUM(download_count), 0) as total_downloads,
        COALESCE(SUM(install_count), 0) as total_installs,
        COALESCE(SUM(failed_count), 0) as total_failures
      FROM expo_updates WHERE app_id = ?
    `).get(app.id);

    res.json({ success: true, data: { totals, updates } });
  }

  // ─── Private helpers ───

  _sendNoUpdate(res, protocolVersion, reason) {
    if (protocolVersion === '1') {
      const boundary = `ota-boundary-${Date.now()}`;
      res.setHeader('Content-Type', `multipart/mixed; boundary=${boundary}`);
      res.setHeader('expo-protocol-version', '1');
      res.setHeader('expo-sfv-version', '0');
      res.setHeader('cache-control', 'private, max-age=0');

      const directive = JSON.stringify({ type: 'noUpdateAvailable' });
      const body =
        `\r\n--${boundary}\r\n` +
        `Content-Disposition: inline; name="directive"\r\n` +
        `Content-Type: application/json\r\n\r\n` +
        `${directive}\r\n` +
        `--${boundary}--\r\n`;

      return res.send(body);
    }

    // Protocol v0 — return 204
    res.setHeader('expo-protocol-version', '0');
    return res.status(204).end();
  }

  _sendMultipartManifest(res, manifest) {
    const boundary = `ota-boundary-${Date.now()}`;
    res.setHeader('Content-Type', `multipart/mixed; boundary=${boundary}`);
    res.setHeader('expo-protocol-version', '1');
    res.setHeader('expo-sfv-version', '0');
    res.setHeader('cache-control', 'private, max-age=0');

    const manifestJson = JSON.stringify(manifest);

    const body =
      `\r\n--${boundary}\r\n` +
      `Content-Disposition: inline; name="manifest"\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${manifestJson}\r\n` +
      `--${boundary}--\r\n`;

    return res.send(body);
  }

  _logCheck(db, updateId, appId, platform, runtimeVersion, status = 'checked') {
    try {
      db.prepare(`
        INSERT INTO update_logs (update_id, app_id, platform, runtime_version, status)
        VALUES (?, ?, ?, ?, ?)
      `).run(updateId, appId, platform, runtimeVersion, status);
    } catch (e) { /* ignore */ }
  }
}

module.exports = new ExpoController();