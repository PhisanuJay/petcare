import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import { queryAll, queryOne, run, transaction } from '../../db/mssql.js';
import { findUserById } from '../auth/usersRepository.js';
import { getPetById } from '../pet-owner/store.js';
import { listHotelRoomCatalog } from '../pet-owner/hotelCatalog.js';
import { listAllStays, updateStayStatus } from '../pet-owner/hotelStayStore.js';
import { ensureCctvReady, requireCctvPermission } from './cctvAuth.js';
import cctvAccountsRouter from './cctvAccounts.js';
import { syncOwnerWatchGrant, syncOwnerWatchGrantsForOwner } from './syncOwnerWatchAccess.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(moduleDir, '.env');

function readSetting(name) {
  if (process.env[name]) return process.env[name];
  try {
    const line = readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .find((entry) => entry.trim().startsWith(`${name}=`));
    if (!line) return '';
    return line.slice(line.indexOf('=') + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
  } catch {
    return '';
  }
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

function nowIso() {
  return new Date().toISOString();
}

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

async function readCameras() {
  return queryAll(
    `SELECT id, name, description, room_label, cat_name, is_enabled,
            stream_status, last_error, last_seen_at, created_at, updated_at
     FROM dbo.cctv_cameras ORDER BY id DESC`,
  );
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

async function cameraById(id) {
  return queryOne('SELECT * FROM dbo.cctv_cameras WHERE id = ?', [id]);
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

export async function listGrantedCamerasForOwner(ownerId, email) {
  await ensureCctvReady();
  const normalizedId = String(ownerId || '').trim();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedId || !normalizedEmail) return [];
  const rows = await queryAll(
    `SELECT c.id, c.name, c.description, c.room_label, c.cat_name, c.is_enabled,
            c.stream_status, c.last_error, c.last_seen_at, c.created_at, c.updated_at,
            c.rtsp_fingerprint,
            g.id AS grant_id, g.pet_name, g.room_label AS grant_room_label,
            g.starts_at, g.ends_at
     FROM dbo.cctv_petcare_camera_grants g
     JOIN dbo.cctv_cameras c ON c.id = g.camera_id
     WHERE g.owner_id = ? AND lower(g.owner_email) = ? AND g.revoked_at IS NULL`,
    [normalizedId, normalizedEmail],
  );
  const now = Date.now();
  const active = rows.filter((row) => Date.parse(row.starts_at) <= now && Date.parse(row.ends_at) >= now);
  // Bridge to CatHotel SQLite so Player mode=customer can open a stream session.
  const syncResults = syncOwnerWatchGrantsForOwner(active.map((row) => ({
    owner_email: normalizedEmail,
    owner_name: '',
    camera_id: row.id,
    rtsp_fingerprint: row.rtsp_fingerprint || '',
    pet_name: row.pet_name || row.cat_name || '',
    room_label: row.grant_room_label || row.room_label || '',
    starts_at: row.starts_at,
    ends_at: row.ends_at,
  })));
  return active.map((row, index) => {
    const streamCameraId = syncResults[index]?.streamCameraId || row.id;
    const camera = cameraFromRow(row);
    return {
      ...camera,
      // Player / MediaMTX use the SQLite camera id (may differ from MSSQL after migrate).
      id: streamCameraId,
      petcareCameraId: row.id,
      petName: row.pet_name || row.cat_name || '',
      roomLabel: row.grant_room_label || row.room_label || '',
      accessStartsAt: row.starts_at,
      accessEndsAt: row.ends_at,
      grantId: row.grant_id,
    };
  });
}

const router = Router();

router.use(async (_req, _res, next) => {
  try {
    await ensureCctvReady();
    next();
  } catch (error) {
    next(error);
  }
});

router.use(cctvAccountsRouter);

router.get('/rooms', requireCctvPermission('view_cameras'), async (_req, res) => {
  const groups = new Map();
  for (const row of await readCameras()) {
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

router.get('/cameras', requireCctvPermission('view_cameras'), async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 20));
  const query = String(req.query.q || '').trim().toLowerCase();
  const status = ['online', 'connecting', 'offline'].includes(req.query.status)
    ? req.query.status
    : '';
  let rows = await readCameras();
  if (query) {
    rows = rows.filter((row) => [row.name, row.room_label, row.cat_name]
      .some((value) => String(value || '').toLowerCase().includes(query)));
  }
  if (status) rows = rows.filter((row) => row.stream_status === status);
  const allRows = await readCameras();
  res.json({
    items: rows.slice((page - 1) * pageSize, page * pageSize).map((row) => cameraFromRow(row)),
    total: rows.length,
    page,
    pageSize,
    summary: summarizeCameras(allRows),
  });
});

router.get('/customers', requireCctvPermission('manage_grants'), async (_req, res) => {
  const items = (await queryAll(
    `SELECT id, email, display_name, is_active
     FROM dbo.cctv_users WHERE role = N'customer'
     ORDER BY lower(display_name), lower(email)`,
  )).map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name || row.email,
    isActive: Boolean(row.is_active),
  }));
  res.json({ items });
});

