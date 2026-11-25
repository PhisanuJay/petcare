/**
 * Copy CCTV rows from cathotel.sqlite into MSSQL dbo.cctv_* tables.
 * Usage: node scripts/migrate-cctv-sqlite-to-mssql.mjs
 */
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../src/config/index.js';
import { closePool, getPool, queryOne, run } from '../src/db/mssql.js';
import { migrateCctv } from '../src/modules/super-admin/cctvMigrate.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sqlitePath = path.join(root, 'src/modules/super-admin/data/cathotel.sqlite');

await getPool();
await migrateCctv();

const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });
const cameraIdMap = new Map();
const userIdMap = new Map();

const userCount = Number((await queryOne('SELECT COUNT(*) AS c FROM dbo.cctv_users'))?.c || 0);
const cameraCount = Number((await queryOne('SELECT COUNT(*) AS c FROM dbo.cctv_cameras'))?.c || 0);

if (userCount <= 1) {
  for (const row of sqlite.prepare('SELECT * FROM users').all()) {
    const existing = await queryOne('SELECT id FROM dbo.cctv_users WHERE email = ?', [row.email]);
    if (existing) {
      userIdMap.set(row.id, existing.id);
      continue;
    }
    const inserted = await queryOne(
      `INSERT INTO dbo.cctv_users (email, password_hash, role, display_name, is_active, created_at)
       OUTPUT INSERTED.id
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        row.email,
        row.password_hash,
        row.role,
        row.display_name || '',
        row.is_active ? 1 : 0,
        row.created_at || new Date().toISOString(),
      ],
    );
    userIdMap.set(row.id, inserted.id);
  }
  console.log('users mapped', Object.fromEntries(userIdMap));
} else {
  for (const row of sqlite.prepare('SELECT id, email FROM users').all()) {
    const existing = await queryOne('SELECT id FROM dbo.cctv_users WHERE email = ?', [row.email]);
    if (existing) userIdMap.set(row.id, existing.id);
  }
  console.log('users already present; mapped', Object.fromEntries(userIdMap));
}

for (const row of sqlite.prepare('SELECT * FROM staff_permissions').all()) {
  const newUserId = userIdMap.get(row.user_id);
  if (!newUserId) continue;
  const exists = await queryOne(
    'SELECT user_id FROM dbo.cctv_staff_permissions WHERE user_id = ?',
    [newUserId],
  );
  if (exists) continue;
  await run(
    `INSERT INTO dbo.cctv_staff_permissions
      (user_id, view_cameras, manage_cameras, care_logs, manage_customers,
       manage_grants, manage_rooms, view_logs, view_settings)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newUserId,
      row.view_cameras ? 1 : 0,
      row.manage_cameras ? 1 : 0,
      row.care_logs ? 1 : 0,
      row.manage_customers ? 1 : 0,
      row.manage_grants ? 1 : 0,
      row.manage_rooms ? 1 : 0,
      row.view_logs ? 1 : 0,
      row.view_settings ? 1 : 0,
    ],
  );
}

if (cameraCount === 0) {
  for (const row of sqlite.prepare('SELECT * FROM cameras').all()) {
    const existing = await queryOne(
      'SELECT id FROM dbo.cctv_cameras WHERE rtsp_fingerprint = ?',
      [row.rtsp_fingerprint],
    );
    if (existing) {
      cameraIdMap.set(row.id, existing.id);
      continue;
    }
    const inserted = await queryOne(
      `INSERT INTO dbo.cctv_cameras
        (name, description, room_label, cat_name, is_enabled, stream_status,
         last_error, last_seen_at, rtsp_url_enc, rtsp_fingerprint, created_at, updated_at)
       OUTPUT INSERTED.id
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.name,
        row.description || '',
        row.room_label || '',
        row.cat_name || '',
        row.is_enabled ? 1 : 0,
        row.stream_status || 'offline',
        row.last_error,
        row.last_seen_at,
        row.rtsp_url_enc,
        row.rtsp_fingerprint,
        row.created_at || new Date().toISOString(),
        row.updated_at || new Date().toISOString(),
      ],
    );
    cameraIdMap.set(row.id, inserted.id);
  }
  console.log('cameras mapped', Object.fromEntries(cameraIdMap));
} else {
  for (const row of sqlite.prepare('SELECT id, rtsp_fingerprint FROM cameras').all()) {
    const existing = await queryOne(
      'SELECT id FROM dbo.cctv_cameras WHERE rtsp_fingerprint = ?',
      [row.rtsp_fingerprint],
    );
    if (existing) cameraIdMap.set(row.id, existing.id);
  }
  console.log('cameras already present; mapped', Object.fromEntries(cameraIdMap));
}

for (const row of sqlite.prepare('SELECT * FROM petcare_camera_grants').all()) {
  const cameraId = cameraIdMap.get(row.camera_id);
  if (!cameraId) continue;
  const exists = await queryOne(
    `SELECT TOP 1 id FROM dbo.cctv_petcare_camera_grants
     WHERE camera_id = ? AND owner_id = ? AND starts_at = ? AND ends_at = ?`,
    [cameraId, row.owner_id, row.starts_at, row.ends_at],
  );
  if (exists) continue;
  await run(
    `INSERT INTO dbo.cctv_petcare_camera_grants
      (camera_id, owner_id, owner_email, owner_name, pet_name, room_label,
       starts_at, ends_at, revoked_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      cameraId,
      row.owner_id,
      row.owner_email,
      row.owner_name,
      row.pet_name,
      row.room_label,
      row.starts_at,
      row.ends_at,
      row.revoked_at,
      row.created_at || new Date().toISOString(),
    ],
  );
}

for (const row of sqlite.prepare('SELECT * FROM camera_grants').all()) {
  const cameraId = cameraIdMap.get(row.camera_id);
  const userId = userIdMap.get(row.user_id);
  if (!cameraId || !userId) continue;
  const exists = await queryOne(
    `SELECT TOP 1 id FROM dbo.cctv_camera_grants
     WHERE camera_id = ? AND user_id = ? AND starts_at = ? AND ends_at = ?`,
    [cameraId, userId, row.starts_at, row.ends_at],
  );
  if (exists) continue;
  await run(
    `INSERT INTO dbo.cctv_camera_grants
      (camera_id, user_id, pet_name, room_label, starts_at, ends_at, revoked_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      cameraId,
      userId,
      row.pet_name,
      row.room_label,
      row.starts_at,
      row.ends_at,
      row.revoked_at,
      row.created_at || new Date().toISOString(),
    ],
  );
}

const counts = {};
for (const table of [
  'cctv_users',
  'cctv_staff_permissions',
  'cctv_cameras',
  'cctv_petcare_camera_grants',
  'cctv_camera_grants',
  'cctv_stream_sessions',
  'cctv_care_logs',
]) {
  counts[table] = Number((await queryOne(`SELECT COUNT(*) AS c FROM dbo.${table}`))?.c || 0);
}
console.log(counts);

sqlite.close();
await closePool();
console.log('done');
