import { createJsonCollection } from './jsonCollection.js';
import { queryOne, run } from '../pet-transport/db.js';
import { listHotelRoomCatalog } from './hotelCatalog.js';
import { stayNights } from './hotelStayQuote.js';

const reservations = createJsonCollection('hotel-reservations.json');

function mapStayStatus(reservationStatus) {
  if (reservationStatus === 'cancelled') return 'cancelled';
  if (reservationStatus === 'cancel_requested') return 'cancel_requested';
  return 'waiting';
}

function pickRoomTypeId(roomType, catalog) {
  if (!catalog.length) return null;
  const match = catalog.find((item) => item.id === roomType || item.sizeCode === roomType);
  if (match) return match.id;
  const cat = catalog.find((item) => item.species === 'cat');
  return cat?.id || catalog[0].id;
}

/**
 * One-time import of hotel-reservations.json → dbo.hotel_stays (+ one unit row).
 * Preserves reservation id as stay id when possible.
 */
export async function migrateHotelReservationsFromJson() {
  const all = await reservations.read();
  if (!all.length) return { migrated: 0, skipped: 0 };

  const catalog = await listHotelRoomCatalog();
  let migrated = 0;
  let skipped = 0;

  for (const row of all) {
    const exists = await queryOne('SELECT 1 AS ok FROM dbo.hotel_stays WHERE id = ?', [row.id]);
    if (exists) {
      skipped += 1;
      continue;
    }

    const roomTypeId = pickRoomTypeId(row.roomType, catalog);
    if (!roomTypeId || !row.checkIn || !row.checkOut) {
      skipped += 1;
      continue;
    }

    const nights = Number(row.nights) || stayNights(row.checkIn, row.checkOut) || 1;
    const price = Number(row.pricePerNight) || Number(row.totalPrice) / Math.max(nights, 1) || 0;
    const total = Number(row.totalPrice) || price * nights;
    const note = [
      row.note || '',
      `[นำเข้าจากการจองเก่า ${row.id}]`,
    ].filter(Boolean).join(' ').trim().slice(0, 1000);
    const status = mapStayStatus(row.status);
    const created = row.createdAt || new Date().toISOString();
    const updated = row.updatedAt || created;

    await run(
      `INSERT INTO dbo.hotel_stays (
        id, owner_id, owner_email, check_in, check_out, nights, status, note,
        subtotal, discount, total_price, promo_applied, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.ownerId,
        '',
        row.checkIn,
        row.checkOut,
        nights,
        status,
        note,
        total,
        0,
        total,
        0,
        created,
        updated,
      ],
    );

    const petIds = row.petId ? [row.petId] : [];
    await run(
      `INSERT INTO dbo.hotel_stay_units (
        id, stay_id, room_type_id, units, price_per_night, line_subtotal, pet_ids_json
      ) VALUES (NEWID(), ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        roomTypeId,
        1,
        price,
        total,
        JSON.stringify(petIds),
      ],
    );

    migrated += 1;
  }

  if (migrated > 0) {
    console.log(`[hotel] migrated ${migrated} legacy reservation(s) to hotel_stays (${skipped} skipped)`);
  }

  return { migrated, skipped };
}