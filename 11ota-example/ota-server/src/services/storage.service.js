const crypto = require('crypto');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate SHA-256 hash of a file
 */
function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Generate SHA-256 hash of a buffer
 */
function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Generate unique label like v1, v2, etc.
 */
function generateLabel(appId, platform, db) {
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM releases 
    WHERE app_id = ? AND platform = ?
  `).get(appId, platform);
  return `v${result.count + 1}`;
}

/**
 * Generate unique app key
 */
function generateAppKey() {
  return uuidv4().replace(/-/g, '').substring(0, 20);
}

/**
 * Generate API key
 */
function generateApiKey() {
  return `ota_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Validate semver-like version
 */
function isValidVersion(version) {
  return /^\d+\.\d+\.\d+$/.test(version) || /^\d+\.\d+$/.test(version) ||
         /^[\d.]+(-[\w.]+)?(\+[\w.]+)?$/.test(version);
}

/**
 * Check if app version satisfies target range
 * Supports: "1.0.0", ">=1.0.0", "1.0.x", "~1.0.0", "^1.0.0", "1.0.0 - 2.0.0"
 */
function satisfiesVersion(appVersion, targetRange) {
  try {
    const semver = require('semver');
    // Normalize versions
    const normalizedApp = semver.coerce(appVersion);
    if (!normalizedApp) return appVersion === targetRange;
    return semver.satisfies(normalizedApp, targetRange);
  } catch {
    return appVersion === targetRange;
  }
}

module.exports = {
  hashFile,
  hashBuffer,
  generateLabel,
  generateAppKey,
  generateApiKey,
  formatBytes,
  isValidVersion,
  satisfiesVersion
};