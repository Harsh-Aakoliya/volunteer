const crypto = require('crypto');
const fs = require('fs');

/** SHA-256 of file → base64url (expo-updates format) */
function hashFileBase64(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('base64url');
}

/** SHA-256 of file → hex */
function hashFileHex(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/** Generate random API key */
function generateApiKey() {
  return `ota_${crypto.randomBytes(32).toString('hex')}`;
}

/** Generate random app key */
function generateAppKey() {
  return crypto.randomBytes(10).toString('hex');
}

/** Content type from extension */
function getContentType(ext) {
  const map = {
    '.js': 'application/javascript',
    '.hbc': 'application/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.json': 'application/json',
    '.lottie': 'application/json',
  };
  return map[ext] || 'application/octet-stream';
}

/** Format bytes */
function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

module.exports = {
  hashFileBase64,
  hashFileHex,
  generateApiKey,
  generateAppKey,
  getContentType,
  formatBytes,
};