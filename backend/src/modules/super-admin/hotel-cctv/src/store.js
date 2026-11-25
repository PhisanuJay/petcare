const bcrypt = require('bcryptjs');
const { query, transaction } = require('./db');
const { HttpError } = require('./errors');
const { encryptString, decryptString, sha256, randomToken } = require('./security/crypto');
const { isGrantActive, isSessionUsable } = require('./security/access');
const {
  ALL_PERMISSIONS,
  DEFAULT_STAFF_PERMISSIONS,
  normalizePermissions,
  permissionsFromRow,
} = require('./permissions');

const CAMERA_FIELDS = `id, name, description, room_label, cat_name, is_enabled, stream_status, last_error, last_seen_at, updated_at`;

function localToSql(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || '');
  if (!match) throw new HttpError(400, 'BAD_INPUT', 'รูปแบบวันเวลาไม่ถูกต้อง');
  return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:00`;
}

async function findUserByEmail(email) {
  const [rows] = await query(
    'SELECT id, email, password_hash, role, display_name, is_active FROM users WHERE email = ?',
    [email],
  );
  return rows[0] || null;
}

async function findAdminUser() {
  const [rows] = await query(
    "SELECT id, email, password_hash, role, display_name, is_active FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1",
  );
  return rows[0] || null;
}

async function setUserPassword(id, password) {
  const hash = await bcrypt.hash(password, 10);
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
}

async function findUserById(id) {
  const [rows] = await query(
    'SELECT id, email, role, display_name, is_active FROM users WHERE id = ?',
    [id],
  );
  const user = rows[0] || null;
  if (!user) return null;
  if (user.role === 'admin') {
    user.permissions = { ...ALL_PERMISSIONS };
  } else if (user.role === 'staff') {
    user.permissions = await getStaffPermissions(user.id);
  } else {
    user.permissions = null;
  }
  return user;
}

async function getStaffPermissions(userId) {
  const [rows] = await query('SELECT * FROM staff_permissions WHERE user_id = ?', [userId]);
  return permissionsFromRow(rows[0]);
}

async function saveStaffPermissions(userId, permissions) {
  const perms = normalizePermissions(permissions);
  await query(
    `INSERT INTO staff_permissions (
      user_id, view_cameras, manage_cameras, care_logs, manage_customers,
      manage_grants, manage_rooms, view_logs, view_settings
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      view_cameras = excluded.view_cameras,
      manage_cameras = excluded.manage_cameras,
      care_logs = excluded.care_logs,
      manage_customers = excluded.manage_customers,
      manage_grants = excluded.manage_grants,
      manage_rooms = excluded.manage_rooms,
      view_logs = excluded.view_logs,
      view_settings = excluded.view_settings`,
    [
      userId,
      perms.view_cameras ? 1 : 0,
      perms.manage_cameras ? 1 : 0,
      perms.care_logs ? 1 : 0,
      perms.manage_customers ? 1 : 0,
      perms.manage_grants ? 1 : 0,
      perms.manage_rooms ? 1 : 0,
      perms.view_logs ? 1 : 0,
      perms.view_settings ? 1 : 0,
    ],
  );
  return perms;
}

async function listStaff() {
  const [rows] = await query(
    `SELECT u.id, u.email, u.role, u.display_name, u.is_active,
            p.view_cameras, p.manage_cameras, p.care_logs, p.manage_customers,
            p.manage_grants, p.manage_rooms, p.view_logs, p.view_settings
     FROM users u
     LEFT JOIN staff_permissions p ON p.user_id = u.id
     WHERE u.role = 'staff'
     ORDER BY u.id DESC`,
  );
  return rows.map((row) => ({
    ...row,
    permissions: permissionsFromRow(row),
  }));
}

async function createStaff({ email, password, displayName, permissions }) {
  const user = await createUser({
    email,
    password,
    role: 'staff',
    displayName,
  });
  const perms = await saveStaffPermissions(user.id, permissions || DEFAULT_STAFF_PERMISSIONS);
  return { ...user, permissions: perms };
}

async function updateStaff(id, { displayName, isActive, password, permissions }) {
  const user = await findUserById(id);
  if (!user || user.role !== 'staff') throw new HttpError(404, 'NOT_FOUND', 'ไม่พบพนักงาน');
  if (displayName !== undefined) {
    await query('UPDATE users SET display_name = ? WHERE id = ?', [displayName, id]);
  }
  if (isActive !== undefined) {
    await query('UPDATE users SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id]);
  }
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
  }
  let perms = user.permissions;
  if (permissions) {
    perms = await saveStaffPermissions(id, permissions);
  }
  const next = await findUserById(id);
  return { ...next, permissions: perms || next.permissions };
}

async function hasAnyUser() {
  const [rows] = await query('SELECT id FROM users LIMIT 1');
  return rows.length > 0;
}

async function createUser({ email, password, role, displayName }) {
  const hash = await bcrypt.hash(password, 10);
  try {
    const [result] = await query(
      'INSERT INTO users (email, password_hash, role, display_name) VALUES (?, ?, ?, ?)',
      [email, hash, role, displayName],
    );
    return findUserById(result.insertId);
  } catch (error) {
    if (error && String(error.message).includes('UNIQUE')) {
      throw new HttpError(409, 'CONFLICT', 'อีเมลนี้มีในระบบแล้ว');
    }
    throw error;
  }
}

async function updateCustomer(id, { displayName, isActive, password }) {
  const user = await findUserById(id);
  if (!user || user.role !== 'customer') throw new HttpError(404, 'NOT_FOUND', 'ไม่พบลูกค้า');
  if (displayName !== undefined) {
    await query('UPDATE users SET display_name = ? WHERE id = ?', [displayName, id]);
  }
  if (isActive !== undefined) {
    await query('UPDATE users SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id]);
  }
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
  }
  return findUserById(id);
}

async function updateProfile(id, { displayName, password }) {
  const user = await findUserById(id);
  if (!user) throw new HttpError(404, 'NOT_FOUND', 'ไม่พบบัญชี');
  if (displayName !== undefined) {
    await query('UPDATE users SET display_name = ? WHERE id = ?', [displayName, id]);
  }
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
  }
  return findUserById(id);
}

async function listCustomers() {
  const [rows] = await query(
    "SELECT id, email, role, display_name, is_active FROM users WHERE role = 'customer' ORDER BY id DESC",
  );
  return rows;
}

async function cameraSummary() {
  const [rows] = await query(
    `SELECT
      COUNT(*) AS total,
      SUM(stream_status = 'online') AS online,
      SUM(stream_status = 'offline') AS offline,
      SUM(stream_status = 'connecting') AS connecting
    FROM cameras`,
  );
  const row = rows[0] || {};
  return {
    total: Number(row.total || 0),
    online: Number(row.online || 0),
    offline: Number(row.offline || 0),
    connecting: Number(row.connecting || 0),
  };
}

async function listCameras({ q, status, page, pageSize }) {
  const where = [];
  const params = [];
  if (q) {
    where.push('(name LIKE ? OR room_label LIKE ? OR cat_name LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (status) {
    where.push('stream_status = ?');
    params.push(status);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [countRows] = await query(`SELECT COUNT(*) AS total FROM cameras ${clause}`, params);
  const size = Number(pageSize);
  const offset = (Number(page) - 1) * size;
  if (!Number.isInteger(size) || !Number.isInteger(offset) || size < 1 || size > 100 || offset < 0) {
    throw new HttpError(400, 'BAD_INPUT', 'หน้าข้อมูลไม่ถูกต้อง');
  }
  const [rows] = await query(
    `SELECT ${CAMERA_FIELDS} FROM cameras ${clause} ORDER BY id DESC LIMIT ${size} OFFSET ${offset}`,
    params,
  );
  return { rows, total: Number(countRows[0].total || 0) };
}

async function getCamera(id) {
  const [rows] = await query(`SELECT ${CAMERA_FIELDS} FROM cameras WHERE id = ?`, [id]);
  return rows[0] || null;
}

async function getCameraSecret(id) {
  const [rows] = await query('SELECT id, is_enabled, rtsp_url_enc FROM cameras WHERE id = ?', [id]);
  return rows[0] || null;
}

async function findCameraByFingerprint(fingerprint) {
  if (!fingerprint) return null;
  const [rows] = await query(
    `SELECT ${CAMERA_FIELDS} FROM cameras WHERE rtsp_fingerprint = ? LIMIT 1`,
    [fingerprint],
  );
  return rows[0] || null;
}

async function insertCamera({ name, description, roomLabel, catName, isEnabled, encryptedUrl, fingerprint }) {
  try {
    const [result] = await query(
      `INSERT INTO cameras (name, description, room_label, cat_name, is_enabled, stream_status, rtsp_url_enc, rtsp_fingerprint)
       VALUES (?, ?, ?, ?, ?, 'connecting', ?, ?)`,
      [name, description, roomLabel, catName, isEnabled ? 1 : 0, encryptedUrl, fingerprint || null],
    );
    return result.insertId;
  } catch (error) {
    if (error && String(error.message).includes('UNIQUE')) {
      throw new HttpError(409, 'CONFLICT', 'กล้องที่อยู่นี้มีในระบบแล้ว');
    }
    throw error;
  }
}

async function updateCameraRow(id, fields) {
  const sets = [];
  const params = [];
  for (const [column, value] of Object.entries(fields)) {
    sets.push(`${column} = ?`);
    params.push(value);
  }
  if (!sets.length) return;
  sets.push("updated_at = datetime('now', '+7 hours')");
  params.push(id);
  await query(`UPDATE cameras SET ${sets.join(', ')} WHERE id = ?`, params);
}

async function setCameraStatus(id, status, lastError) {
  await query(
    `UPDATE cameras
     SET stream_status = ?, last_error = ?,
         last_seen_at = CASE WHEN ? = 'online' THEN datetime('now', '+7 hours') ELSE last_seen_at END,
         updated_at = datetime('now', '+7 hours')
     WHERE id = ?`,
    [status, lastError || null, status, id],
  );
}

async function deleteCamera(id) {
  return transaction(() => {
    query('DELETE FROM stream_sessions WHERE camera_id = ?', [id]);
    query('DELETE FROM camera_grants WHERE camera_id = ?', [id]);
    const [result] = query('DELETE FROM cameras WHERE id = ?', [id]);
    return result.affectedRows > 0;
  });
}

async function listEnabledSecrets() {
  const [rows] = await query('SELECT id, rtsp_url_enc FROM cameras WHERE is_enabled = 1');
  return rows;
}

async function listGrants(cameraId) {
  const [rows] = await query(
    `SELECT g.id, g.camera_id, g.user_id, g.pet_name, g.room_label, g.starts_at, g.ends_at, g.revoked_at,
            u.email, u.display_name, u.is_active
     FROM camera_grants g
     JOIN users u ON u.id = g.user_id
     WHERE g.camera_id = ?
     ORDER BY g.id DESC`,
    [cameraId],
  );
  return rows;
}

async function createGrant({ cameraId, userId, petName, roomLabel, startsAt, endsAt }) {
  const user = await findUserById(userId);
  if (!user || user.role !== 'customer' || !user.is_active) {
    throw new HttpError(400, 'BAD_INPUT', 'เลือกบัญชีลูกค้าที่ยังใช้งานอยู่');
  }
  const camera = await getCamera(cameraId);
  if (!camera) throw new HttpError(404, 'NOT_FOUND', 'ไม่พบกล้อง');
  const start = new Date(`${startsAt}:00+07:00`);
  const end = new Date(`${endsAt}:00+07:00`);
  if (!(end > start)) throw new HttpError(400, 'BAD_INPUT', 'วันสิ้นสุดต้องอยู่หลังวันเริ่ม');
  const [result] = await query(
    `INSERT INTO camera_grants (camera_id, user_id, pet_name, room_label, starts_at, ends_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [cameraId, userId, petName, roomLabel, localToSql(startsAt), localToSql(endsAt)],
  );
  return result.insertId;
}

