/**
 * Bridge PetCare camera grants (MSSQL) → standalone CatHotel SQLite
 * so owner stay-watch (owner-link + /api/cameras session on :3000) works.
 *
 * Camera IDs may differ after migrate; resolve SQLite camera by id, then
 * rtsp_fingerprint, then unique single-camera fallback.
 */
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';

const sqlitePath = process.env.SQLITE_PATH
  ? path.resolve(process.env.SQLITE_PATH)
  : path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    'data/cathotel.sqlite',
  );

function bangkokSql(isoOrDate) {
  const date = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

function openDb() {
  return new DatabaseSync(sqlitePath);
}

/** Map PetCare/MSSQL camera → SQLite cameras.id used by MediaMTX (cam{N}). */
export function resolveSqliteCameraId(mssqlCameraId, rtspFingerprint = '') {
  let db;
  try {
    db = openDb();
  } catch {
    return null;
  }
  try {
    const id = Number(mssqlCameraId);
    if (Number.isInteger(id) && id > 0) {
      const byId = db.prepare('SELECT id FROM cameras WHERE id = ?').get(id);
      if (byId) return Number(byId.id);
    }
    const fp = String(rtspFingerprint || '').trim();
    if (fp) {
      try {
        const byFp = db.prepare('SELECT id FROM cameras WHERE rtsp_fingerprint = ?').get(fp);
        if (byFp) return Number(byFp.id);
      } catch {
        /* column may be missing on very old sqlite */
      }
    }
    const all = db.prepare('SELECT id FROM cameras ORDER BY id').all();
    if (all.length === 1) return Number(all[0].id);
    return null;
  } finally {
    try { db?.close(); } catch { /* ignore */ }
  }
}

/**
 * Ensure SQLite has a customer user + active camera_grant for streaming.
 * @returns {{ ok: boolean, reason?: string, userId?: number, grantId?: number, streamCameraId?: number }}
 */
export function syncOwnerWatchGrant({
  email,
  displayName = '',
  cameraId,
  rtspFingerprint = '',
  petName = '',
  roomLabel = '',
  startsAt,
  endsAt,
}) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return { ok: false, reason: 'bad_input' };

  const streamCameraId = resolveSqliteCameraId(cameraId, rtspFingerprint);
  if (!streamCameraId) return { ok: false, reason: 'camera_missing_sqlite' };

  const startSql = bangkokSql(startsAt);
  const endSql = bangkokSql(endsAt);
  if (!startSql || !endSql) return { ok: false, reason: 'bad_dates' };

  let db;
  try {
    db = openDb();
  } catch (error) {
    return { ok: false, reason: `sqlite_open:${error.message}` };
  }

  try {
    let user = db.prepare(
      'SELECT id, role, is_active FROM users WHERE lower(email) = ?',
    ).get(normalizedEmail);

    if (!user) {
      const hash = bcrypt.hashSync(randomBytes(16).toString('hex'), 10);
      const name = String(displayName || normalizedEmail.split('@')[0] || 'ลูกค้า').slice(0, 120);
      const result = db.prepare(
        `INSERT INTO users (email, password_hash, role, display_name, is_active)
         VALUES (?, ?, 'customer', ?, 1)`,
      ).run(normalizedEmail, hash, name);
      user = { id: Number(result.lastInsertRowid), role: 'customer', is_active: 1 };
    } else if (user.role !== 'customer') {
      return { ok: false, reason: 'email_not_customer_role' };
    } else if (!user.is_active) {
      db.prepare('UPDATE users SET is_active = 1 WHERE id = ?').run(user.id);
    }

    const existing = db.prepare(
      `SELECT id, starts_at, ends_at FROM camera_grants
       WHERE camera_id = ? AND user_id = ? AND revoked_at IS NULL
         AND starts_at < ? AND ends_at > ?
       ORDER BY id DESC LIMIT 1`,
    ).get(streamCameraId, user.id, endSql, startSql);

    if (existing) {
      const nextStart = existing.starts_at <= startSql ? existing.starts_at : startSql;
      const nextEnd = existing.ends_at >= endSql ? existing.ends_at : endSql;
      db.prepare(
        `UPDATE camera_grants
         SET starts_at = ?, ends_at = ?, pet_name = ?, room_label = ?
         WHERE id = ?`,
      ).run(
        nextStart,
        nextEnd,
        String(petName || '').slice(0, 120),
        String(roomLabel || '').slice(0, 120),
        existing.id,
      );
      return { ok: true, userId: user.id, grantId: existing.id, streamCameraId };
    }

    const inserted = db.prepare(
      `INSERT INTO camera_grants (camera_id, user_id, pet_name, room_label, starts_at, ends_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      streamCameraId,
      user.id,
      String(petName || '').slice(0, 120),
      String(roomLabel || '').slice(0, 120),
      startSql,
      endSql,
    );
    return {
      ok: true,
      userId: user.id,
      grantId: Number(inserted.lastInsertRowid),
      streamCameraId,
    };
  } catch (error) {
    return { ok: false, reason: error.message || 'sync_failed' };
  } finally {
    try { db?.close(); } catch { /* ignore */ }
  }
}

/** Sync every active PetCare grant row for an owner (lazy repair on list/watch). */
export function syncOwnerWatchGrantsForOwner(grants) {
  const results = [];
  for (const grant of grants || []) {
    results.push(syncOwnerWatchGrant({
      email: grant.owner_email || grant.email || grant.ownerEmail,
      displayName: grant.owner_name || grant.display_name || grant.ownerName || '',
      cameraId: grant.camera_id || grant.cameraId || grant.id,
      rtspFingerprint: grant.rtsp_fingerprint || grant.rtspFingerprint || '',
      petName: grant.pet_name || grant.petName || '',
      roomLabel: grant.room_label || grant.roomLabel || '',
      startsAt: grant.starts_at || grant.startsAt,
      endsAt: grant.ends_at || grant.endsAt,
    }));
  }
  return results;
}
