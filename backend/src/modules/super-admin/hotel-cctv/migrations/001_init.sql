CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'customer')),
  display_name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+7 hours'))
);

CREATE TABLE cameras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  room_label TEXT,
  cat_name TEXT,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  stream_status TEXT NOT NULL DEFAULT 'offline' CHECK (stream_status IN ('offline', 'connecting', 'online')),
  last_error TEXT,
  last_seen_at TEXT,
  rtsp_url_enc TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+7 hours')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', '+7 hours'))
);

CREATE INDEX idx_cameras_status ON cameras (stream_status);

CREATE TABLE camera_grants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  camera_id INTEGER NOT NULL REFERENCES cameras (id),
  user_id INTEGER NOT NULL REFERENCES users (id),
  pet_name TEXT,
  room_label TEXT,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+7 hours'))
);

CREATE INDEX idx_grants_user ON camera_grants (user_id, revoked_at, ends_at);
CREATE INDEX idx_grants_camera ON camera_grants (camera_id);

CREATE TABLE stream_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users (id),
  camera_id INTEGER NOT NULL REFERENCES cameras (id),
  grant_id INTEGER NOT NULL REFERENCES camera_grants (id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+7 hours'))
);

CREATE INDEX idx_sessions_camera ON stream_sessions (camera_id, expires_at);