async function revokeGrant(id) {
  const [rows] = await query('SELECT id FROM camera_grants WHERE id = ?', [id]);
  if (!rows.length) throw new HttpError(404, 'NOT_FOUND', 'ไม่พบสิทธิ์นี้');
  await query(
    "UPDATE camera_grants SET revoked_at = datetime('now', '+7 hours') WHERE id = ? AND revoked_at IS NULL",
    [id],
  );
  await query(
    "UPDATE stream_sessions SET revoked_at = datetime('now', '+7 hours') WHERE grant_id = ? AND revoked_at IS NULL",
    [id],
  );
}

async function activeGrantFor(userId, cameraId) {
  const [rows] = await query(
    `SELECT g.id, g.camera_id, g.user_id, g.pet_name, g.room_label, g.starts_at, g.ends_at, g.revoked_at
     FROM camera_grants g
     JOIN users u ON u.id = g.user_id
     JOIN cameras c ON c.id = g.camera_id
     WHERE g.user_id = ? AND g.camera_id = ? AND u.is_active = 1 AND u.role = 'customer'
       AND g.revoked_at IS NULL AND g.starts_at <= datetime('now', '+7 hours') AND g.ends_at > datetime('now', '+7 hours')
     ORDER BY g.ends_at DESC
     LIMIT 1`,
    [userId, cameraId],
  );
  return rows[0] || null;
}

