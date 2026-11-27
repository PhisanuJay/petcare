/**
 * Seed / ต่ออายุสิทธิ์ดูกล้องให้ owner จากใบจองโรงแรมจริง
 *
 *   node scripts/seed-hotel-cctv-grants.js
 */
import '../src/config/index.js';
import { closePool, getPool, queryAll, queryOne, run } from '../src/db/mssql.js';
import { migrateCctv } from '../src/modules/super-admin/cctvMigrate.js';
import { getPetById } from '../src/modules/pet-owner/store.js';
import { listHotelRoomCatalog } from '../src/modules/pet-owner/hotelCatalog.js';
import { listAllStays } from '../src/modules/pet-owner/hotelStayStore.js';

function stayBoundIso(dateStr, endOfDay = false) {
  const stamp = endOfDay ? `${dateStr}T23:59:59+07:00` : `${dateStr}T00:00:00+07:00`;
  return new Date(stamp).toISOString();
}

async function main() {
  await getPool();
  await migrateCctv();

  const cameras = await queryAll(
    'SELECT id, name, room_label, cat_name FROM dbo.cctv_cameras WHERE is_enabled = 1 ORDER BY id',
  );
  if (!cameras.length) {
    console.warn('⚠ ยังไม่มีกล้อง — ข้าม seed grant');
    return;
  }

  const catalog = await listHotelRoomCatalog();
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  const stays = (await listAllStays()).filter(
    (s) => s.ownerId === 'owner-seed' && !['cancelled', 'checked_out'].includes(s.status),
  );

  let added = 0;
  let updated = 0;

  // ผูก stays ที่ checked_in / confirmed ก่อน แล้วตามด้วย waiting ล่าสุด
  const prioritized = [
    ...stays.filter((s) => s.status === 'checked_in'),
    ...stays.filter((s) => s.status === 'confirmed'),
    ...stays.filter((s) => s.status === 'waiting'),
  ].slice(0, Math.max(2, Math.min(4, cameras.length + 2)));

  for (let i = 0; i < prioritized.length; i += 1) {
    const stay = prioritized[i];
    const camera = cameras[i % cameras.length];
    const startsAt = stayBoundIso(stay.checkIn, false);
    const endsAt = stayBoundIso(stay.checkOut, true);
    const petId = stay.lines?.[0]?.petIds?.[0];
    const pet = petId ? getPetById(petId) : null;
    const petName = pet?.name || camera.cat_name || 'สัตว์เลี้ยง';
    const roomLabel = camera.room_label
      || catalogById.get(stay.lines?.[0]?.roomTypeId)?.titleTh
      || 'ห้องพัก';

    const existing = await queryOne(
      `SELECT TOP 1 id FROM dbo.cctv_petcare_camera_grants
       WHERE camera_id = ? AND owner_id = ? AND lower(owner_email) = ?
         AND revoked_at IS NULL AND starts_at < ? AND ends_at > ?`,
      [camera.id, stay.ownerId, String(stay.ownerEmail || '').toLowerCase(), endsAt, startsAt],
    );

    if (existing) {
      const row = await queryOne(
        'SELECT starts_at, ends_at FROM dbo.cctv_petcare_camera_grants WHERE id = ?',
        [existing.id],
      );
      const nextStart = Date.parse(row.starts_at) <= Date.parse(startsAt) ? row.starts_at : startsAt;
      const nextEnd = Date.parse(row.ends_at) >= Date.parse(endsAt) ? row.ends_at : endsAt;
      await run(
        `UPDATE dbo.cctv_petcare_camera_grants
         SET starts_at = ?, ends_at = ?, pet_name = ?, room_label = ?, owner_name = N'มานี รักสัตว์'
         WHERE id = ?`,
        [nextStart, nextEnd, petName, roomLabel, existing.id],
      );
      updated += 1;
      continue;
    }

    await run(
      `INSERT INTO dbo.cctv_petcare_camera_grants
        (camera_id, owner_id, owner_email, owner_name, pet_name, room_label, starts_at, ends_at, created_at)
       VALUES (?, ?, ?, N'มานี รักสัตว์', ?, ?, ?, ?, ?)`,
      [
        camera.id,
        stay.ownerId,
        String(stay.ownerEmail || '').toLowerCase(),
        petName,
        roomLabel,
        startsAt,
        endsAt,
        new Date().toISOString(),
      ],
    );
    added += 1;
  }

  console.log(`seed-hotel-cctv-grants: +${added} grant, updated ${updated}, stays considered ${prioritized.length}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await closePool();
    } catch {
      /* ignore */
    }
  });
