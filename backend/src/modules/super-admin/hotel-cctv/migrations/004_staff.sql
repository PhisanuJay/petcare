PRAGMA foreign_keys = OFF;

CREATE TABLE users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'customer', 'staff')),
  display_name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+7 hours'))
);

INSERT INTO users_new (id, email, password_hash, role, display_name, is_active, created_at)
SELECT id, email, password_hash, role, display_name, is_active, created_at FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE TABLE staff_permissions (
  user_id INTEGER PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  view_cameras INTEGER NOT NULL DEFAULT 1,
  manage_cameras INTEGER NOT NULL DEFAULT 0,
  care_logs INTEGER NOT NULL DEFAULT 1,
  manage_customers INTEGER NOT NULL DEFAULT 0,
  manage_grants INTEGER NOT NULL DEFAULT 0,
  manage_rooms INTEGER NOT NULL DEFAULT 0,
  view_logs INTEGER NOT NULL DEFAULT 0,
  view_settings INTEGER NOT NULL DEFAULT 0
);

PRAGMA foreign_keys = ON;