router.get('/grants', requireCctvPermission('manage_grants'), async (req, res) => {
  const rows = await queryAll(
    `SELECT g.id, g.camera_id, g.owner_id, g.pet_name, g.room_label, g.starts_at,
            g.ends_at, g.revoked_at, g.owner_name AS display_name, g.owner_email AS email,
            c.name AS camera_name, c.cat_name AS camera_cat, c.room_label AS camera_room
     FROM dbo.cctv_petcare_camera_grants g
     JOIN dbo.cctv_cameras c ON c.id = g.camera_id
     ORDER BY g.starts_at DESC, g.id DESC`,
  );
  const items = rows.map(grantFromRow);
  res.json({
    items: req.query.active === '1' ? items.filter((item) => item.isActive) : items,
  });
});

router.get('/cameras/:id', requireCctvPermission('manage_cameras'), async (req, res) => {
  const id = validId(req.params.id);
  const row = id ? await cameraById(id) : null;
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
  if (await queryOne('SELECT id FROM dbo.cctv_cameras WHERE rtsp_fingerprint = ?', [fingerprint])) {
    sendError(res, 409, 'CAMERA_ALREADY_EXISTS', 'ที่อยู่กล้องนี้ถูกเพิ่มแล้ว');
    return;
  }

  const checked = body.isEnabled === false
    ? { streamStatus: 'offline', lastError: 'กล้องถูกปิดใช้งาน' }
    : await probeRtsp(rtspUrl);
  const stamp = nowIso();
  const inserted = await queryOne(
    `INSERT INTO dbo.cctv_cameras
      (name, description, room_label, cat_name, is_enabled, stream_status,
       last_error, last_seen_at, rtsp_url_enc, rtsp_fingerprint, created_at, updated_at)
     OUTPUT INSERTED.id
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      String(body.description || '').trim().slice(0, 500),
      roomLabel,
      catName,
      body.isEnabled === false ? 0 : 1,
      checked.streamStatus,
      checked.lastError,
      checked.streamStatus === 'online' ? stamp : null,
      encryptRtspUrl(rtspUrl),
      fingerprint,
      stamp,
      stamp,
    ],
  );
  const row = await cameraById(Number(inserted.id));
  res.status(201).json({ camera: cameraFromRow(row) });
});

router.post('/cameras/:id/grants', requireCctvPermission('manage_grants'), async (req, res) => {
  const cameraId = validId(req.params.id);
  const ownerId = String(req.body?.userId || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const displayName = String(req.body?.displayName || '').trim().slice(0, 200);
  const camera = cameraId ? await cameraById(cameraId) : null;
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
  const stamp = nowIso();
  const inserted = await queryOne(
    `INSERT INTO dbo.cctv_petcare_camera_grants
      (camera_id, owner_id, owner_email, owner_name, pet_name, room_label, starts_at, ends_at, created_at)
     OUTPUT INSERTED.id
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [camera.id, ownerId, email, displayName, petName, roomLabel, startsAt, endsAt, stamp],
  );
  syncOwnerWatchGrant({
    email,
    displayName,
    cameraId: camera.id,
    rtspFingerprint: camera.rtsp_fingerprint || '',
    petName,
    roomLabel,
    startsAt,
    endsAt,
  });
  const row = await queryOne(
    `SELECT g.id, g.camera_id, g.owner_id, g.pet_name, g.room_label, g.starts_at,
            g.ends_at, g.revoked_at, g.owner_name AS display_name, g.owner_email AS email,
            c.name AS camera_name, c.cat_name AS camera_cat, c.room_label AS camera_room
     FROM dbo.cctv_petcare_camera_grants g
     JOIN dbo.cctv_cameras c ON c.id = g.camera_id
     WHERE g.id = ?`,
    [inserted.id],
  );
  res.status(201).json({ grant: grantFromRow(row) });
});

