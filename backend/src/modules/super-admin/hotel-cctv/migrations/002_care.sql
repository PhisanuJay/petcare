CREATE TABLE care_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  camera_id INTEGER NOT NULL REFERENCES cameras (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('feed', 'water', 'play', 'health')),
  note TEXT NOT NULL DEFAULT '',
  logged_at TEXT NOT NULL DEFAULT (datetime('now', '+7 hours')),
  created_by INTEGER REFERENCES users (id)
);

CREATE INDEX idx_care_camera_time ON care_logs (camera_id, logged_at);
