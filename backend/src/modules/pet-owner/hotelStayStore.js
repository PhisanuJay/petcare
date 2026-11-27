import { randomUUID } from 'node:crypto';
import { queryAll, queryOne, run, transaction } from '../pet-transport/db.js';
import { httpError } from './jsonCollection.js';
import { listHotelRoomCatalog } from './hotelCatalog.js';
import { quoteStayLines, stayNights } from './hotelStayQuote.js';

const ACTIVE_STATUSES = new Set(['waiting', 'checked_in', 'pending', 'confirmed']);

function eachNight(checkIn, checkOut) {
  const nights = [];
  const cursor = new Date(`${checkIn}T00:00:00`);
  const end = new Date(`${checkOut}T00:00:00`);
  while (cursor < end) {
    nights.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return nights;
}

function petHotelSpecies(species) {
  return species === 'dog' ? 'dog' : 'cat';
}

function parsePetIds(json) {
  try {
    const ids = JSON.parse(json);
    return Array.isArray(ids) ? ids.map(String) : [];
  } catch {
    return [];
  }
}

function mapStayRow(row, units) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerEmail: row.owner_email,
    checkIn: row.check_in,
    checkOut: row.check_out,
    nights: Number(row.nights),
    status: row.status,
    note: row.note,
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    total: Number(row.total_price),
    totalPrice: Number(row.total_price),
    promoApplied: Boolean(row.promo_applied),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lines: units.map((unit) => ({
      id: unit.id,
      roomTypeId: unit.room_type_id,
      units: Number(unit.units),
      pricePerNight: Number(unit.price_per_night),
      lineSubtotal: Number(unit.line_subtotal),
      petIds: parsePetIds(unit.pet_ids_json),
    })),
  };
}

export async function getHotelAvailability(checkIn, checkOut) {
  if (!checkIn || !checkOut || checkOut <= checkIn) {
    throw httpError(400, 'วันเข้าพักไม่ถูกต้อง');
  }
  const catalog = await listHotelRoomCatalog();
  const nights = eachNight(checkIn, checkOut);
  const stays = await queryAll(
    `SELECT id, check_in, check_out, status FROM dbo.hotel_stays
     WHERE status NOT IN ('cancelled', 'cancel_requested')
       AND check_in < ? AND check_out > ?`,
    [checkOut, checkIn],
  );
  const stayIds = stays.map((s) => s.id);
  let unitsRows = [];
  if (stayIds.length) {
    const placeholders = stayIds.map(() => '?').join(',');
    unitsRows = await queryAll(
      `SELECT stay_id, room_type_id, units FROM dbo.hotel_stay_units WHERE stay_id IN (${placeholders})`,
      stayIds,
    );
  }
  const unitsByStay = new Map();
  unitsRows.forEach((row) => {
    if (!unitsByStay.has(row.stay_id)) unitsByStay.set(row.stay_id, []);
    unitsByStay.get(row.stay_id).push(row);
  });

  const usedByTypeNight = new Map();
  nights.forEach((night) => {
    catalog.forEach((type) => {
      usedByTypeNight.set(`${type.id}:${night}`, 0);
    });
  });

  stays.forEach((stay) => {
    const stayNights = eachNight(stay.check_in, stay.check_out);
    const units = unitsByStay.get(stay.id) || [];
    stayNights.forEach((night) => {
      if (!nights.includes(night)) return;
      units.forEach((u) => {
        const key = `${u.room_type_id}:${night}`;
        usedByTypeNight.set(key, (usedByTypeNight.get(key) || 0) + Number(u.units));
      });
    });
  });

  return catalog.map((type) => {
    let minAvailable = type.totalUnits;
    nights.forEach((night) => {
      const used = usedByTypeNight.get(`${type.id}:${night}`) || 0;
      minAvailable = Math.min(minAvailable, Math.max(0, type.totalUnits - used));
    });
    return {
      roomTypeId: type.id,
      species: type.species,
      minAvailable,
      totalUnits: type.totalUnits,
    };
  });
}

export async function listStaysForOwner(ownerId) {
  const rows = await queryAll(
    'SELECT * FROM dbo.hotel_stays WHERE owner_id = ? ORDER BY created_at DESC',
    [ownerId],
  );
  const result = [];
  for (const row of rows) {
    const units = await queryAll('SELECT * FROM dbo.hotel_stay_units WHERE stay_id = ?', [row.id]);
    result.push(mapStayRow(row, units));
  }
  return result;
}

/** Staff / CCTV desk — every stay with room lines. */
export async function listAllStays() {
  const rows = await queryAll(
    'SELECT * FROM dbo.hotel_stays ORDER BY created_at DESC',
  );
  const result = [];
  for (const row of rows) {
    const units = await queryAll('SELECT * FROM dbo.hotel_stay_units WHERE stay_id = ?', [row.id]);
    result.push(mapStayRow(row, units));
  }
  return result;
}

const STAFF_STAY_STATUSES = new Set([
  'waiting',
  'pending',
  'confirmed',
  'checked_in',
  'checked_out',
  'cancelled',
]);

