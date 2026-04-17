const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const extractZip = require('extract-zip');
const config = require('../config');
const database = require('../database');
const {
  hashFileBase64,
  hashFileHex,
  getContentType,
  formatBytes,
} = require('../utils/helpers');

const upload = multer({
  dest: path.join(config.storagePath, '_temp'),
  limits: { fileSize: config.maxBundleSize },
});

class ReleaseController {
  get uploadMiddleware() {
    return upload.single('bundle');
  }

  /**
   * POST /api/releases/expo-upload
   * 
   * Accepts a ZIP of the `dist/` folder from `npx expo export`
   * 
   * Body (multipart form):
   *   - bundle: ZIP file
   *   - appKey: string
   *   - runtimeVersion: string
   *   - platform: 'android' | 'ios'
   *   - deployment: string (default 'production')
   *   - description: string
   */
  async expoUpload(req, res) {
    let tempExtractDir = null;

    try {
      const { appKey, runtimeVersion, platform, deployment = 'production', description = '' } = req.body;

      // ── Validate ──
      if (!appKey || !runtimeVersion || !platform) {
        return res.status(400).json({
          success: false,
          error: 'appKey, runtimeVersion, and platform are required',
        });
      }

      if (!['android', 'ios'].includes(platform)) {
        return res.status(400).json({ success: false, error: 'platform must be android or ios' });
      }

      if (!req.file) {
        return res.status(400).json({ success: false, error: 'ZIP bundle file required' });
      }

      const db = database.getDb();

      // ── Find app ──
      const app = db.prepare('SELECT * FROM apps WHERE app_key = ? AND owner_id = ?')
        .get(appKey, req.user.id);
      if (!app) {
        this._cleanup(req.file.path);
        return res.status(404).json({ success: false, error: 'App not found' });
      }

      // ── Extract ZIP ──
      tempExtractDir = path.join(config.storagePath, '_temp', `extract_${Date.now()}`);
      fs.mkdirSync(tempExtractDir, { recursive: true });

      await extractZip(req.file.path, { dir: path.resolve(tempExtractDir) });

      // ── Read metadata.json ──
      const metadataPath = path.join(tempExtractDir, 'metadata.json');
      if (!fs.existsSync(metadataPath)) {
        throw new Error('metadata.json not found in ZIP. Did you zip the `dist/` contents?');
      }

      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      const platformMeta = metadata.fileMetadata?.[platform];

      if (!platformMeta) {
        throw new Error(`No metadata found for platform "${platform}" in metadata.json`);
      }

      // ── Locate bundle file ──
      const bundleRelPath = platformMeta.bundle;
      const bundleFullPath = path.join(tempExtractDir, bundleRelPath);

      if (!fs.existsSync(bundleFullPath)) {
        throw new Error(`Bundle file not found: ${bundleRelPath}`);
      }

      // ── Generate update ID ──
      const updateId = uuidv4();

      // ── Create permanent storage directory ──
      const updateDir = path.join(config.storagePath, appKey, 'expo', updateId);
      fs.mkdirSync(path.join(updateDir, 'bundles'), { recursive: true });
      fs.mkdirSync(path.join(updateDir, 'assets'), { recursive: true });

      // ── Copy & hash bundle ──
      const bundleFileName = path.basename(bundleRelPath);
      const bundleDestPath = path.join(updateDir, 'bundles', bundleFileName);
      fs.copyFileSync(bundleFullPath, bundleDestPath);

      const bundleHash = hashFileBase64(bundleDestPath);
      const bundleSize = fs.statSync(bundleDestPath).size;
      const bundleExt = path.extname(bundleFileName);
      const bundleContentType = getContentType(bundleExt);

      // ── Store relative path (from storage root) ──
      const bundleStoredPath = path.relative(config.storagePath, bundleDestPath);

      // ── Check for duplicate ──
      const existingUpdate = db.prepare(
        'SELECT * FROM expo_updates WHERE app_id = ? AND bundle_hash = ? AND platform = ?'
      ).get(app.id, bundleHash, platform);

      if (existingUpdate) {
        // Cleanup: remove the new directory
        fs.rmSync(updateDir, { recursive: true, force: true });
        this._cleanup(req.file.path);
        if (tempExtractDir) fs.rmSync(tempExtractDir, { recursive: true, force: true });

        return res.status(409).json({
          success: false,
          error: 'Identical bundle already exists',
          data: { existingUpdateId: existingUpdate.update_id },
        });
      }

      // ── Process assets ──
      const assets = platformMeta.assets || [];
      const assetRecords = [];

      for (const asset of assets) {
        const assetSrcPath = path.join(tempExtractDir, asset.path);
        if (!fs.existsSync(assetSrcPath)) {
          console.warn(`⚠️  Asset not found: ${asset.path}, skipping`);
          continue;
        }

        const assetFileName = path.basename(asset.path);
        const assetDestPath = path.join(updateDir, 'assets', assetFileName);
        fs.copyFileSync(assetSrcPath, assetDestPath);

        const assetHash = hashFileBase64(assetDestPath);
        const assetSize = fs.statSync(assetDestPath).size;
        const ext = asset.ext ? `.${asset.ext}` : '';
        const contentType = getContentType(ext);
        const storedPath = path.relative(config.storagePath, assetDestPath);

        assetRecords.push({
          updateId,
          key: assetFileName,
          hash: assetHash,
          contentType,
          fileExtension: ext,
          filePath: storedPath,
          fileSize: assetSize,
        });
      }

      // ── Copy metadata.json ──
      fs.copyFileSync(metadataPath, path.join(updateDir, 'metadata.json'));

      // ── Save to database ──
      const createUpdate = db.transaction(() => {
        // Deactivate previous updates for same app/platform/deployment/runtimeVersion
        db.prepare(`
          UPDATE expo_updates SET is_active = 0
          WHERE app_id = ? AND platform = ? AND deployment = ? AND runtime_version = ?
        `).run(app.id, platform, deployment, runtimeVersion);

        // Insert new update
        db.prepare(`
          INSERT INTO expo_updates (
            update_id, app_id, runtime_version, platform, deployment, description,
            bundle_key, bundle_hash, bundle_content_type, bundle_file_path, bundle_size,
            expo_metadata, extra_json, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `).run(
          updateId, app.id, runtimeVersion, platform, deployment, description,
          bundleFileName, bundleHash, bundleContentType, bundleStoredPath, bundleSize,
          JSON.stringify(metadata), JSON.stringify({ expoClient: { name: app.name, slug: app.slug } }),
          // is_active = 1
        );

        // Insert assets
        const insertAsset = db.prepare(`
          INSERT INTO expo_assets (update_id, asset_key, hash, content_type, file_extension, file_path, file_size)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const a of assetRecords) {
          insertAsset.run(a.updateId, a.key, a.hash, a.contentType, a.fileExtension, a.filePath, a.fileSize);
        }
      });

      createUpdate();

      // ── Cleanup temp files ──
      this._cleanup(req.file.path);
      if (tempExtractDir) fs.rmSync(tempExtractDir, { recursive: true, force: true });

      console.log(`✅ Expo update uploaded: ${updateId} (${platform}/${runtimeVersion})`);

      res.status(201).json({
        success: true,
        data: {
          updateId,
          platform,
          runtimeVersion,
          deployment,
          bundleHash,
          bundleSize: formatBytes(bundleSize),
          assetsCount: assetRecords.length,
          description,
          createdAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      this._cleanup(req.file?.path);
      if (tempExtractDir && fs.existsSync(tempExtractDir)) {
        fs.rmSync(tempExtractDir, { recursive: true, force: true });
      }
      console.error('❌ Expo upload error:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/releases/:appKey/updates
   */
  listUpdates(req, res) {
    const { platform, deployment = 'production' } = req.query;
    const db = database.getDb();

    const app = db.prepare('SELECT * FROM apps WHERE app_key = ? AND owner_id = ?')
      .get(req.params.appKey, req.user.id);
    if (!app) return res.status(404).json({ success: false, error: 'App not found' });

    let query = 'SELECT * FROM expo_updates WHERE app_id = ?';
    const params = [app.id];

    if (platform) { query += ' AND platform = ?'; params.push(platform); }
    if (deployment) { query += ' AND deployment = ?'; params.push(deployment); }

    query += ' ORDER BY created_at DESC LIMIT 50';

    const updates = db.prepare(query).all(...params);

    res.json({
      success: true,
      data: updates.map(u => ({
        ...u,
        bundleSizeFormatted: formatBytes(u.bundle_size),
        isActive: !!u.is_active,
      })),
    });
  }

  /**
   * POST /api/releases/:updateId/rollback
   */
  rollback(req, res) {
    const db = database.getDb();
    const update = db.prepare(`
      SELECT eu.*, a.owner_id FROM expo_updates eu
      JOIN apps a ON eu.app_id = a.id WHERE eu.update_id = ?
    `).get(req.params.updateId);

    if (!update || update.owner_id !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Update not found' });
    }

    // Find previous active update
    const previous = db.prepare(`
      SELECT * FROM expo_updates
      WHERE app_id = ? AND platform = ? AND deployment = ? AND runtime_version = ?
        AND id < ? AND update_id != ?
      ORDER BY id DESC LIMIT 1
    `).get(update.app_id, update.platform, update.deployment, update.runtime_version,
      update.id, update.update_id);

    if (!previous) {
      return res.status(400).json({ success: false, error: 'No previous update to rollback to' });
    }

    db.transaction(() => {
      db.prepare('UPDATE expo_updates SET is_active = 0 WHERE update_id = ?').run(update.update_id);
      db.prepare('UPDATE expo_updates SET is_active = 1 WHERE update_id = ?').run(previous.update_id);
    })();

    res.json({
      success: true,
      message: `Rolled back. Active update is now ${previous.update_id}`,
    });
  }

  /**
   * PUT /api/releases/:updateId/toggle
   */
  toggle(req, res) {
    const db = database.getDb();
    const update = db.prepare(`
      SELECT eu.*, a.owner_id FROM expo_updates eu
      JOIN apps a ON eu.app_id = a.id WHERE eu.update_id = ?
    `).get(req.params.updateId);

    if (!update || update.owner_id !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Update not found' });
    }

    const newState = update.is_active ? 0 : 1;
    db.prepare('UPDATE expo_updates SET is_active = ? WHERE update_id = ?')
      .run(newState, update.update_id);

    res.json({ success: true, message: newState ? 'Activated' : 'Deactivated' });
  }

  _cleanup(filePath) {
    try {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) { /* ignore */ }
  }
}

module.exports = new ReleaseController();