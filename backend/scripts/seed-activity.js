/**
 * Seed กิจกรรมย้อนหลัง (วันนี้ + 3 วันก่อน) ให้ dashboard ดูมีคนใช้จริง
 *
 * รันจากโฟลเดอร์ backend:
 *   node scripts/seed-activity.js
 *
 * Idempotent: ใช้ id คงที่ขึ้นต้นด้วย seed-act- — มีแล้วจะข้าม ไม่ทับข้อมูลจริง
 * ไม่ใส่รูปใหญ่ (สลิปเป็น JPEG 1×1 พิกเซล)
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import '../src/config/index.js';
import { closePool, getPool, queryAll, queryOne, run, transaction } from '../src/db/mssql.js';
import { migrate as migrateTransport } from '../src/modules/pet-transport/migrate.js';
import { DEFAULT_SERVICE_CATALOG } from '../src/modules/clinic-admin/clinicSettings.js';
import { APPLICATION_STATUS } from '../src/modules/adoption/adoptionConstants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOOKINGS_PATH = path.join(__dirname, '../src/modules/pet-owner/data/bookings.json');
const PETS_PATH = path.join(__dirname, '../src/modules/pet-owner/data/pets.json');

const OWNER_ID = 'owner-seed';
const OWNER_NAME = 'มานี รักสัตว์';
const OWNER_PHONE = '0810001111';
const OWNER_EMAIL = 'owner@petcare.local';
const DRIVER_ID = 'driver-seed';
const FIND_HOME_ID = 'find-home-seed';

/** Tiny 1×1 JPEG — ไม่เก็บไฟล์รูปใหญ่ */
const TINY_SLIP =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEABj8Cf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8hf//Z';

const VETS = [
  { id: 'staff-vet-1', name: 'สพ.ญ.ณัฐชา ใจดี' },
  { id: 'staff-vet-2', name: 'น.สพ.วิทยา รักสัตว์' },
  { id: 'staff-vet-3', name: 'สพ.ญ.พิมพ์ชนก แสนสุข' },
  { id: 'staff-vet-4', name: 'น.สพ.ธนกฤต ใจเย็น' },
];

const HOME_POINT = {
  kind: 'home',
  name: 'บ้านมานี',
  zoneId: '1',
  address: 'คอนโดจตุจักร',
  mapUrl: '',
};
const CLINIC_POINT = {
  kind: 'facility',
  name: 'Pet Care',
  zoneId: '1',
  address: 'จตุจักร',
  refId: 'clinic-1',
};
const HOTEL_POINT = {
  kind: 'facility',
  name: 'PetCare Hotel ลาดยาว',
  zoneId: '2',
  address: 'ลาดยาว',
  refId: 'hotel-1',
};

const counts = {
  clinic: { added: 0, skipped: 0 },
  transport: { added: 0, skipped: 0 },
  trips: { added: 0, skipped: 0 },
  hotel: { added: 0, skipped: 0 },
  payments: { added: 0, skipped: 0 },
  adoption: { added: 0, skipped: 0 },
};

function pad(n) {
  return String(n).padStart(2, '0');
}

function localDateOffset(daysBack) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysBack);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoAt(dateStr, hh, mm, ss = 0) {
  const [y, m, day] = dateStr.split('-').map(Number);
  const d = new Date(y, m - 1, day, hh, mm, ss, 0);
  return d.toISOString();
}