async function listCareToday(cameraId) {
  const [rows] = await query(
    `SELECT c.id, c.kind, c.note, c.logged_at, u.display_name
     FROM care_logs c
     LEFT JOIN users u ON u.id = c.created_by
     WHERE c.camera_id = ?
       AND c.logged_at >= date(datetime('now', '+7 hours'))
       AND c.logged_at < date(datetime('now', '+7 hours'), '+1 day')
     ORDER BY c.logged_at ASC, c.id ASC`,
    [cameraId],
  );
  return rows;
}

async function listAllCameras() {
  const [rows] = await query(`SELECT ${CAMERA_FIELDS} FROM cameras ORDER BY room_label ASC, id ASC`);
  return rows;
}

async function renameRoomLabel(fromLabel, toLabel) {
  const from = String(fromLabel || '').trim();
  const to = String(toLabel || '').trim();
  if (!from) throw new HttpError(400, 'BAD_INPUT', 'ต้องระบุชื่อห้องเดิม');
  if (!to) throw new HttpError(400, 'BAD_INPUT', 'ต้องระบุชื่อห้องใหม่');
  if (from === to) return 0;
  const [result] = await query(
    'UPDATE cameras SET room_label = ?, updated_at = datetime(\'now\', \'+7 hours\') WHERE room_label = ?',
    [to, from],
  );
  return result.affectedRows || 0;
}

