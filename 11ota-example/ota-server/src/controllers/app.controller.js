const database = require('../database');
const { generateAppKey } = require('../utils/helpers');

class AppController {
  create(req, res) {
    const { name, slug } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Name is required' });

    const db = database.getDb();
    const appKey = generateAppKey();

    const result = db.prepare(
      'INSERT INTO apps (app_key, name, slug, owner_id) VALUES (?, ?, ?, ?)'
    ).run(appKey, name, slug || name.toLowerCase().replace(/\s+/g, '-'), req.user.id);

    const app = db.prepare('SELECT * FROM apps WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({ success: true, data: app });
  }

  list(req, res) {
    const db = database.getDb();
    const apps = db.prepare(`
      SELECT a.*, 
        (SELECT COUNT(*) FROM expo_updates WHERE app_id = a.id) as update_count,
        (SELECT COALESCE(SUM(download_count), 0) FROM expo_updates WHERE app_id = a.id) as total_downloads
      FROM apps a WHERE a.owner_id = ?
      ORDER BY a.created_at DESC
    `).all(req.user.id);

    res.json({ success: true, data: apps });
  }

  get(req, res) {
    const db = database.getDb();
    const app = db.prepare('SELECT * FROM apps WHERE app_key = ? AND owner_id = ?')
      .get(req.params.appKey, req.user.id);
    if (!app) return res.status(404).json({ success: false, error: 'App not found' });

    const updates = db.prepare(`
      SELECT * FROM expo_updates WHERE app_id = ? ORDER BY created_at DESC LIMIT 20
    `).all(app.id);

    res.json({ success: true, data: { ...app, updates } });
  }

  delete(req, res) {
    const db = database.getDb();
    const app = db.prepare('SELECT * FROM apps WHERE app_key = ? AND owner_id = ?')
      .get(req.params.appKey, req.user.id);
    if (!app) return res.status(404).json({ success: false, error: 'App not found' });

    db.transaction(() => {
      db.prepare('DELETE FROM expo_assets WHERE update_id IN (SELECT update_id FROM expo_updates WHERE app_id = ?)').run(app.id);
      db.prepare('DELETE FROM update_logs WHERE app_id = ?').run(app.id);
      db.prepare('DELETE FROM expo_updates WHERE app_id = ?').run(app.id);
      db.prepare('DELETE FROM apps WHERE id = ?').run(app.id);
    })();

    res.json({ success: true, message: 'App deleted' });
  }
}

module.exports = new AppController();