/**
 * เพิ่มผู้ใช้หลายบทบาท + กิจกรรมย้อนหลังแบบมีคนใช้จริง
 *
 *   node scripts/seed-live-demo.js
 *
 * Idempotent: id ขึ้นต้น seed-live- / อีเมล demo ที่กำหนด — มีแล้วข้ามหรืออัปเดตเบา ๆ
 */

import { randomBytes, scrypt as scryptCallback, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

import '../src/config/index.js';
import { closePool, getPool, queryAll, queryOne, run, transaction } from '../src/db/mssql.js';
import { migrate as migrateTransport } from '../src/modules/pet-transport/migrate.js';
import { migrateCctv } from '../src/modules/super-admin/cctvMigrate.js';
import { seedRoleUsers } from '../src/modules/auth/seedUsers.js';
import { findUserByEmail, upsertUser } from '../src/modules/auth/usersRepository.js';
import { DEFAULT_SERVICE_CATALOG } from '../src/modules/clinic-admin/clinicSettings.js';
import { syncOwnerWatchGrant } from '../src/modules/super-admin/syncOwnerWatchAccess.js';

const scrypt = promisify(scryptCallback);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PETS_PATH = path.join(__dirname, '../src/modules/pet-owner/data/pets.json');
const BOOKINGS_PATH = path.join(__dirname, '../src/modules/pet-owner/data/bookings.json');

const TINY_SLIP =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEABj8Cf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8hf//Z';

const VETS = [
  { id: 'staff-vet-1', name: 'สพ.ญ.ณัฐชา ใจดี' },
  { id: 'staff-vet-2', name: 'น.สพ.วิทยา รักสัตว์' },
  { id: 'staff-vet-3', name: 'สพ.ญ.พิมพ์ชนก แสนสุข' },
  { id: 'staff-vet-4', name: 'น.สพ.ธนกฤต ใจเย็น' },
];

const EXTRA_USERS = [
  {
    id: 'owner-live-1',
    email: 'somchai@petcare.local',
    password: 'Owner1234',
    role: 'owner',
    firstName: 'สมชาย',
    lastName: 'มีสุข',
    phone: '0812345001',
  },
  {
    id: 'owner-live-2',
    email: 'wanida@petcare.local',
    password: 'Owner1234',
    role: 'owner',
    firstName: 'วนิดา',
    lastName: 'ใจดี',
    phone: '0812345002',
  },
  {
    id: 'owner-live-3',
    email: 'pranee@petcare.local',
    password: 'Owner1234',
    role: 'owner',
    firstName: 'ปราณี',
    lastName: 'สุขใจ',
    phone: '0812345003',
  },
  {
    id: 'owner-live-4',
    email: 'kittipong@petcare.local',
    password: 'Owner1234',
    role: 'owner',
    firstName: 'กิตติพงษ์',
    lastName: 'รักน้อง',
    phone: '0812345004',
  },
  {
    id: 'driver-live-2',
    email: 'driver2@petcare.local',
    password: '1234',
    role: 'driver',
    firstName: 'วิชัย',
    lastName: 'ขับดี',
    phone: '0891112202',
    vehicle: 'รถเก๋ง',
    plateNumber: 'กท 5678',
    licenseNumber: 'DL-22005678',
    licenseExpiry: '2029-06-30',
  },
  {
    id: 'driver-live-3',
    email: 'driver3@petcare.local',
    password: '1234',
    role: 'driver',
    firstName: 'นภา',
    lastName: 'ส่งไว',
    phone: '0891112203',
    vehicle: 'รถตู้',
    plateNumber: 'ขก 9012',
    licenseNumber: 'DL-33009012',
    licenseExpiry: '2028-11-15',
  },
];

const OWNER_PETS = {
  'owner-seed': [
    { id: 'seed-live-pet-ddy', name: 'ดีดี้', species: 'dog', breed: 'ชิวาว่า', sex: 'male', weight: '7' },
    { id: 'seed-live-pet-dda', name: 'ดาด้า', species: 'cat', breed: 'ไทย', sex: 'female', weight: '4' },
  ],
  'owner-live-1': [
    { id: 'seed-live-pet-bo', name: 'โบ้', species: 'dog', breed: 'โกลเด้น', sex: 'male', weight: '28' },
  ],
  'owner-live-2': [
    { id: 'seed-live-pet-mina', name: 'มีนา', species: 'cat', breed: 'เปอร์เซีย', sex: 'female', weight: '5' },
  ],
  'owner-live-3': [
    { id: 'seed-live-pet-mali', name: 'มะลิ', species: 'dog', breed: 'พุดเดิ้ล', sex: 'female', weight: '6' },
    { id: 'seed-live-pet-noon', name: 'นุ่น', species: 'cat', breed: 'สก๊อตติช', sex: 'female', weight: '4.5' },
  ],
  'owner-live-4': [
    { id: 'seed-live-pet-buggy', name: 'บักกี้', species: 'dog', breed: 'ชิบะ', sex: 'male', weight: '10' },
  ],
};

const HOME = {
  kind: 'home',
  name: 'บ้านลูกค้า',
  zoneId: '1',
  address: 'จตุจักร',
  mapUrl: '',
};
const CLINIC = {
  kind: 'facility',
  name: 'Pet Care',
  zoneId: '1',
  address: 'จตุจักร',
  refId: 'clinic-1',
};
const HOTEL = {
  kind: 'facility',
  name: 'PetCare Hotel ลาดยาว',
  zoneId: '2',
  address: 'ลาดยาว',
  refId: 'hotel-1',
};

const counts = {
  users: { added: 0, skipped: 0 },
  pets: { added: 0, skipped: 0 },
  clinic: { added: 0, skipped: 0 },
  transport: { added: 0, skipped: 0 },
  trips: { added: 0, skipped: 0 },
  hotel: { added: 0, skipped: 0 },
  payments: { added: 0, skipped: 0 },
  cctvUsers: { added: 0, skipped: 0 },
  grants: { added: 0, skipped: 0 },
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

function addDays(dateStr, n) {
  const [y, m, day] = dateStr.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoAt(dateStr, hh, mm, ss = 0) {
  const [y, m, day] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, day, hh, mm, ss, 0).toISOString();
}

function stayBoundIso(dateStr, endOfDay = false) {
  const stamp = endOfDay ? `${dateStr}T23:59:59+07:00` : `${dateStr}T00:00:00+07:00`;
  return new Date(stamp).toISOString();
}

async function hashPassword(password, saltHex) {
  return (await scrypt(String(password), saltHex, 64)).toString('hex');
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

function serviceMeta(code, species) {
  const item = DEFAULT_SERVICE_CATALOG.find((s) => s.code === code) || DEFAULT_SERVICE_CATALOG[0];
  let label = item.label;
  if (species === 'dog' && item.labelDog) label = item.labelDog;
  if (species === 'cat' && item.labelCat) label = item.labelCat;
  const price = item.prices?.[species] ?? item.prices?.dog ?? 0;
  return { label, price };
}

function quoteJson({ fromZoneId, toZoneId, total, petIds }) {
  const fareZoneId = fromZoneId === '1' && toZoneId === '1' ? '1' : '2';
  return JSON.stringify({
    fromZoneId,
    toZoneId,
    serviceType: 'outbound',
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
    meta: { petIds, seed: 'seed-live-demo' },
  });
}

async function ensureUsers() {
  await seedRoleUsers();
  for (const seed of EXTRA_USERS) {
    const existing = await findUserByEmail(seed.email);
    if (existing) {
      counts.users.skipped += 1;
      continue;
    }
    const salt = randomBytes(16).toString('hex');
    const passwordHash = await hashPassword(seed.password, salt);
    await upsertUser({
      id: seed.id,
      email: seed.email.toLowerCase(),
      passwordHash,
      salt,
      role: seed.role,
      firstName: seed.firstName,
      lastName: seed.lastName,
      phone: seed.phone || '',
      address: '',
      emergencyName: '',
      emergencyPhone: '',
      avatar: '',
      points: seed.role === 'owner' ? 80 : 0,
      vehicle: seed.vehicle || '',
      plateNumber: seed.plateNumber || '',
      licenseNumber: seed.licenseNumber || '',
      licenseExpiry: seed.licenseExpiry || '',
      active: true,
      createdAt: new Date().toISOString(),
    });
    counts.users.added += 1;
  }
}

async function ensurePets() {
  const pets = await readJsonArray(PETS_PATH);
  const byId = new Map(pets.map((p) => [p.id, p]));
  let changed = false;

  for (const [ownerId, defs] of Object.entries(OWNER_PETS)) {
    for (const def of defs) {
      // reuse existing pet of same owner+name if present (owner-seed already has ดีดี้/ดาด้า)
      const existingSame = pets.find(
        (p) => p.ownerId === ownerId && String(p.name).trim() === def.name,
      );
      if (existingSame || byId.has(def.id)) {
        counts.pets.skipped += 1;
        continue;
      }
      const pet = {
        id: def.id,
        ownerId,
        photo: '',
        name: def.name,
        species: def.species,
        breed: def.breed,
        sex: def.sex,
        birthDate: '2023-05-01',
        weight: def.weight,
        color: '',
        microchip: '',
        neutered: 'yes',
        allergies: '',
        chronicDiseases: '',
        medications: '',
        food: 'อาหารเม็ดประจำ',
        notes: 'seed-live-demo',
        vaccines: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      pets.push(pet);
      byId.set(pet.id, pet);
      counts.pets.added += 1;
      changed = true;
    }
  }

  if (changed) await writeJsonArray(PETS_PATH, pets);

  const owners = {};
  for (const pet of pets) {
    if (!owners[pet.ownerId]) owners[pet.ownerId] = [];
    owners[pet.ownerId].push(pet);
  }
  return owners;
}

function pickDriver(dayIndex, slot) {
  const drivers = ['driver-seed', 'driver-live-2', 'driver-live-3'];
  return drivers[(dayIndex + slot) % drivers.length];
}

async function seedClinicForOwner(owner, pets, dateStr, dayIndex, slot) {
  if (!pets?.length) return;
  const pet = pets[slot % pets.length];
  const services = ['checkup', 'vaccine_combo', 'deworming', 'triage'];
  const service = services[(dayIndex + slot) % services.length];
  const id = `seed-live-clinic-${owner.id.slice(-4)}-${dateStr.replace(/-/g, '')}-${slot}`;
  const all = await readJsonArray(BOOKINGS_PATH);
  if (all.some((b) => b.id === id)) {
    counts.clinic.skipped += 1;
    return;
  }
  const vet = VETS[(dayIndex + slot) % VETS.length];
  const meta = serviceMeta(service, pet.species);
  const statuses = ['completed', 'confirmed', 'pending', 'completed'];
  const status = dayIndex === 0 ? (slot % 2 === 0 ? 'confirmed' : 'pending') : statuses[slot % statuses.length];
  const hour = 9 + (slot % 5);
  const createdAt = isoAt(dateStr, hour - 1, 10 + slot * 7, 0);
  all.push({
    id,
    ownerId: owner.id,
    petId: pet.id,
    petIds: [pet.id],
    petName: pet.name,
    petSpecies: pet.species,
    ownerName: `${owner.firstName} ${owner.lastName}`.trim(),
    ownerPhone: owner.phone,
    service,
    serviceLabel: meta.label,
    date: dateStr,
    time: `${pad(hour)}:00`,
    vetId: status === 'pending' ? undefined : vet.id,
    vetName: status === 'pending' ? undefined : vet.name,
    note: `นัดตรวจ${pet.name} · มาตามนัด`,
    status,
    clinicNote: status === 'completed' ? 'ตรวจปกติ กินข้าวได้ดี' : '',
    createdAt,
    updatedAt: createdAt,
  });
  await writeJsonArray(BOOKINGS_PATH, all);
  counts.clinic.added += 1;
}

async function seedTransportForOwner(owner, pets, dateStr, dayIndex, slot) {
  if (!pets?.length) return;
  const pet = pets[slot % pets.length];
  const bookingId = `seed-live-tp-${owner.id.slice(-4)}-${dateStr.replace(/-/g, '')}-${slot}`;
  const tripId = `seed-live-trip-${owner.id.slice(-4)}-${dateStr.replace(/-/g, '')}-${slot}`;
  if (await queryOne('SELECT id FROM dbo.bookings WHERE id = ?', [bookingId])) {
    counts.transport.skipped += 1;
    return;
  }

  const toHotel = slot % 2 === 1;
  const from = { ...HOME, name: `บ้าน${owner.firstName}`, address: `${owner.firstName} · กรุงเทพฯ` };
  const to = toHotel ? HOTEL : CLINIC;
  const total = toHotel ? 150 : 100;
  const driverId = dayIndex === 0 && slot === 0 ? null : pickDriver(dayIndex, slot);
  const paymentStatus = dayIndex === 0 && slot === 0
    ? 'unpaid'
    : dayIndex === 0 && slot === 1
      ? 'owner_confirmed'
      : 'paid';
  const status = paymentStatus === 'paid' ? 'paid' : 'awaiting_payment';
  const tripStatus = paymentStatus !== 'paid'
    ? 'assigned'
    : dayIndex === 0
      ? (slot % 2 === 0 ? 'in_transit' : 'picked_up')
      : 'completed';
  const pickupH = 10 + slot;
  const createdAt = isoAt(dateStr, pickupH - 1, 20 + slot * 5, 0);
  const pickupTime = isoAt(dateStr, pickupH, 0, 0);
  const dropoffTime = isoAt(dateStr, pickupH + 1, 15, 0);
  const quote = quoteJson({
    fromZoneId: from.zoneId,
    toZoneId: to.zoneId,
    total,
    petIds: [pet.id],
  });

  await transaction(async () => {
    await run(
      `INSERT INTO dbo.bookings (
         id, owner_id, owner_name, owner_phone, pet_id, pet_name, pet_species, pet_notes, service_type,
         from_zone_id, to_zone_id, return_from_zone_id, return_to_zone_id, fare_zone_id,
         estimated_quote_json, final_quote_json, status, payment_status, payment_note, payment_slip,
         cancel_request_json, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
      [
        bookingId,
        owner.id,
        `${owner.firstName} ${owner.lastName}`.trim(),
        owner.phone,
        pet.id,
        pet.name,
        pet.species,
        'ลูกค้านัดรับส่งจริง · seed-live-demo',
        'outbound',
        from.zoneId,
        to.zoneId,
        from.zoneId === '1' && to.zoneId === '1' ? '1' : '2',
        quote,
        paymentStatus === 'paid' ? quote : null,
        status,
        paymentStatus,
        paymentStatus === 'owner_confirmed' ? 'ส่งสลิปแล้ว รอตรวจสอบ' : '',
        paymentStatus === 'unpaid' ? '' : TINY_SLIP,
        createdAt,
        createdAt,
      ],
    );

    if (!(await queryOne('SELECT id FROM dbo.trips WHERE id = ?', [tripId]))) {
      await run(
        `INSERT INTO dbo.trips
          (id, booking_id, type, driver_id, status, from_json, to_json, pickup_time, dropoff_time,
           evidence_pickup_json, evidence_dropoff_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)`,
        [
          tripId,
          bookingId,
          'pickup',
          driverId,
          tripStatus,
          JSON.stringify(from),
          JSON.stringify(to),
          pickupTime,
          dropoffTime,
          createdAt,
        ],
      );
      await run(
        'INSERT INTO dbo.trip_status_history (trip_id, status, at, note) VALUES (?, ?, ?, ?)',
        [tripId, tripStatus, createdAt, `${owner.firstName} · คนขับอัปเดตสถานะ`],
      );
      counts.trips.added += 1;
    } else {
      counts.trips.skipped += 1;
    }
  });
  counts.transport.added += 1;
}

async function seedHotelForOwner(owner, pets, dateStr, dayIndex, slot) {
  if (!pets?.length) return;
  const pet = pets[slot % pets.length];
  const stayId = `seed-live-stay-${owner.id.slice(-4)}-${dateStr.replace(/-/g, '')}-${slot}`;
  if (await queryOne('SELECT id FROM dbo.hotel_stays WHERE id = ?', [stayId])) {
    counts.hotel.skipped += 1;
    return;
  }

  const nights = dayIndex === 0 ? 3 : 2;
  const checkIn = dateStr;
  const checkOut = addDays(dateStr, nights);
  const isDog = pet.species === 'dog';
  const roomTypeId = isDog ? 'dog_s' : 'cat_s';
  const pricePerNight = isDog ? 450 : 350;
  const subtotal = pricePerNight * nights;
  const status = dayIndex === 0
    ? (slot === 0 ? 'checked_in' : 'confirmed')
    : dayIndex === 1
      ? 'confirmed'
      : dayIndex >= 5
        ? 'checked_out'
        : 'waiting';
  const createdAt = isoAt(dateStr, 7, 15 + slot * 11, 0);

  await transaction(async () => {
    await run(
      `INSERT INTO dbo.hotel_stays (
        id, owner_id, owner_email, check_in, check_out, nights, status, note,
        subtotal, discount, total_price, promo_applied, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?)`,
      [
        stayId,
        owner.id,
        owner.email,
        checkIn,
        checkOut,
        nights,
        status,
        `${pet.name} พักโรงแรม · แจ้งแพ้อาหารแล้ว`,
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

async function seedPaymentForOwner(owner, dateStr, dayIndex, slot) {
  const id = `seed-live-pay-${owner.id.slice(-4)}-${dateStr.replace(/-/g, '')}-${slot}`;
  if (await queryOne('SELECT id FROM dbo.payments WHERE id = ?', [id])) {
    counts.payments.skipped += 1;
    return;
  }
  const kind = slot % 2 === 0 ? 'clinic' : 'hotel';
  const status = dayIndex === 0 ? 'pending_review' : 'approved';
  const total = kind === 'clinic' ? 450 + slot * 50 : 900;
  const deposit = Math.round(total * 0.3);
  const createdAt = isoAt(dateStr, 11 + slot, 25, 0);
  const payment = {
    id,
    ownerId: owner.id,
    kind,
    refId: `seed-live-ref-${owner.id.slice(-4)}-${dateStr.replace(/-/g, '')}-${slot}`,
    total,
    deposit,
    status,
    slip: TINY_SLIP,
    note: status === 'approved' ? 'ตรวจสลิปผ่าน' : 'รอแอดมินตรวจสลิป',
    createdAt,
    submittedAt: createdAt,
    reviewedAt: status === 'approved' ? isoAt(dateStr, 12 + slot, 10, 0) : '',
    seedTag: 'seed-live-demo',
  };
  await run(
    `INSERT INTO dbo.payments (id, owner_id, kind, ref_id, status, created_at, data)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, owner.id, kind, payment.refId, status, createdAt, JSON.stringify(payment)],
  );
  counts.payments.added += 1;
}

async function ensureCctvCustomersAndGrants(ownersById, petsByOwner) {
  const cameras = await queryAll(
    'SELECT id, name, room_label, cat_name, rtsp_fingerprint FROM dbo.cctv_cameras WHERE is_enabled = 1 ORDER BY id',
  );
  if (!cameras.length) {
    console.warn('⚠ ยังไม่มีกล้อง — ข้าม CCTV grant');
    return;
  }

  const activeStays = await queryAll(
    `SELECT id, owner_id, owner_email, check_in, check_out, status
     FROM dbo.hotel_stays
     WHERE status IN (N'checked_in', N'confirmed', N'waiting')
       AND (id LIKE N'seed-live-%' OR owner_id LIKE N'owner-live-%' OR owner_id = N'owner-seed')
     ORDER BY check_in DESC`,
  );

  for (const stay of activeStays.slice(0, 8)) {
    const email = String(stay.owner_email || '').trim().toLowerCase();
    const owner = ownersById[stay.owner_id];
    const displayName = owner
      ? `${owner.firstName} ${owner.lastName}`.trim()
      : email;
    let cctvUser = await queryOne(
      `SELECT id FROM dbo.cctv_users WHERE lower(email) = ? AND role = N'customer'`,
      [email],
    );
    if (!cctvUser) {
      const hash = await bcrypt.hash(randomBytes(12).toString('hex'), 10);
      const inserted = await queryOne(
        `INSERT INTO dbo.cctv_users (email, password_hash, role, display_name, is_active, created_at)
         OUTPUT INSERTED.id
         VALUES (?, ?, N'customer', ?, 1, ?)`,
        [email, hash, displayName || email, new Date().toISOString()],
      );
      cctvUser = inserted;
      counts.cctvUsers.added += 1;
    } else {
      counts.cctvUsers.skipped += 1;
    }

    const camera = cameras[Math.abs(String(stay.id).length + Number(stay.owner_id?.length || 0)) % cameras.length];
    const pets = petsByOwner[stay.owner_id] || [];
    const petName = pets[0]?.name || camera.cat_name || 'น้อง';
    const startsAt = stayBoundIso(stay.check_in, false);
    const endsAt = stayBoundIso(stay.check_out, true);

    const existing = await queryOne(
      `SELECT TOP 1 id FROM dbo.cctv_petcare_camera_grants
       WHERE camera_id = ? AND owner_id = ? AND lower(owner_email) = ?
         AND revoked_at IS NULL AND starts_at < ? AND ends_at > ?`,
      [camera.id, stay.owner_id, email, endsAt, startsAt],
    );
    if (existing) {
      await run(
        `UPDATE dbo.cctv_petcare_camera_grants
         SET ends_at = CASE WHEN ends_at < ? THEN ? ELSE ends_at END,
             pet_name = ?, room_label = ?, owner_name = ?
         WHERE id = ?`,
        [endsAt, endsAt, petName, camera.room_label || 'ห้องพัก', displayName, existing.id],
      );
      counts.grants.skipped += 1;
    } else {
      await run(
        `INSERT INTO dbo.cctv_petcare_camera_grants
          (camera_id, owner_id, owner_email, owner_name, pet_name, room_label, starts_at, ends_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          camera.id,
          stay.owner_id,
          email,
          displayName,
          petName,
          camera.room_label || 'ห้องพัก',
          startsAt,
          endsAt,
          new Date().toISOString(),
        ],
      );
      counts.grants.added += 1;
    }

    syncOwnerWatchGrant({
      email,
      displayName,
      cameraId: camera.id,
      rtspFingerprint: camera.rtsp_fingerprint || '',
      petName,
      roomLabel: camera.room_label || 'ห้องพัก',
      startsAt,
      endsAt,
    });
  }
}

async function main() {
  console.log('→ seed-live-demo: ผู้ใช้ + กิจกรรมแบบมีคนใช้จริง');
  await getPool();
  await migrateTransport();
  await migrateCctv();

  await ensureUsers();
  const petsByOwner = await ensurePets();

  const ownerRows = await queryAll(
    `SELECT id, email, first_name, last_name, phone, role
     FROM dbo.users
     WHERE role = N'owner' AND active = 1
       AND (id = N'owner-seed' OR id LIKE N'owner-live-%')
     ORDER BY id`,
  );
  const owners = ownerRows.map((row) => ({
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone || '0800000000',
  }));
  const ownersById = Object.fromEntries(owners.map((o) => [o.id, o]));

  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => localDateOffset(i));
  console.log(`→ ช่วงวันที่: ${days[days.length - 1]} → ${days[0]} (วันนี้) · owners ${owners.length}`);

  for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
    const dateStr = days[dayIndex];
    console.log(`  · ${dateStr}`);
    for (let oi = 0; oi < owners.length; oi += 1) {
      const owner = owners[oi];
      const pets = petsByOwner[owner.id] || [];
      // ไม่ทุกคนจองทุกวัน — กระจายตามวัน/เจ้าของ
      if ((dayIndex + oi) % 2 === 0) {
        await seedClinicForOwner(owner, pets, dateStr, dayIndex, 0);
      }
      if ((dayIndex + oi) % 3 !== 2) {
        await seedTransportForOwner(owner, pets, dateStr, dayIndex, oi % 2);
      }
      if (dayIndex <= 3 && (oi + dayIndex) % 2 === 0) {
        await seedHotelForOwner(owner, pets, dateStr, dayIndex, 0);
      }
      if ((dayIndex + oi) % 2 === 1) {
        await seedPaymentForOwner(owner, dateStr, dayIndex, oi % 2);
      }
    }
  }

  console.log('→ มอบสิทธิ์กล้อง + บัญชี CCTV ลูกค้า…');
  await ensureCctvCustomersAndGrants(ownersById, petsByOwner);

  console.log('\nสรุป (added / skipped):');
  for (const [key, c] of Object.entries(counts)) {
    console.log(`  ${key.padEnd(12)} +${c.added}  skip ${c.skipped}`);
  }
  console.log('\nบัญชีทดลองเพิ่ม:');
  for (const u of EXTRA_USERS) {
    console.log(`  ${u.role.padEnd(8)} ${u.email} / ${u.password}  (${u.firstName} ${u.lastName})`);
  }
  console.log('\nเสร็จแล้ว — รีเฟรช Super Admin / Hotel Admin / Driver');
}

main()
  .catch((err) => {
    console.error('seed-live-demo ล้มเหลว:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await closePool();
    } catch {
      /* ignore */
    }
  });