async function listAllGrants({ activeOnly = false, limit = 200 } = {}) {
  const size = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const where = activeOnly
    ? `WHERE g.revoked_at IS NULL
         AND g.starts_at <= datetime('now', '+7 hours')
         AND g.ends_at > datetime('now', '+7 hours')`
    : '';
  const [rows] = await query(
    `SELECT g.id, g.camera_id, g.user_id, g.pet_name, g.room_label, g.starts_at, g.ends_at, g.revoked_at, g.created_at,
            u.email, u.display_name, u.is_active AS user_active,
            c.name AS camera_name, c.room_label AS camera_room, c.cat_name AS camera_cat
     FROM camera_grants g
     JOIN users u ON u.id = g.user_id
     JOIN cameras c ON c.id = g.camera_id
     ${where}
     ORDER BY g.id DESC
     LIMIT ${size}`,
  );
  return rows;
}

async function listCareLogs({ cameraId, kind, days = 7, limit = 200 } = {}) {
  const size = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const span = Math.min(Math.max(Number(days) || 7, 1), 90);
  const where = [`c.logged_at >= datetime('now', '+7 hours', '-${span} days')`];
  const params = [];
  if (cameraId) {
    where.push('c.camera_id = ?');
    params.push(cameraId);
  }
  if (kind) {
    where.push('c.kind = ?');
    params.push(kind);
  }
  const [rows] = await query(
    `SELECT c.id, c.camera_id, c.kind, c.note, c.logged_at, u.display_name,
            cam.name AS camera_name, cam.room_label, cam.cat_name
     FROM care_logs c
     LEFT JOIN users u ON u.id = c.created_by
     JOIN cameras cam ON cam.id = c.camera_id
     WHERE ${where.join(' AND ')}
     ORDER BY c.logged_at DESC, c.id DESC
     LIMIT ${size}`,
    params,
  );
  return rows;
}

async function listCustomerGrants(userId) {
  const [rows] = await query(
    `SELECT g.id, g.camera_id, g.pet_name, g.room_label, g.starts_at, g.ends_at, g.revoked_at, g.created_at,
            c.name AS camera_name, c.cat_name, c.room_label AS camera_room, c.stream_status, c.is_enabled
     FROM camera_grants g
     JOIN cameras c ON c.id = g.camera_id
     WHERE g.user_id = ?
     ORDER BY g.starts_at DESC, g.id DESC
     LIMIT 200`,
    [userId],
  );
  return rows;
}