router.delete('/grants/:id', requireCctvPermission('manage_grants'), async (req, res) => {
  const id = validId(req.params.id);
  const grant = id
    ? await queryOne('SELECT id FROM dbo.cctv_petcare_camera_grants WHERE id = ?', [id])
    : null;
  if (!grant) {
    sendError(res, 404, 'GRANT_NOT_FOUND', 'ไม่พบสิทธิ์นี้');
    return;
  }
  await run(
    `UPDATE dbo.cctv_petcare_camera_grants
     SET revoked_at = COALESCE(revoked_at, ?)
     WHERE id = ?`,
    [nowIso(), id],
  );
  res.json({ ok: true });
});

router.patch('/cameras/:id/toggle', requireCctvPermission('manage_cameras'), async (req, res) => {
  const id = validId(req.params.id);
  const row = id ? await cameraById(id) : null;
  if (!row) {
    sendError(res, 404, 'CAMERA_NOT_FOUND', 'ไม่พบกล้องนี้');
    return;
  }
  const enabled = !Boolean(row.is_enabled);
  const checked = enabled
    ? await probeRtsp(decryptRtspUrl(row.rtsp_url_enc))
    : { streamStatus: 'offline', lastError: 'กล้องถูกปิดใช้งาน' };
  const lastSeenAt = checked.streamStatus === 'online' ? nowIso() : row.last_seen_at;
  await run(
    `UPDATE dbo.cctv_cameras SET is_enabled = ?, stream_status = ?, last_error = ?, last_seen_at = ?,
       updated_at = ? WHERE id = ?`,
    [enabled ? 1 : 0, checked.streamStatus, checked.lastError, lastSeenAt, nowIso(), id],
  );
  res.json({ camera: cameraFromRow(await cameraById(id)) });
});

router.post('/cameras/:id/recheck', requireCctvPermission('manage_cameras'), async (req, res) => {
  const id = validId(req.params.id);
  const row = id ? await cameraById(id) : null;
  if (!row) {
    sendError(res, 404, 'CAMERA_NOT_FOUND', 'ไม่พบกล้องนี้');
    return;
  }
  if (!row.is_enabled) {
    sendError(res, 409, 'CAMERA_DISABLED', 'เปิดใช้งานกล้องก่อนตรวจสอบ');
    return;
  }
  const checked = await probeRtsp(decryptRtspUrl(row.rtsp_url_enc));
  const lastSeenAt = checked.streamStatus === 'online' ? nowIso() : row.last_seen_at;
  await run(
    `UPDATE dbo.cctv_cameras SET stream_status = ?, last_error = ?, last_seen_at = ?,
       updated_at = ? WHERE id = ?`,
    [checked.streamStatus, checked.lastError, lastSeenAt, nowIso(), id],
  );
  res.json({ camera: cameraFromRow(await cameraById(id)) });
});

