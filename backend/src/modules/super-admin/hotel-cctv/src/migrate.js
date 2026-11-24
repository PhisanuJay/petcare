const fs = require('fs');
const path = require('path');
const { getDb } = require('./db');

function migrate() {
  const db = getDb();
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now', '+7 hours'))
  )`);
  const dir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.sql')).sort();
  const existing = db.prepare('SELECT id FROM schema_migrations WHERE id = ?');
  const mark = db.prepare('INSERT INTO schema_migrations (id) VALUES (?)');
  for (const file of files) {
    if (existing.all(file).length) continue;
    db.exec(fs.readFileSync(path.join(dir, file), 'utf8'));
    mark.run(file);
  }
}

module.exports = { migrate };
