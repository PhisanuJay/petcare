import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { Router } from 'express';
import { requireCctvPermission } from './cctvAuth.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const databasePath = path.join(moduleDir, 'data', 'cathotel.sqlite');
const envPath = path.join(moduleDir, '.env');

function readSetting(name) {
  if (process.env[name]) return process.env[name];
  const line = readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`${name}=`));
  if (!line) return '';
  return line.slice(line.indexOf('=') + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
}

const cameraSecret = readSetting('CAMERA_SECRET');
if (!/^[\da-f]{64}$/i.test(cameraSecret)) {
  throw new Error('CCTV CAMERA_SECRET must be a 32-byte hexadecimal key');
}
const encryptionKey = Buffer.from(cameraSecret, 'hex');
const rtspAllowlist = readSetting('CAMERA_RTSP_ALLOWLIST')
  .split(',')
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);

const db = new DatabaseSync(databasePath);
db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
db.exec(`
  CREATE TABLE IF NOT EXISTS petcare_camera_grants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    camera_id INTEGER NOT NULL REFERENCES cameras(id),
    owner_id TEXT NOT NULL,
    owner_email TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    pet_name TEXT,
    room_label TEXT,
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    revoked_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', '+7 hours')),
    UNIQUE(camera_id, owner_id, starts_at, ends_at)
  );
  CREATE INDEX IF NOT EXISTS idx_petcare_camera_grants_owner
    ON petcare_camera_grants(owner_id, owner_email, revoked_at);
`);

function sendError(res, status, code, message) {
  res.status(status).json({ error: { code, message } });
}

function encryptRtspUrl(rtspUrl) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(rtspUrl, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

function decryptRtspUrl(encoded) {
  const payload = Buffer.from(encoded, 'base64');
  if (payload.length < 29) throw new Error('Invalid encrypted RTSP URL');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey, payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  const plain = Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString('utf8');
  if (!plain.startsWith('rtsp://')) throw new Error('Invalid decrypted RTSP URL');
  return plain;
}

function fingerprintRtspUrl(rtspUrl) {
  return createHash('sha256').update(rtspUrl).digest('hex');
}

function parseRtspUrl(value) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > 2048) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'rtsp:' || !url.hostname) return null;
    decodeURIComponent(url.username);
    decodeURIComponent(url.password);
    return url;
  } catch {
    return null;
  }
}

function ipv4Value(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }
  return parts.reduce((value, part) => ((value << 8) | part) >>> 0, 0);
}

function isAllowedRtspHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === '::1' || host.startsWith('127.')) return true;
  if (rtspAllowlist.includes(host)) return true;

  const address = ipv4Value(host);
  if (address === null) return false;
  return rtspAllowlist.some((entry) => {
    const [network, prefixText] = entry.split('/');
    const networkAddress = ipv4Value(network);
    if (networkAddress === null) return false;
    if (prefixText === undefined) return address === networkAddress;
    const prefix = Number(prefixText);
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (address & mask) === (networkAddress & mask);
  });
}

function probeRtsp(rtspUrl) {
  const url = parseRtspUrl(rtspUrl);
  if (!url) return Promise.resolve({ streamStatus: 'offline', lastError: 'ที่อยู่ RTSP ไม่ถูกต้อง' });

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (!isAllowedRtspHost(hostname)) {
    return Promise.resolve({
      streamStatus: 'offline',
      lastError: 'ที่อยู่กล้องไม่อยู่ในรายการอนุญาต',
    });
  }

  const target = new URL(url);
  const username = decodeURIComponent(target.username);
  const password = decodeURIComponent(target.password);
  target.username = '';
  target.password = '';
  target.hash = '';
  const authHeader = username || password
    ? `Authorization: Basic ${Buffer.from(`${username}:${password}`).toString('base64')}\r\n`
    : '';
  const host = hostname === 'localhost' ? '127.0.0.1' : hostname;
  const port = Number(url.port) || 554;

  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let response = '';
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(3000);
    socket.once('connect', () => {
      socket.write(
        `DESCRIBE ${target.href} RTSP/1.0\r\nCSeq: 1\r\nAccept: application/sdp\r\n${authHeader}\r\n`,
      );
    });
    socket.on('data', (chunk) => {
      response += chunk.toString('utf8');
      const status = response.match(/^RTSP\/1\.0 (\d{3})/);
      if (!status) return;
      const code = Number(status[1]);
      if (code === 200) {
        finish({ streamStatus: 'online', lastError: null });
      } else if (code === 401) {
        finish({ streamStatus: 'offline', lastError: 'ชื่อผู้ใช้หรือรหัสผ่านกล้องไม่ถูกต้อง' });
      } else if (code === 404) {
        finish({ streamStatus: 'offline', lastError: 'ไม่พบสตรีมตามที่อยู่ RTSP นี้' });
      } else {
        finish({ streamStatus: 'offline', lastError: `กล้องตอบกลับ RTSP ${code}` });
      }
    });
    socket.once('timeout', () => {
      finish({ streamStatus: 'offline', lastError: 'หมดเวลารอการตอบกลับจากกล้อง' });
    });
    socket.once('error', () => {
      finish({ streamStatus: 'offline', lastError: 'เชื่อมต่อกล้องผ่าน RTSP ไม่ได้' });
    });
  });
}