async function addCareLog({ cameraId, kind, note, userId }) {
  const [result] = await query(
    'INSERT INTO care_logs (camera_id, kind, note, created_by) VALUES (?, ?, ?, ?)',
    [cameraId, kind, note || '', userId || null],
  );
  return result.insertId;
}

async function deleteCareLog(cameraId, logId) {
  const [result] = await query(
    `DELETE FROM care_logs
     WHERE id = ? AND camera_id = ?
       AND logged_at >= date(datetime('now', '+7 hours'))
       AND logged_at < date(datetime('now', '+7 hours'), '+1 day')`,
    [logId, cameraId],
  );
  return result.affectedRows > 0;
}

async function listCustomerCameras(userId) {
  const [rows] = await query(
    `SELECT c.id, c.name, c.description, c.room_label, c.cat_name, c.is_enabled, c.stream_status,
            c.last_error, c.last_seen_at, c.updated_at,
            g.id AS grant_id, g.pet_name AS grant_pet_name, g.room_label AS grant_room_label,
            g.starts_at AS grant_starts_at, g.ends_at
     FROM camera_grants g
     JOIN cameras c ON c.id = g.camera_id
     JOIN users u ON u.id = g.user_id
     WHERE g.user_id = ? AND u.is_active = 1
       AND g.revoked_at IS NULL AND g.starts_at <= datetime('now', '+7 hours') AND g.ends_at > datetime('now', '+7 hours')
     ORDER BY g.ends_at DESC, c.id ASC`,
    [userId],
  );
  const seen = new Set();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

async function createStreamSession({ userId, cameraId, grantId, seconds }) {
  const token = randomToken();
  await query(
    `INSERT INTO stream_sessions (user_id, camera_id, grant_id, token_hash, expires_at)
     VALUES (?, ?, ?, ?, datetime('now', '+7 hours', '+' || ? || ' seconds'))`,
    [userId, cameraId, grantId, sha256(token), seconds],
  );
  return token;
}

async function consumeStreamToken({ token, userId, cameraId }) {
  const [rows] = await query(
    `SELECT s.id, s.user_id, s.camera_id, s.grant_id, s.expires_at, s.revoked_at,
            g.user_id AS grant_user_id, g.camera_id AS grant_camera_id, g.starts_at, g.ends_at, g.revoked_at AS grant_revoked_at
     FROM stream_sessions s
     JOIN camera_grants g ON g.id = s.grant_id
     WHERE s.token_hash = ?`,
    [sha256(token)],
  );
  const row = rows[0];
  if (!row) return null;
  const session = row;
  const grant = {
    user_id: row.grant_user_id,
    camera_id: row.grant_camera_id,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    revoked_at: row.grant_revoked_at,
  };
  const now = new Date();
  if (Number(session.user_id) !== Number(userId) || Number(session.camera_id) !== Number(cameraId)) return null;
  if (!isSessionUsable(session, grant, now) || !isGrantActive(grant, now)) return null;
  return session;
}

function sealUrl(url, key) {
  return encryptString(url, key);
}

function openUrl(payload, key) {
  return decryptString(payload, key);
}

module.exports = {
  findUserByEmail,
  findAdminUser,
  setUserPassword,
  findUserById,
  hasAnyUser,
  createUser,
  updateCustomer,
  updateProfile,
  listCustomers,
  listStaff,
  createStaff,
  updateStaff,
  getStaffPermissions,
  saveStaffPermissions,
  cameraSummary,
  listCameras,
  getCamera,
  getCameraSecret,
  findCameraByFingerprint,
  insertCamera,
  updateCameraRow,
  setCameraStatus,
  deleteCamera,
  listEnabledSecrets,
  listGrants,
  createGrant,
  revokeGrant,
  activeGrantFor,
  listCustomerCameras,
  listCareToday,
  listCareLogs,
  addCareLog,
  deleteCareLog,
  listAllCameras,
  renameRoomLabel,
  listAllGrants,
  listCustomerGrants,
  createStreamSession,
  consumeStreamToken,
  sealUrl,
  openUrl,
};
