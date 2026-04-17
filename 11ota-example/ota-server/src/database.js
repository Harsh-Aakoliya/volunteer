const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('./config');

let db;

function initialize() {
  const dbDir = path.dirname(config.dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    -- ═══════════════════════════════════════════
    -- USERS
    -- ═══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      api_key TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ═══════════════════════════════════════════
    -- APPS
    -- ═══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS apps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      slug TEXT,
      owner_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );

    -- ═══════════════════════════════════════════
    -- EXPO UPDATES (each uploaded expo export)
    -- ═══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS expo_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      update_id TEXT UNIQUE NOT NULL,
      app_id INTEGER NOT NULL,
      runtime_version TEXT NOT NULL,
      platform TEXT NOT NULL CHECK(platform IN ('android', 'ios')),
      deployment TEXT NOT NULL DEFAULT 'production',
      description TEXT,
      
      -- Launch asset (JS bundle)
      bundle_key TEXT NOT NULL,
      bundle_hash TEXT NOT NULL,
      bundle_content_type TEXT DEFAULT 'application/javascript',
      bundle_file_path TEXT NOT NULL,
      bundle_size INTEGER NOT NULL,
      
      -- Metadata
      expo_metadata TEXT,
      extra_json TEXT,
      
      -- Status
      is_active INTEGER DEFAULT 1,
      is_rollback INTEGER DEFAULT 0,
      rollback_of TEXT,
      
      -- Stats
      download_count INTEGER DEFAULT 0,
      install_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (app_id) REFERENCES apps(id)
    );

    -- ═══════════════════════════════════════════
    -- EXPO ASSETS (images, fonts, etc.)
    -- ═══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS expo_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      update_id TEXT NOT NULL,
      asset_key TEXT NOT NULL,
      hash TEXT NOT NULL,
      content_type TEXT NOT NULL,
      file_extension TEXT,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      FOREIGN KEY (update_id) REFERENCES expo_updates(update_id)
    );

    -- ═══════════════════════════════════════════
    -- UPDATE LOGS (analytics)
    -- ═══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS update_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      update_id TEXT,
      app_id INTEGER,
      device_id TEXT,
      platform TEXT,
      runtime_version TEXT,
      status TEXT CHECK(status IN ('checked','downloaded','installed','failed')),
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_expo_updates_app
      ON expo_updates(app_id, platform, deployment, runtime_version);
    CREATE INDEX IF NOT EXISTS idx_expo_updates_active
      ON expo_updates(app_id, platform, deployment, is_active);
    CREATE INDEX IF NOT EXISTS idx_expo_assets_update
      ON expo_assets(update_id);
    CREATE INDEX IF NOT EXISTS idx_apps_key ON apps(app_key);
  `);

  console.log('✅ Database initialized');
  const res=db.exec('SELECT * from apps');
  console.log('✅ Apps:', res);
  return db;
}

function getDb() {
  if (!db) initialize();
  return db;
}

module.exports = { initialize, getDb };