function cameraFromRow(row, includeRtspUrl = false) {
  if (!row) return null;
  const camera = {
    id: row.id,
    name: row.name,
    description: row.description || '',
    roomLabel: row.room_label || '',
    catName: row.cat_name || '',
    isEnabled: Boolean(row.is_enabled),
    streamStatus: row.stream_status,
    lastError: row.last_error || '',
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (includeRtspUrl) camera.rtspUrl = decryptRtspUrl(row.rtsp_url_enc);
  return camera;
}

function readCameras() {
  return db.prepare(
    `SELECT id, name, description, room_label, cat_name, is_enabled,
            stream_status, last_error, last_seen_at, created_at, updated_at
     FROM cameras ORDER BY id DESC`,
  ).all();
}

function summarizeCameras(rows) {
  return rows.reduce((summary, row) => {
    summary.total += 1;
    if (row.stream_status === 'online') summary.online += 1;
    else if (row.stream_status === 'connecting') summary.connecting += 1;
    else summary.offline += 1;
    return summary;
  }, { total: 0, online: 0, connecting: 0, offline: 0 });
}

function cameraById(id) {
  return db.prepare('SELECT * FROM cameras WHERE id = ?').get(id);
}

function validId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function parseGrantDate(value) {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  const localDate = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2}))?$/.exec(input);
  const date = new Date(localDate
    ? `${localDate[1]}:${localDate[2] || '00'}+07:00`
    : input);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function grantFromRow(row) {
  const startsAt = row.starts_at;
  const endsAt = row.ends_at;
  const now = Date.now();
  return {
    id: row.id,
    cameraId: row.camera_id,
    userId: row.owner_id,
    displayName: row.display_name || row.email,
    email: row.email,
    cameraName: row.camera_name,
    cameraCat: row.camera_cat || '',
    cameraRoom: row.camera_room || '',
    petName: row.pet_name || row.camera_cat || '',
    roomLabel: row.room_label || row.camera_room || '',
    startsAt,
    endsAt,
    revokedAt: row.revoked_at,
    isActive: !row.revoked_at && Date.parse(startsAt) <= now && Date.parse(endsAt) >= now,
  };
}

export function listGrantedCamerasForOwner(ownerId, email) {
  const normalizedId = String(ownerId || '').trim();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedId || !normalizedEmail) return [];
  const rows = db.prepare(
    `SELECT c.id, c.name, c.description, c.room_label, c.cat_name, c.is_enabled,
            c.stream_status, c.last_error, c.last_seen_at, c.created_at, c.updated_at,
            g.id AS grant_id, g.pet_name, g.room_label AS grant_room_label,
            g.starts_at, g.ends_at
     FROM petcare_camera_grants g
     JOIN cameras c ON c.id = g.camera_id
     WHERE g.owner_id = ? AND lower(g.owner_email) = ? AND g.revoked_at IS NULL`,
  ).all(normalizedId, normalizedEmail);
  const now = Date.now();
  return rows
    .filter((row) => Date.parse(row.starts_at) <= now && Date.parse(row.ends_at) >= now)
    .map((row) => ({
      ...cameraFromRow(row),
      petName: row.pet_name || row.cat_name || '',
      roomLabel: row.grant_room_label || row.room_label || '',
      accessStartsAt: row.starts_at,
      accessEndsAt: row.ends_at,
      grantId: row.grant_id,
    }));
}

const router = Router();

router.get('/rooms', requireCctvPermission('view_cameras'), (_req, res) => {
  const groups = new Map();
  for (const row of readCameras()) {
    const camera = cameraFromRow(row);
    const roomLabel = row.room_label?.trim() || 'ไม่ได้ระบุห้อง';
    if (!groups.has(roomLabel)) {
      groups.set(roomLabel, { roomLabel, cameras: [], online: 0 });
    }
    const group = groups.get(roomLabel);
    group.cameras.push(camera);
    if (camera.streamStatus === 'online') group.online += 1;
  }
  res.json({ items: [...groups.values()] });
});

