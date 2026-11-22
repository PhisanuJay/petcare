-- ใช้ตรวจกล้องซ้ำโดยไม่เก็บ RTSP แบบเปิดเผย
ALTER TABLE cameras ADD COLUMN rtsp_fingerprint TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cameras_rtsp_fingerprint
  ON cameras (rtsp_fingerprint)
  WHERE rtsp_fingerprint IS NOT NULL;