router.patch('/cameras/:id', requireCctvPermission('manage_cameras'), async (req, res) => {
  const id = validId(req.params.id);
  const row = id ? await cameraById(id) : null;
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
  let lastSeenAt = row.last_seen_at;

  if (body.rtspUrl !== undefined) {
    const rtspUrl = typeof body.rtspUrl === 'string' ? body.rtspUrl.trim() : '';
    if (!parseRtspUrl(rtspUrl)) {
      sendError(res, 400, 'INVALID_RTSP_URL', 'กรุณาใส่ที่อยู่ RTSP ที่ถูกต้อง');
      return;
    }
    fingerprint = fingerprintRtspUrl(rtspUrl);
    const duplicate = await queryOne(
      'SELECT id FROM dbo.cctv_cameras WHERE rtsp_fingerprint = ? AND id != ?',
      [fingerprint, id],
    );
    if (duplicate) {
      sendError(res, 409, 'CAMERA_ALREADY_EXISTS', 'ที่อยู่กล้องนี้ถูกเพิ่มแล้ว');
      return;
    }
    rtspUrlEnc = encryptRtspUrl(rtspUrl);
    checked = await probeRtsp(rtspUrl);
    if (checked.streamStatus === 'online') lastSeenAt = nowIso();
  }

  await run(
    `UPDATE dbo.cctv_cameras SET name = ?, room_label = ?, cat_name = ?, rtsp_url_enc = ?,
       rtsp_fingerprint = ?, stream_status = ?, last_error = ?, last_seen_at = ?, updated_at = ?
     WHERE id = ?`,
    [
      name,
      roomLabel,
      catName,
      rtspUrlEnc,
      fingerprint,
      checked.streamStatus,
      checked.lastError,
      lastSeenAt,
      nowIso(),
      id,
    ],
  );
  res.json({ camera: cameraFromRow(await cameraById(id)) });
});

router.delete('/cameras/:id', requireCctvPermission('manage_cameras'), async (req, res) => {
  const id = validId(req.params.id);
  if (!id || !(await cameraById(id))) {
    sendError(res, 404, 'CAMERA_NOT_FOUND', 'ไม่พบกล้องนี้');
    return;
  }
  await transaction(async () => {
    await run('DELETE FROM dbo.cctv_stream_sessions WHERE camera_id = ?', [id]);
    await run('DELETE FROM dbo.cctv_camera_grants WHERE camera_id = ?', [id]);
    await run('DELETE FROM dbo.cctv_petcare_camera_grants WHERE camera_id = ?', [id]);
    await run('DELETE FROM dbo.cctv_care_logs WHERE camera_id = ?', [id]);
    await run('DELETE FROM dbo.cctv_cameras WHERE id = ?', [id]);
  });
  res.json({ ok: true });
});

router.patch('/rooms/rename', requireCctvPermission('manage_rooms'), async (req, res) => {
  const fromLabel = String(req.body?.fromLabel || '').trim();
  const toLabel = String(req.body?.toLabel || '').trim().slice(0, 120);
  if (!fromLabel || !toLabel) {
    sendError(res, 400, 'INVALID_ROOM_LABEL', 'กรุณาระบุชื่อห้องเดิมและชื่อห้องใหม่');
    return;
  }
  const result = await run(
    `UPDATE dbo.cctv_cameras SET room_label = ?, updated_at = ? WHERE room_label = ?`,
    [toLabel, nowIso(), fromLabel],
  );
  res.json({ updated: Number(result.changes) });
});