function addDays(dateStr, n) {
  const [y, m, day] = dateStr.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function serviceMeta(code, species) {
  const item = DEFAULT_SERVICE_CATALOG.find((s) => s.code === code) || DEFAULT_SERVICE_CATALOG[0];
  let label = item.label;
  if (species === 'dog' && item.labelDog) label = item.labelDog;
  if (species === 'cat' && item.labelCat) label = item.labelCat;
  const price = item.prices?.[species] ?? item.prices?.dog ?? 0;
  return { label, price };
}

function quoteJson({ fromZoneId, toZoneId, serviceType, total, petIds }) {
  const fareZoneId = fromZoneId === '1' && toZoneId === '1' ? '1' : '2';
  return JSON.stringify({
    fromZoneId,
    toZoneId,
    serviceType,
    trips: 1,
    fareZoneId,
    zoneId: fareZoneId,
    perTrip: total,
    outboundPerTrip: total,
    transportTotal: total,
    otherServicesTotal: 0,
    subtotal: total,
    discount: 0,
    total,
    lines: [{ label: 'ค่าขนส่ง', amount: total }],
    meta: { petIds, seed: 'seed-activity-v1' },
  });
}

async function readJsonArray(filePath) {
  try {
    const raw = JSON.parse(await readFile(filePath, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch (err) {
    if (err?.code === 'ENOENT') return [];
    throw err;
  }
}

async function writeJsonArray(filePath, records) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
}

async function ensurePets() {
  const pets = await readJsonArray(PETS_PATH);
  const mine = pets.filter((p) => p.ownerId === OWNER_ID);
  if (mine.length >= 2) {
    return {
      dog: mine.find((p) => p.species === 'dog') || mine[0],
      cat: mine.find((p) => p.species === 'cat') || mine[1] || mine[0],
    };
  }
  throw new Error('ไม่พบสัตว์เลี้ยงของ owner-seed ใน pets.json — รันแอป/seed ผู้ใช้ก่อน');
}

async function seedClinicDay(dateStr, dayIndex, pets) {
  const plans = [
    {
      n: 1,
      time: '09:00',
      service: 'checkup',
      pet: pets.dog,
      status: dayIndex === 0 ? 'confirmed' : 'completed',
      hh: 8,
      mm: 12 + dayIndex,
    },
    {
      n: 2,
      time: '10:00',
      service: 'vaccine_combo',
      pet: pets.cat,
      status: dayIndex <= 1 ? 'pending' : 'confirmed',
      hh: 9,
      mm: 5 + dayIndex * 3,
    },
    {
      n: 3,
      time: '14:00',
      service: 'triage',
      pet: pets.dog,
      status: dayIndex === 0 ? 'confirmed' : dayIndex === 1 ? 'no_show' : 'completed',
      hh: 11,
      mm: 20 + dayIndex,
    },
    {
      n: 4,
      time: '15:00',
      service: 'deworming',
      pet: pets.cat,
      status: dayIndex === 0 ? 'pending' : dayIndex === 2 ? 'cancel_requested' : 'completed',
      hh: 13,
      mm: 40 + dayIndex,
    },
  ];

  const all = await readJsonArray(BOOKINGS_PATH);
  const byId = new Map(all.map((b) => [b.id, b]));
  let changed = false;

  for (const plan of plans) {
    const id = `seed-act-clinic-${dateStr.replace(/-/g, '')}-${plan.n}`;
    if (byId.has(id)) {
      counts.clinic.skipped += 1;
      continue;
    }
    const vet = VETS[(dayIndex + plan.n) % VETS.length];
    const meta = serviceMeta(plan.service, plan.pet.species);
    const createdAt = isoAt(dateStr, plan.hh, plan.mm, 10 + plan.n);
    const booking = {
      id,
      ownerId: OWNER_ID,
      petId: plan.pet.id,
      petIds: [plan.pet.id],
      petName: plan.pet.name,
      petSpecies: plan.pet.species,
      ownerName: OWNER_NAME,
      ownerPhone: OWNER_PHONE,
      service: plan.service,
      serviceLabel: meta.label,
      date: dateStr,
      time: plan.time,
      vetId: plan.status === 'pending' ? undefined : vet.id,
      vetName: plan.status === 'pending' ? undefined : vet.name,
      note: 'seed-activity-v1 · นัดตัวอย่าง',
      status: plan.status,
      clinicNote: plan.status === 'completed' ? 'ตรวจเรียบร้อย' : '',
      createdAt,
      updatedAt: createdAt,
    };
    if (plan.status === 'cancel_requested') {
      booking.cancelRequest = {
        id: `${id}-cancel`,
        reason: 'ติดธุระด่วน (seed)',
        status: 'pending',
        previousStatus: 'confirmed',
        requestedAt: isoAt(dateStr, 16, 5 + plan.n),
      };
    }
    all.push(booking);
    byId.set(id, booking);
    counts.clinic.added += 1;
    changed = true;
  }

  if (changed) await writeJsonArray(BOOKINGS_PATH, all);
}

async function insertTripIfMissing({
  id,
  bookingId,
  type,
  from,
  to,
  pickupTime,
  dropoffTime,
  status,
  driverId,
  createdAt,
}) {
  const existing = await queryOne('SELECT id FROM dbo.trips WHERE id = ?', [id]);
  if (existing) {
    counts.trips.skipped += 1;
    return false;
  }
  await run(
    `INSERT INTO dbo.trips
      (id, booking_id, type, driver_id, status, from_json, to_json, pickup_time, dropoff_time,
       evidence_pickup_json, evidence_dropoff_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)`,
    [
      id,
      bookingId,
      type,
      driverId || null,
      status,
      JSON.stringify(from),
      JSON.stringify(to),
      pickupTime,
      dropoffTime,
      createdAt,
    ],
  );
  await run(
    'INSERT INTO dbo.trip_status_history (trip_id, status, at, note) VALUES (?, ?, ?, ?)',
    [id, status, createdAt, 'seed-activity-v1'],
  );
  counts.trips.added += 1;
  return true;
}

async function seedTransportDay(dateStr, dayIndex, pets) {
  const scenarios = [
    {
      n: 1,
      // จองรอชำระ
      status: 'awaiting_payment',
      paymentStatus: 'unpaid',
      tripStatus: 'assigned',
      driver: null,
      slip: '',
      cancel: false,
      from: HOME_POINT,
      to: CLINIC_POINT,
      total: 100,
      pet: pets.dog,
      pickupH: 9,
      pickupM: 30 + dayIndex,
    },
    {
      n: 2,
      // สลิปรอตรวจ
      status: 'awaiting_payment',
      paymentStatus: 'owner_confirmed',
      tripStatus: 'assigned',
      driver: null,
      slip: TINY_SLIP,
      cancel: false,
      from: HOME_POINT,
      to: HOTEL_POINT,
      total: 150,
      pet: pets.cat,
      pickupH: 11,
      pickupM: 10 + dayIndex * 2,
    },
    {
      n: 3,
      // paid + ทริปกำลังวิ่ง / เสร็จ
      status: 'paid',
      paymentStatus: 'paid',
      tripStatus: dayIndex === 0 ? 'in_transit' : 'completed',
      driver: DRIVER_ID,
      slip: TINY_SLIP,
      cancel: false,
      from: HOME_POINT,
      to: CLINIC_POINT,
      total: 100,
      pet: pets.dog,
      pickupH: 14,
      pickupM: 15 + dayIndex,
    },
    {
      n: 4,
      // คำขอยกเลิก (เฉพาะบางวัน)
      status: 'cancel_requested',
      paymentStatus: dayIndex % 2 === 0 ? 'paid' : 'unpaid',
      tripStatus: 'assigned',
      driver: DRIVER_ID,
      slip: dayIndex % 2 === 0 ? TINY_SLIP : '',
      cancel: true,
      from: HOME_POINT,
      to: CLINIC_POINT,
      total: 100,
      pet: pets.cat,
      pickupH: 16,
      pickupM: 20 + dayIndex,
    },
  ];

  for (const s of scenarios) {
    if (s.n === 4 && dayIndex === 1) continue; // ไม่ทุกวันต้องมี cancel

    const bookingId = `seed-act-tp-${dateStr.replace(/-/g, '')}-${s.n}`;
    const tripId = `seed-act-trip-${dateStr.replace(/-/g, '')}-${s.n}`;
    const existing = await queryOne('SELECT id FROM dbo.bookings WHERE id = ?', [bookingId]);
    if (existing) {
      counts.transport.skipped += 1;
      const tripExists = await queryOne('SELECT id FROM dbo.trips WHERE id = ?', [tripId]);
      if (tripExists) counts.trips.skipped += 1;
      continue;
    }

    const createdAt = isoAt(dateStr, s.pickupH - 1, s.pickupM, 5 + s.n);
    const pickupTime = isoAt(dateStr, s.pickupH, s.pickupM, 0);
    const dropoffTime = isoAt(dateStr, s.pickupH + 1, (s.pickupM + 15) % 60, 0);
    const quote = quoteJson({
      fromZoneId: s.from.zoneId,
      toZoneId: s.to.zoneId,
      serviceType: 'outbound',
      total: s.total,
      petIds: [s.pet.id],
    });
    const cancelJson = s.cancel
      ? JSON.stringify({
          id: `${bookingId}-cancel`,
          reason: 'เปลี่ยนแผน (seed-activity-v1)',
          status: 'pending',
          requestedAt: isoAt(dateStr, s.pickupH, Math.min(59, s.pickupM + 5)),
          previousStatus: s.paymentStatus === 'paid' ? 'paid' : 'awaiting_payment',
        })
      : null;

    await transaction(async () => {
      await run(
        `INSERT INTO dbo.bookings (
           id, owner_id, owner_name, owner_phone, pet_id, pet_name, pet_species, pet_notes, service_type,
           from_zone_id, to_zone_id, return_from_zone_id, return_to_zone_id, fare_zone_id,
           estimated_quote_json, final_quote_json, status, payment_status, payment_note, payment_slip,
           cancel_request_json, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          bookingId,
          OWNER_ID,
          OWNER_NAME,
          OWNER_PHONE,
          s.pet.id,
          s.pet.name,
          s.pet.species,
          'seed-activity-v1',
          'outbound',
          s.from.zoneId,
          s.to.zoneId,
          s.from.zoneId === '1' && s.to.zoneId === '1' ? '1' : '2',
          quote,
          s.paymentStatus === 'paid' ? quote : null,
          s.status,
          s.paymentStatus,
          '',
          s.slip,
          cancelJson,
          createdAt,
          createdAt,
        ],
      );

      await insertTripIfMissing({
        id: tripId,
        bookingId,
        type: 'pickup',
        from: s.from,
        to: s.to,
        pickupTime,
        dropoffTime,
        status: s.tripStatus,
        driverId: s.driver,
        createdAt,
      });
    });

    counts.transport.added += 1;
  }
}

async function seedHotelDay(dateStr, dayIndex, pets) {
  const stayId = `seed-act-stay-${dateStr.replace(/-/g, '')}-1`;
  const existing = await queryOne('SELECT id FROM dbo.hotel_stays WHERE id = ?', [stayId]);
  if (existing) {
    counts.hotel.skipped += 1;
    return;
  }

  const checkIn = dateStr;
  const checkOut = addDays(dateStr, 2);
  const nights = 2;
  const useDog = dayIndex % 2 === 0;
  const pet = useDog ? pets.dog : pets.cat;
  const roomTypeId = useDog ? 'dog_s' : 'cat_s';
  const pricePerNight = useDog ? 450 : 350;
  const subtotal = pricePerNight * nights;
  const status = dayIndex === 0 ? 'checked_in' : dayIndex >= 3 ? 'waiting' : 'confirmed';
  const createdAt = isoAt(dateStr, 7, 30 + dayIndex, 0);

  await transaction(async () => {
    await run(
      `INSERT INTO dbo.hotel_stays (
        id, owner_id, owner_email, check_in, check_out, nights, status, note,
        subtotal, discount, total_price, promo_applied, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?)`,
      [
        stayId,
        OWNER_ID,
        OWNER_EMAIL,
        checkIn,
        checkOut,
        nights,
        status,
        'seed-activity-v1 · ที่พักตัวอย่าง',
        subtotal,
        subtotal,
        createdAt,
        createdAt,
      ],
    );
    await run(
      `INSERT INTO dbo.hotel_stay_units (
        id, stay_id, room_type_id, units, price_per_night, line_subtotal, pet_ids_json
      ) VALUES (?, ?, ?, 1, ?, ?, ?)`,
      [
        `${stayId}-unit`,
        stayId,
        roomTypeId,
        pricePerNight,
        subtotal,
        JSON.stringify([pet.id]),
      ],
    );
  });
  counts.hotel.added += 1;
}

async function seedPaymentsDay(dateStr, dayIndex) {
  const rows = [
    {
      n: 1,
      kind: 'clinic',
      status: dayIndex === 0 ? 'pending_review' : 'approved',
      total: 450,
      deposit: 150,
      hh: 10,
      mm: 45 + dayIndex,
    },
    {
      n: 2,
      kind: 'hotel',
      status: dayIndex <= 1 ? 'pending_review' : 'approved',
      total: 900,
      deposit: 300,
      hh: 12,
      mm: 5 + dayIndex * 2,
    },
  ];

  for (const row of rows) {
    const id = `seed-act-pay-${dateStr.replace(/-/g, '')}-${row.n}`;
    const existing = await queryOne('SELECT id FROM dbo.payments WHERE id = ?', [id]);
    if (existing) {
      counts.payments.skipped += 1;
      continue;
    }
    const createdAt = isoAt(dateStr, row.hh, row.mm, 0);
    const payment = {
      id,
      ownerId: OWNER_ID,
      kind: row.kind,
      refId: `seed-act-ref-${dateStr.replace(/-/g, '')}-${row.n}`,
      total: row.total,
      deposit: row.deposit,
      status: row.status,
      slip: row.status === 'awaiting_slip' ? '' : TINY_SLIP,
      note: row.status === 'approved' ? 'อนุมัติแล้ว (seed)' : '',
      createdAt,
      submittedAt: row.status === 'awaiting_slip' ? '' : createdAt,
      reviewedAt: row.status === 'approved' ? isoAt(dateStr, row.hh + 1, row.mm, 0) : '',
      seedTag: 'seed-activity-v1',
    };
    await run(
      `INSERT INTO dbo.payments (id, owner_id, kind, ref_id, status, created_at, data)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, OWNER_ID, row.kind, payment.refId, row.status, createdAt, JSON.stringify(payment)],
    );
    counts.payments.added += 1;
  }
}

async function seedAdoption(days) {
  const animals = await queryOne(
    `SELECT TOP 1 id FROM dbo.adoption_animals
     WHERE status IN ('published', 'has_interest') AND id LIKE 'adopt-seed-%'
     ORDER BY id`,
  );
  if (!animals?.id) {
    console.warn('⚠ ไม่พบสัตว์ adoption seed — ข้ามคำร้องหาบ้าน');
    return;
  }

  // 2 คำร้องกระจายวัน: วันนี้ + 2 วันก่อน
  const targets = [
    { dayIndex: 0, n: 1, status: APPLICATION_STATUS.submitted, animalOffset: 0 },
    { dayIndex: 2, n: 1, status: APPLICATION_STATUS.reviewing, animalOffset: 1 },
  ];

  const animalRows = await queryAll(
    `SELECT id, status FROM dbo.adoption_animals
     WHERE status IN ('published', 'has_interest') AND id LIKE 'adopt-seed-%'
     ORDER BY id`,
  );

  for (const t of targets) {
    const dateStr = days[t.dayIndex];
    const id = `seed-act-app-${dateStr.replace(/-/g, '')}-${t.n}`;
    const existing = await queryOne('SELECT id FROM dbo.adoption_applications WHERE id = ?', [id]);
    if (existing) {
      counts.adoption.skipped += 1;
      continue;
    }
    const animal = animalRows[t.animalOffset % animalRows.length];
    if (!animal) continue;
    const createdAt = isoAt(dateStr, 15, 10 + t.dayIndex, 0);
    const data = {
      fullName: 'ผู้ใช้ หาบ้าน',
      phone: '0810002222',
      address: 'กรุงเทพฯ',
      reason: 'อยากรับเลี้ยงดูแลอย่างดี (seed-activity-v1)',
      experience: 'เคยเลี้ยงแมว/สุนัข',
      livingSituation: 'คอนโดอนุญาตสัตว์',
      statusLog: [
        { action: 'submitted', by: FIND_HOME_ID, status: APPLICATION_STATUS.submitted, at: createdAt },
      ],
      seedTag: 'seed-activity-v1',
    };
    if (t.status === APPLICATION_STATUS.reviewing) {
      data.statusLog.push({
        action: 'status',
        by: 'adoption-staff-seed',
        status: APPLICATION_STATUS.reviewing,
        at: isoAt(dateStr, 16, 0, 0),
      });
    }
    await run(
      `INSERT INTO dbo.adoption_applications
        (id, animal_id, applicant_user_id, status, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, animal.id, FIND_HOME_ID, t.status, JSON.stringify(data), createdAt, createdAt],
    );
    if (animal.status === 'published') {
      await run(
        `UPDATE dbo.adoption_animals SET status = 'has_interest', updated_at = ? WHERE id = ?`,
        [createdAt, animal.id],
      );
    }
    counts.adoption.added += 1;
  }
}

async function main() {
  console.log('→ seed-activity: เชื่อม MSSQL + migrate ตารางรับส่ง/โรงแรม…');
  await getPool();
  await migrateTransport();

  const pets = await ensurePets();
  const days = [0, 1, 2, 3].map((i) => localDateOffset(i));
  // days[0]=today … days[3]=3 days ago

  console.log(`→ ช่วงวันที่: ${days[3]} → ${days[0]} (วันนี้)`);

  for (let i = 0; i < days.length; i += 1) {
    const dateStr = days[i];
    console.log(`  · ${dateStr}`);
    await seedClinicDay(dateStr, i, pets);
    await seedTransportDay(dateStr, i, pets);
    await seedHotelDay(dateStr, i, pets);
    await seedPaymentsDay(dateStr, i);
  }
  await seedAdoption(days);

  console.log('\nสรุป (added / skipped):');
  for (const [key, c] of Object.entries(counts)) {
    console.log(`  ${key.padEnd(12)} +${c.added}  skip ${c.skipped}`);
  }
  console.log('\nต่อวันโดยประมาณเมื่อรันครั้งแรก:');
  console.log('  คลินิก 4 นัด · รับส่ง ~3–4 จอง (+ทริป) · โรงแรม 1 stay · ชำระ 2 รายการ');
  console.log('  adoption รวม ~2 คำร้องในช่วง 4 วัน');
  console.log('\nเสร็จแล้ว — รีสตาร์ท backend แล้วรีเฟรช dashboard');
}

main()
  .catch((err) => {
    console.error('seed-activity ล้มเหลว:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await closePool();
    } catch {
      /* ignore */
    }
  });