router.get('/cameras', requireCctvPermission('view_cameras'), (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 20));
  const query = String(req.query.q || '').trim().toLowerCase();
  const status = ['online', 'connecting', 'offline'].includes(req.query.status)
    ? req.query.status
    : '';
  let rows = readCameras();
  if (query) {
    rows = rows.filter((row) => [row.name, row.room_label, row.cat_name]
      .some((value) => String(value || '').toLowerCase().includes(query)));
  }
  if (status) rows = rows.filter((row) => row.stream_status === status);
  const allRows = readCameras();
  res.json({
    items: rows.slice((page - 1) * pageSize, page * pageSize).map((row) => cameraFromRow(row)),
    total: rows.length,
    page,
    pageSize,
    summary: summarizeCameras(allRows),
  });
});

router.get('/customers', requireCctvPermission('manage_grants'), (_req, res) => {
  const items = db.prepare(
    `SELECT id, email, display_name, is_active
     FROM users WHERE role = 'customer'
     ORDER BY lower(display_name), lower(email)`,
  ).all().map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name || row.email,
    isActive: Boolean(row.is_active),
  }));
  res.json({ items });
});

router.get('/grants', requireCctvPermission('manage_grants'), (req, res) => {
  const rows = db.prepare(
    `SELECT g.id, g.camera_id, g.owner_id, g.pet_name, g.room_label, g.starts_at,
            g.ends_at, g.revoked_at, g.owner_name AS display_name, g.owner_email AS email,
            c.name AS camera_name, c.cat_name AS camera_cat, c.room_label AS camera_room
     FROM petcare_camera_grants g
     JOIN cameras c ON c.id = g.camera_id
     ORDER BY g.starts_at DESC, g.id DESC`,
  ).all();
  const items = rows.map(grantFromRow);
  res.json({
    items: req.query.active === '1' ? items.filter((item) => item.isActive) : items,
  });
});

router.get('/cameras/:id', requireCctvPermission('manage_cameras'), (req, res) => {
  const id = validId(req.params.id);
  const row = id ? cameraById(id) : null;
  if (!row) {
    sendError(res, 404, 'CAMERA_NOT_FOUND', 'ไม่พบกล้องนี้');
    return;
  }
  res.json({ camera: cameraFromRow(row, true) });
});

router.post('/cameras', requireCctvPermission('manage_cameras'), async (req, res) => {
  const body = req.body || {};
  const rtspUrl = typeof body.rtspUrl === 'string' ? body.rtspUrl.trim() : '';
  if (!parseRtspUrl(rtspUrl)) {
    sendError(res, 400, 'INVALID_RTSP_URL', 'กรุณาใส่ที่อยู่ RTSP ที่ถูกต้อง');
    return;
  }
  const roomLabel = String(body.roomLabel || '').trim().slice(0, 120);
  const catName = String(body.catName || '').trim().slice(0, 120);
  const name = String(body.name || '').trim().slice(0, 200)
    || (roomLabel && catName ? `${roomLabel} · ${catName}` : roomLabel || catName || 'กล้อง');
  const fingerprint = fingerprintRtspUrl(rtspUrl);
  if (db.prepare('SELECT id FROM cameras WHERE rtsp_fingerprint = ?').get(fingerprint)) {
    sendError(res, 409, 'CAMERA_ALREADY_EXISTS', 'ที่อยู่กล้องนี้ถูกเพิ่มแล้ว');
    return;
  }

  const checked = body.isEnabled === false
    ? { streamStatus: 'offline', lastError: 'กล้องถูกปิดใช้งาน' }
    : await probeRtsp(rtspUrl);
  const now = new Date().toISOString();
  const result = db.prepare(
    `INSERT INTO cameras
      (name, description, room_label, cat_name, is_enabled, stream_status,
       last_error, last_seen_at, rtsp_url_enc, rtsp_fingerprint, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+7 hours'))`,
  ).run(
    name,
    String(body.description || '').trim().slice(0, 500),
    roomLabel,
    catName,
    body.isEnabled === false ? 0 : 1,
    checked.streamStatus,
    checked.lastError,
    checked.streamStatus === 'online' ? now : null,
    encryptRtspUrl(rtspUrl),
    fingerprint,
  );
  const row = cameraById(Number(result.lastInsertRowid));
  res.status(201).json({ camera: cameraFromRow(row) });
});