function stayBoundIso(dateStr, endOfDay = false) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const stamp = endOfDay ? `${dateStr}T23:59:59+07:00` : `${dateStr}T00:00:00+07:00`;
  const date = new Date(stamp);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function enrichStayForDesk(stay, catalogById, grantsByOwner) {
  const owner = stay.ownerId ? await findUserById(stay.ownerId) : null;
  const ownerName = owner
    ? [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim() || owner.email
    : (stay.ownerEmail || 'ลูกค้า');
  const pets = [];
  const rooms = [];
  for (const line of stay.lines || []) {
    const type = catalogById.get(line.roomTypeId);
    rooms.push({
      roomTypeId: line.roomTypeId,
      titleTh: type?.titleTh || line.roomTypeId,
      species: type?.species || '',
      units: line.units,
    });
    for (const petId of line.petIds || []) {
      const pet = await getPetById(petId);
      if (pet) {
        pets.push({
          id: pet.id,
          name: pet.name || 'สัตว์เลี้ยง',
          species: pet.species || '',
          photo: typeof pet.photo === 'string' ? pet.photo : '',
        });
      } else {
        pets.push({ id: petId, name: 'สัตว์เลี้ยง', species: '', photo: '' });
      }
    }
  }
  const uniquePets = [];
  const seen = new Set();
  pets.forEach((pet) => {
    if (seen.has(pet.id)) return;
    seen.add(pet.id);
    uniquePets.push(pet);
  });

  const ownerKey = `${stay.ownerId}::${String(stay.ownerEmail || '').trim().toLowerCase()}`;
  const grants = grantsByOwner.get(ownerKey) || [];
  const startsMs = Date.parse(stayBoundIso(stay.checkIn, false) || '');
  const endsMs = Date.parse(stayBoundIso(stay.checkOut, true) || '');
  const linkedGrants = grants.filter((g) => {
    if (g.revoked_at) return false;
    const gStart = Date.parse(g.starts_at);
    const gEnd = Date.parse(g.ends_at);
    if (Number.isNaN(gStart) || Number.isNaN(gEnd) || Number.isNaN(startsMs) || Number.isNaN(endsMs)) {
      return false;
    }
    return gStart < endsMs && gEnd > startsMs;
  }).map((g) => ({
    id: g.id,
    cameraId: g.camera_id,
    cameraName: g.camera_name,
    roomLabel: g.room_label || g.camera_room || '',
    startsAt: g.starts_at,
    endsAt: g.ends_at,
    isActive: !g.revoked_at && Date.parse(g.starts_at) <= Date.now() && Date.parse(g.ends_at) >= Date.now(),
  }));

  return {
    id: stay.id,
    ownerId: stay.ownerId,
    ownerEmail: stay.ownerEmail,
    ownerName,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    nights: stay.nights,
    status: stay.status,
    note: stay.note || '',
    total: stay.totalPrice ?? stay.total,
    createdAt: stay.createdAt,
    pets: uniquePets,
    rooms,
    petLabel: uniquePets.map((p) => p.name).join(', ') || 'สัตว์เลี้ยง',
    roomLabel: rooms.map((r) => r.titleTh).join(', ') || 'ห้องพัก',
    cameraGranted: linkedGrants.length > 0,
    grants: linkedGrants,
  };
}

async function upsertGrantForStay({
  stay,
  camera,
  startsAt,
  endsAt,
  petName,
  roomLabel,
  ownerName,
}) {
  const email = String(stay.ownerEmail || '').trim().toLowerCase();
  const ownerId = String(stay.ownerId || '').trim();
  const existing = await queryOne(
    `SELECT TOP 1 id, starts_at, ends_at FROM dbo.cctv_petcare_camera_grants
     WHERE camera_id = ? AND owner_id = ? AND lower(owner_email) = ?
       AND revoked_at IS NULL
       AND starts_at < ? AND ends_at > ?
     ORDER BY id DESC`,
    [camera.id, ownerId, email, endsAt, startsAt],
  );

  if (existing) {
    const nextStart = Date.parse(existing.starts_at) <= Date.parse(startsAt)
      ? existing.starts_at
      : startsAt;
    const nextEnd = Date.parse(existing.ends_at) >= Date.parse(endsAt)
      ? existing.ends_at
      : endsAt;
    await run(
      `UPDATE dbo.cctv_petcare_camera_grants
       SET starts_at = ?, ends_at = ?, pet_name = ?, room_label = ?, owner_name = ?
       WHERE id = ?`,
      [nextStart, nextEnd, petName, roomLabel, ownerName, existing.id],
    );
    return existing.id;
  }

  const stamp = nowIso();
  const inserted = await queryOne(
    `INSERT INTO dbo.cctv_petcare_camera_grants
      (camera_id, owner_id, owner_email, owner_name, pet_name, room_label, starts_at, ends_at, created_at)
     OUTPUT INSERTED.id
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [camera.id, ownerId, email, ownerName, petName, roomLabel, startsAt, endsAt, stamp],
  );
  return inserted.id;
}

router.get('/stays', requireCctvPermission('manage_customers'), async (_req, res) => {
  await ensureCctvReady();
  const catalog = await listHotelRoomCatalog();
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  const grantRows = await queryAll(
    `SELECT g.id, g.camera_id, g.owner_id, g.owner_email, g.room_label, g.starts_at, g.ends_at, g.revoked_at,
            c.name AS camera_name, c.room_label AS camera_room
     FROM dbo.cctv_petcare_camera_grants g
     JOIN dbo.cctv_cameras c ON c.id = g.camera_id`,
  );
  const grantsByOwner = new Map();
  grantRows.forEach((row) => {
    const key = `${row.owner_id}::${String(row.owner_email || '').trim().toLowerCase()}`;
    if (!grantsByOwner.has(key)) grantsByOwner.set(key, []);
    grantsByOwner.get(key).push(row);
  });

  const stays = await listAllStays();
  const items = [];
  for (const stay of stays) {
    items.push(await enrichStayForDesk(stay, catalogById, grantsByOwner));
  }
  res.json({
    items,
    summary: {
      total: items.length,
      waiting: items.filter((s) => s.status === 'waiting' || s.status === 'pending').length,
      checkedIn: items.filter((s) => s.status === 'checked_in').length,
      confirmed: items.filter((s) => s.status === 'confirmed').length,
      granted: items.filter((s) => s.cameraGranted).length,
    },
  });
});

router.patch('/stays/:id/status', requireCctvPermission('manage_customers'), async (req, res) => {
  await ensureCctvReady();
  const status = String(req.body?.status || '').trim();
  try {
    const stay = await updateStayStatus(req.params.id, status);
    const catalog = await listHotelRoomCatalog();
    const catalogById = new Map(catalog.map((item) => [item.id, item]));
    const grantRows = await queryAll(
      `SELECT g.id, g.camera_id, g.owner_id, g.owner_email, g.room_label, g.starts_at, g.ends_at, g.revoked_at,
              c.name AS camera_name, c.room_label AS camera_room
       FROM dbo.cctv_petcare_camera_grants g
       JOIN dbo.cctv_cameras c ON c.id = g.camera_id
       WHERE g.owner_id = ? AND lower(g.owner_email) = ?`,
      [stay.ownerId, String(stay.ownerEmail || '').trim().toLowerCase()],
    );
    const grantsByOwner = new Map([
      [`${stay.ownerId}::${String(stay.ownerEmail || '').trim().toLowerCase()}`, grantRows],
    ]);
    const enriched = await enrichStayForDesk(stay, catalogById, grantsByOwner);
    res.json({ stay: enriched });
  } catch (error) {
    sendError(res, error.status || 400, 'STAY_STATUS', error.message || 'อัปเดตสถานะไม่สำเร็จ');
  }
});

router.post('/stays/:id/grants', requireCctvPermission('manage_customers'), async (req, res) => {
  await ensureCctvReady();
  const stayId = String(req.params.id || '').trim();
  const stays = await listAllStays();
  const stay = stays.find((item) => item.id === stayId);
  if (!stay) {
    sendError(res, 404, 'STAY_NOT_FOUND', 'ไม่พบใบจองนี้');
    return;
  }
  if (['cancelled', 'checked_out'].includes(stay.status)) {
    sendError(res, 409, 'STAY_CLOSED', 'ใบจองนี้ปิดแล้ว ไม่สามารถมอบสิทธิ์กล้องได้');
    return;
  }

  const cameraId = validId(req.body?.cameraId);
  const camera = cameraId ? await cameraById(cameraId) : null;
  if (!camera) {
    sendError(res, 404, 'CAMERA_NOT_FOUND', 'ไม่พบกล้องนี้');
    return;
  }

  const defaultStart = stayBoundIso(stay.checkIn, false);
  const defaultEnd = stayBoundIso(stay.checkOut, true);
  const startsAt = parseGrantDate(req.body?.startsAt) || defaultStart;
  const endsAt = parseGrantDate(req.body?.endsAt) || defaultEnd;
  if (!startsAt || !endsAt || Date.parse(startsAt) >= Date.parse(endsAt)) {
    sendError(res, 400, 'INVALID_GRANT_PERIOD', 'กรุณาระบุช่วงเวลาให้ถูกต้อง');
    return;
  }

  const owner = stay.ownerId ? await findUserById(stay.ownerId) : null;
  const ownerName = owner
    ? [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim() || owner.email
    : (stay.ownerEmail || 'ลูกค้า');

  const catalog = await listHotelRoomCatalog();
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  const stayPetIds = (stay.lines || []).flatMap((line) => line.petIds || []);
  const requestedPetIds = Array.isArray(req.body?.petIds)
    ? req.body.petIds.map((id) => String(id || '').trim()).filter(Boolean)
    : [];
  const petIds = requestedPetIds.length
    ? requestedPetIds.filter((id) => stayPetIds.includes(id) || stayPetIds.length === 0)
    : (stayPetIds.length ? stayPetIds : []);

  const pets = petIds.length
    ? await Promise.all(petIds.map(async (petId) => {
      const pet = await getPetById(petId);
      return pet
        ? { id: pet.id, name: pet.name || 'สัตว์เลี้ยง', species: pet.species || '' }
        : { id: petId, name: 'สัตว์เลี้ยง', species: '' };
    }))
    : [{
      id: '',
      name: String(req.body?.petName || camera.cat_name || 'สัตว์เลี้ยง').trim().slice(0, 120),
      species: '',
    }];

  const roomFromStay = stay.lines?.[0]
    ? (catalogById.get(stay.lines[0].roomTypeId)?.titleTh || stay.lines[0].roomTypeId)
    : '';
  const roomLabel = String(
    req.body?.roomLabel || camera.room_label || roomFromStay || '',
  ).trim().slice(0, 120);

  const grants = [];
  for (const pet of pets) {
    const petName = String(pet.name || 'สัตว์เลี้ยง').trim().slice(0, 120);
    const grantId = await upsertGrantForStay({
      stay,
      camera,
      startsAt,
      endsAt,
      petName,
      roomLabel,
      ownerName,
    });
    syncOwnerWatchGrant({
      email: stay.ownerEmail,
      displayName: ownerName,
      cameraId: camera.id,
      rtspFingerprint: camera.rtsp_fingerprint || '',
      petName,
      roomLabel,
      startsAt,
      endsAt,
    });
    const row = await queryOne(
      `SELECT g.id, g.camera_id, g.owner_id, g.pet_name, g.room_label, g.starts_at,
              g.ends_at, g.revoked_at, g.owner_name AS display_name, g.owner_email AS email,
              c.name AS camera_name, c.cat_name AS camera_cat, c.room_label AS camera_room
       FROM dbo.cctv_petcare_camera_grants g
       JOIN dbo.cctv_cameras c ON c.id = g.camera_id
       WHERE g.id = ?`,
      [grantId],
    );
    grants.push(grantFromRow(row));
  }

  res.status(201).json({ grants, grant: grants[0] || null, count: grants.length });
});

export default router;