export async function updateStayStatus(stayId, status) {
  if (!STAFF_STAY_STATUSES.has(status)) {
    throw httpError(400, 'สถานะใบจองไม่ถูกต้อง');
  }
  const row = await queryOne('SELECT id, status FROM dbo.hotel_stays WHERE id = ?', [stayId]);
  if (!row) throw httpError(404, 'ไม่พบใบจองนี้');
  const now = new Date().toISOString();
  await run(
    'UPDATE dbo.hotel_stays SET status = ?, updated_at = ? WHERE id = ?',
    [status, now, stayId],
  );
  const units = await queryAll('SELECT * FROM dbo.hotel_stay_units WHERE stay_id = ?', [stayId]);
  const updated = await queryOne('SELECT * FROM dbo.hotel_stays WHERE id = ?', [stayId]);
  return mapStayRow(updated, units);
}

export async function getStayForOwner(ownerId, stayId) {
  const row = await queryOne(
    'SELECT * FROM dbo.hotel_stays WHERE id = ? AND owner_id = ?',
    [stayId, ownerId],
  );
  if (!row) throw httpError(404, 'ไม่พบการจองนี้');
  const units = await queryAll('SELECT * FROM dbo.hotel_stay_units WHERE stay_id = ?', [stayId]);
  return mapStayRow(row, units);
}

export async function createHotelStay(ownerId, ownerEmail, body, petsById) {
  const { checkIn, checkOut, note = '', lines } = body || {};
  if (!checkIn || !checkOut) throw httpError(400, 'กรุณาเลือกวันเข้าพักและวันรับกลับ');
  const nights = stayNights(checkIn, checkOut);
  if (!nights) throw httpError(400, 'จำนวนคืนไม่ถูกต้อง');
  if (!Array.isArray(lines) || !lines.length) throw httpError(400, 'กรุณาเลือกห้องพัก');

  const catalog = await listHotelRoomCatalog();
  const catalogById = new Map(catalog.map((item) => [item.id, item]));

  const assignedPetIds = new Set();
  lines.forEach((line) => {
    const type = catalogById.get(line.roomTypeId);
    if (!type) throw httpError(400, 'ประเภทห้องไม่ถูกต้อง');
    const units = Math.max(1, Number(line.units) || 1);
    const petIds = Array.isArray(line.petIds) ? line.petIds.map(String) : [];
    if (!petIds.length) throw httpError(400, 'กรุณาระบุสัตว์ในแต่ละห้อง');
    const maxPets = type.maxPetsPerUnit * units;
    if (petIds.length > maxPets) {
      throw httpError(400, `ห้อง ${type.titleTh} รองรับได้ไม่เกิน ${maxPets} ตัว`);
    }
    petIds.forEach((petId) => {
      if (assignedPetIds.has(petId)) throw httpError(400, 'สัตว์เลี้ยงถูกจัดห้องซ้ำ');
      assignedPetIds.add(petId);
      const pet = petsById.get(petId);
      if (!pet) throw httpError(400, 'ไม่พบสัตว์เลี้ยงในรายการ');
      const bucket = petHotelSpecies(pet.species);
      if (type.species !== bucket) {
        throw httpError(400, `${pet.name} ต้องพักในห้อง${bucket === 'dog' ? 'สุนัข' : 'แมว'}`);
      }
    });
  });

  const availability = await getHotelAvailability(checkIn, checkOut);
  const availMap = new Map(availability.map((item) => [item.roomTypeId, item.minAvailable]));
  lines.forEach((line) => {
    const need = Math.max(1, Number(line.units) || 1);
    const left = availMap.get(line.roomTypeId) ?? 0;
    if (need > left) {
      throw httpError(409, 'ห้องที่เลือกเต็มในช่วงวันที่นี้');
    }
  });

  const quote = quoteStayLines({ checkIn, checkOut, lines, catalogById });
  const stayId = randomUUID();
  const now = new Date().toISOString();
  const noteText = String(note || '').trim().slice(0, 500);

  await transaction(async () => {
    const avail2 = await getHotelAvailability(checkIn, checkOut);
    const map2 = new Map(avail2.map((item) => [item.roomTypeId, item.minAvailable]));
    lines.forEach((line) => {
      const need = Math.max(1, Number(line.units) || 1);
      if (need > (map2.get(line.roomTypeId) ?? 0)) {
        throw httpError(409, 'ห้องที่เลือกเต็มในช่วงวันที่นี้');
      }
    });

    await run(
      `INSERT INTO dbo.hotel_stays (
        id, owner_id, owner_email, check_in, check_out, nights, status, note,
        subtotal, discount, total_price, promo_applied, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        stayId, ownerId, ownerEmail || '', checkIn, checkOut, quote.nights, 'waiting',
        noteText, quote.subtotal, quote.discount, quote.total, quote.promoApplied ? 1 : 0, now, now,
      ],
    );

    for (const line of quote.lines) {
      await run(
        `INSERT INTO dbo.hotel_stay_units (
          id, stay_id, room_type_id, units, price_per_night, line_subtotal, pet_ids_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          stayId,
          line.roomTypeId,
          line.units,
          line.pricePerNight,
          line.lineSubtotal,
          JSON.stringify(line.petIds),
        ],
      );
    }
  });

  return getStayForOwner(ownerId, stayId);
}