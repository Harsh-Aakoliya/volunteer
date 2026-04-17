const path = require('path');

module.exports = {
  port: parseInt(process.env.PORT || '3000'),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  dbPath: process.env.DB_PATH || './data/ota.db',
  jwtSecret: process.env.JWT_SECRET || 'change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
  storagePath: path.resolve(process.env.STORAGE_PATH || './bundles'),
  maxBundleSize: parseInt(process.env.MAX_BUNDLE_SIZE || '209715200'),
  serverUrl: process.env.SERVER_URL || 'http://localhost:3000',
};