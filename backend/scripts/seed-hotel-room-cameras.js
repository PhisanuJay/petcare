/**
 * ให้มีกล้องโรงแรม ~5 ห้อง (หมา A/B · แมว A/B/C) ทั้ง MSSQL + SQLite
 *
 *   node scripts/seed-hotel-room-cameras.js
 */
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

import '../src/config/index.js';
import { closePool, getPool, queryAll, queryOne, run } from '../src/db/mssql.js';
import { migrateCctv } from '../src/modules/super-admin/cctvMigrate.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(moduleDir, '../src/modules/super-admin/.env');
const sqlitePath = path.join(moduleDir, '../src/modules/super-admin/data/cathotel.sqlite');

const ROOMS = [
  { key: 'dog-a', name: 'หมา A · โบ้', roomLabel: 'หมา A', petHint: 'สุนัข', species: 'dog' },
  { key: 'dog-b', name: 'หมา B · มะลิ', roomLabel: 'หมา B', petHint: 'สุนัข', species: 'dog' },
  { key: 'cat-a', name: 'แมว A · มีนา', roomLabel: 'แมว A', petHint: 'แมว', species: 'cat' },
  { key: 'cat-b', name: 'แมว B · นุ่น', roomLabel: 'แมว B', petHint: 'แมว', species: 'cat' },
  { key: 'cat-c', name: 'แมว C · ดาด้า', roomLabel: 'แมว C', petHint: 'แมว', species: 'cat' },
];

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

function encryptRtspUrl(rtspUrl, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(rtspUrl, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

function fingerprint(rtspUrl) {
  return createHash('sha256').update(rtspUrl).digest('hex');
}

function nowIso() {
  return new Date().toISOString();
}

async function main() {
  const secret = readSetting('CAMERA_SECRET');
  if (!/^[\da-f]{64}$/i.test(secret)) {
    throw new Error('CAMERA_SECRET ไม่ถูกต้อง');
  }
  const key = Buffer.from(secret, 'hex');

  await getPool();
  await migrateCctv();

  let addedMssql = 0;
  let updatedMssql = 0;
  let addedSqlite = 0;
  let updatedSqlite = 0;

  const sqlite = new DatabaseSync(sqlitePath);

  for (const room of ROOMS) {
    const rtspUrl = `rtsp://127.0.0.1:8554/hotel-${room.key}`;
    const enc = encryptRtspUrl(rtspUrl, key);
    const fp = fingerprint(rtspUrl);
    const stamp = nowIso();

    const existing = await queryOne(
      'SELECT id FROM dbo.cctv_cameras WHERE rtsp_fingerprint = ? OR (room_label = ? AND name = ?)',
      [fp, room.roomLabel, room.name],
    );

    let cameraId;
    if (existing) {
      await run(
        `UPDATE dbo.cctv_cameras
         SET name = ?, description = ?, room_label = ?, cat_name = ?, is_enabled = 1,
             stream_status = ?, last_error = ?, rtsp_url_enc = ?, rtsp_fingerprint = ?, updated_at = ?
         WHERE id = ?`,
        [
          room.name,
          `กล้องห้อง${room.roomLabel} (seed)`,
          room.roomLabel,
          room.petHint,
          'offline',
          'รอเชื่อมต่อ MediaMTX',
          enc,
          fp,
          stamp,
          existing.id,
        ],
      );
      cameraId = existing.id;
      updatedMssql += 1;
    } else {
      const inserted = await queryOne(
        `INSERT INTO dbo.cctv_cameras
          (name, description, room_label, cat_name, is_enabled, stream_status,
           last_error, last_seen_at, rtsp_url_enc, rtsp_fingerprint, created_at, updated_at)
         OUTPUT INSERTED.id
         VALUES (?, ?, ?, ?, 1, ?, ?, NULL, ?, ?, ?, ?)`,
        [
          room.name,
          `กล้องห้อง${room.roomLabel} (seed)`,
          room.roomLabel,
          room.petHint,
          'offline',
          'รอเชื่อมต่อ MediaMTX',
          enc,
          fp,
          stamp,
          stamp,
        ],
      );
      cameraId = inserted.id;
      addedMssql += 1;
    }

    const sqliteRow = sqlite.prepare(
      'SELECT id FROM cameras WHERE rtsp_fingerprint = ? OR (room_label = ? AND name = ?)',
    ).get(fp, room.roomLabel, room.name);

    if (sqliteRow) {
      sqlite.prepare(
        `UPDATE cameras
         SET name = ?, description = ?, room_label = ?, cat_name = ?, is_enabled = 1,
             stream_status = 'offline', last_error = ?, rtsp_url_enc = ?, rtsp_fingerprint = ?,
             updated_at = datetime('now', '+7 hours')
         WHERE id = ?`,
      ).run(
        room.name,
        `กล้องห้อง${room.roomLabel} (seed)`,
        room.roomLabel,
        room.petHint,
        'รอเชื่อมต่อ MediaMTX',
        enc,
        fp,
        sqliteRow.id,
      );
      updatedSqlite += 1;
    } else {
      sqlite.prepare(
        `INSERT INTO cameras
          (name, description, room_label, cat_name, is_enabled, stream_status, last_error,
           rtsp_url_enc, rtsp_fingerprint, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, 'offline', ?, ?, ?, datetime('now', '+7 hours'), datetime('now', '+7 hours'))`,
      ).run(
        room.name,
        `กล้องห้อง${room.roomLabel} (seed)`,
        room.roomLabel,
        room.petHint,
        'รอเชื่อมต่อ MediaMTX',
        enc,
        fp,
      );
      addedSqlite += 1;
    }

    console.log(`  · ${room.roomLabel} → mssql#${cameraId}`);
  }

  // ปิดชื่อเก่าที่ไม่ใช่ชุด 5 ห้อง (ถ้ายังเป็น A · ฤฤ)
  const legacy = await queryAll(
    `SELECT id, name, room_label FROM dbo.cctv_cameras
     WHERE name = N'A · ฤฤ' OR (room_label = N'A' AND cat_name = N'ฤฤ')`,
  );
  for (const row of legacy) {
    const stillWanted = ROOMS.some((r) => r.name === row.name && r.roomLabel === row.room_label);
    if (stillWanted) continue;
    await run(
      `UPDATE dbo.cctv_cameras
       SET is_enabled = 0, stream_status = N'offline', last_error = N'ถูกแทนด้วยชุดห้องใหม่', updated_at = ?
       WHERE id = ?`,
      [nowIso(), row.id],
    );
    console.log(`  · ปิดกล้องเก่า #${row.id} (${row.name})`);
  }

  sqlite.close();
  console.log(`\nMSSQL +${addedMssql} update ${updatedMssql}`);
  console.log(`SQLite +${addedSqlite} update ${updatedSqlite}`);
  console.log('เสร็จแล้ว — รีเฟรชหน้า CCTV / มอบสิทธิ์');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try { await closePool(); } catch { /* ignore */ }
  });