router.post('/cameras/:id/grants', requireCctvPermission('manage_grants'), (req, res) => {
  const cameraId = validId(req.params.id);
  const ownerId = String(req.body?.userId || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const displayName = String(req.body?.displayName || '').trim().slice(0, 200);
  const camera = cameraId ? cameraById(cameraId) : null;
  if (!camera) {
    sendError(res, 404, 'CAMERA_NOT_FOUND', 'ไม่พบกล้องนี้');
    return;
  }
  if (
    !ownerId
    || ownerId.length > 128
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || !displayName
  ) {
    sendError(res, 400, 'INVALID_CUSTOMER', 'กรุณาเลือกลูกค้าจากบัญชี PetCare');
    return;
  }

  const startsAt = parseGrantDate(req.body?.startsAt);
  const endsAt = parseGrantDate(req.body?.endsAt);
  if (!startsAt || !endsAt || Date.parse(startsAt) >= Date.parse(endsAt)) {
    sendError(res, 400, 'INVALID_GRANT_PERIOD', 'กรุณาระบุช่วงเวลาให้ถูกต้อง');
    return;
  }
  const petName = String(req.body?.petName || camera.cat_name || '').trim().slice(0, 120);
  const roomLabel = String(req.body?.roomLabel || camera.room_label || '').trim().slice(0, 120);
  const result = db.prepare(
    `INSERT INTO petcare_camera_grants
      (camera_id, owner_id, owner_email, owner_name, pet_name, room_label, starts_at, ends_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(camera.id, ownerId, email, displayName, petName, roomLabel, startsAt, endsAt);
  const row = db.prepare(
    `SELECT g.id, g.camera_id, g.owner_id, g.pet_name, g.room_label, g.starts_at,
            g.ends_at, g.revoked_at, g.owner_name AS display_name, g.owner_email AS email,
            c.name AS camera_name, c.cat_name AS camera_cat, c.room_label AS camera_room
     FROM petcare_camera_grants g
     JOIN cameras c ON c.id = g.camera_id
     WHERE g.id = ?`,
  ).get(result.lastInsertRowid);
  res.status(201).json({ grant: grantFromRow(row) });
});

router.delete('/grants/:id', requireCctvPermission('manage_grants'), (req, res) => {
  const id = validId(req.params.id);
  const grant = id ? db.prepare('SELECT id FROM petcare_camera_grants WHERE id = ?').get(id) : null;
  if (!grant) {
    sendError(res, 404, 'GRANT_NOT_FOUND', 'ไม่พบสิทธิ์นี้');
    return;
  }
  db.prepare(
    `UPDATE petcare_camera_grants SET revoked_at = COALESCE(revoked_at, datetime('now'))
     WHERE id = ?`,
  ).run(id);
  res.json({ ok: true });
});

router.patch('/cameras/:id/toggle', requireCctvPermission('manage_cameras'), async (req, res) => {
  const id = validId(req.params.id);
  const row = id ? cameraById(id) : null;
  if (!row) {
    sendError(res, 404, 'CAMERA_NOT_FOUND', 'ไม่พบกล้องนี้');
    return;
  }
  const enabled = !Boolean(row.is_enabled);
  const checked = enabled
    ? await probeRtsp(decryptRtspUrl(row.rtsp_url_enc))
    : { streamStatus: 'offline', lastError: 'กล้องถูกปิดใช้งาน' };
  const lastSeenAt = checked.streamStatus === 'online' ? new Date().toISOString() : row.last_seen_at;
  db.prepare(
    `UPDATE cameras SET is_enabled = ?, stream_status = ?, last_error = ?, last_seen_at = ?,
       updated_at = datetime('now', '+7 hours')
     WHERE id = ?`,
  ).run(enabled ? 1 : 0, checked.streamStatus, checked.lastError, lastSeenAt, id);
  res.json({ camera: cameraFromRow(cameraById(id)) });
});

router.post('/cameras/:id/recheck', requireCctvPermission('manage_cameras'), async (req, res) => {
  const id = validId(req.params.id);
  const row = id ? cameraById(id) : null;
  if (!row) {
    sendError(res, 404, 'CAMERA_NOT_FOUND', 'ไม่พบกล้องนี้');
    return;
  }
  if (!row.is_enabled) {
    sendError(res, 409, 'CAMERA_DISABLED', 'เปิดใช้งานกล้องก่อนตรวจสอบ');
    return;
  }
  const checked = await probeRtsp(decryptRtspUrl(row.rtsp_url_enc));
  const lastSeenAt = checked.streamStatus === 'online' ? new Date().toISOString() : row.last_seen_at;
  db.prepare(
    `UPDATE cameras SET stream_status = ?, last_error = ?, last_seen_at = ?,
       updated_at = datetime('now', '+7 hours') WHERE id = ?`,
  ).run(checked.streamStatus, checked.lastError, lastSeenAt, id);
  res.json({ camera: cameraFromRow(cameraById(id)) });
});

router.patch('/cameras/:id', requireCctvPermission('manage_cameras'), async (req, res) => {
  const id = validId(req.params.id);
  const row = id ? cameraById(id) : null;
  if (!row) {
    sendError(res, 404, 'CAMERA_NOT_FOUND', 'ไม่พบกล้องนี้');
    return;
  }
  const body = req.body || {};
  const roomLabel = body.roomLabel === undefined ? row.room_label || '' : String(body.roomLabel).trim().slice(0, 120);
  const catName = body.catName === undefined ? row.cat_name || '' : String(body.catName).trim().slice(0, 120);
  const name = String(body.name || '').trim().slice(0, 200)
    || (roomLabel && catName ? `${roomLabel} · ${catName}` : roomLabel || catName || row.name);
  let rtspUrlEnc = row.rtsp_url_enc;
  let fingerprint = row.rtsp_fingerprint;
  let checked = { streamStatus: row.stream_status, lastError: row.last_error };

  if (body.rtspUrl !== undefined) {
    const rtspUrl = typeof body.rtspUrl === 'string' ? body.rtspUrl.trim() : '';
    if (!parseRtspUrl(rtspUrl)) {
      sendError(res, 400, 'INVALID_RTSP_URL', 'กรุณาใส่ที่อยู่ RTSP ที่ถูกต้อง');
      return;
    }
    fingerprint = fingerprintRtspUrl(rtspUrl);
    const duplicate = db.prepare('SELECT id FROM cameras WHERE rtsp_fingerprint = ? AND id != ?').get(fingerprint, id);
    if (duplicate) {
      sendError(res, 409, 'CAMERA_ALREADY_EXISTS', 'ที่อยู่กล้องนี้ถูกเพิ่มแล้ว');
      return;
    }
    rtspUrlEnc = encryptRtspUrl(rtspUrl);
    checked = await probeRtsp(rtspUrl);
  }

  db.prepare(
    `UPDATE cameras SET name = ?, room_label = ?, cat_name = ?, rtsp_url_enc = ?,
       rtsp_fingerprint = ?, stream_status = ?, last_error = ?,
       last_seen_at = CASE WHEN ? = 'online' THEN datetime('now', '+7 hours') ELSE last_seen_at END,
       updated_at = datetime('now', '+7 hours')
     WHERE id = ?`,
  ).run(name, roomLabel, catName, rtspUrlEnc, fingerprint, checked.streamStatus, checked.lastError, checked.streamStatus, id);
  res.json({ camera: cameraFromRow(cameraById(id)) });
});

router.delete('/cameras/:id', requireCctvPermission('manage_cameras'), (req, res) => {
  const id = validId(req.params.id);
  if (!id || !cameraById(id)) {
    sendError(res, 404, 'CAMERA_NOT_FOUND', 'ไม่พบกล้องนี้');
    return;
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('DELETE FROM stream_sessions WHERE camera_id = ?').run(id);
    db.prepare('DELETE FROM camera_grants WHERE camera_id = ?').run(id);
    db.prepare('DELETE FROM petcare_camera_grants WHERE camera_id = ?').run(id);
    db.prepare('DELETE FROM care_logs WHERE camera_id = ?').run(id);
    db.prepare('DELETE FROM cameras WHERE id = ?').run(id);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  res.json({ ok: true });
});

router.patch('/rooms/rename', requireCctvPermission('manage_rooms'), (req, res) => {
  const fromLabel = String(req.body?.fromLabel || '').trim();
  const toLabel = String(req.body?.toLabel || '').trim().slice(0, 120);
  if (!fromLabel || !toLabel) {
    sendError(res, 400, 'INVALID_ROOM_LABEL', 'กรุณาระบุชื่อห้องเดิมและชื่อห้องใหม่');
    return;
  }
  const result = db.prepare(
    `UPDATE cameras SET room_label = ?, updated_at = datetime('now', '+7 hours')
     WHERE room_label = ?`,
  ).run(toLabel, fromLabel);
  res.json({ updated: Number(result.changes) });
});

export default router;
