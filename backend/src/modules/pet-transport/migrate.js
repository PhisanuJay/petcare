import { exec, queryOne, run } from './db.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS zones (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  price REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS clinics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  district_id TEXT,
  subdistrict_id TEXT,
  zone_id TEXT,
  map_url TEXT
);

CREATE TABLE IF NOT EXISTS hotels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  district_id TEXT,
  subdistrict_id TEXT,
  zone_id TEXT,
  map_url TEXT
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  owner_name TEXT,
  owner_phone TEXT,
  pet_id TEXT,
  pet_name TEXT NOT NULL,
  pet_notes TEXT DEFAULT '',
  service_type TEXT NOT NULL,
  from_zone_id TEXT,
  to_zone_id TEXT,
  return_from_zone_id TEXT,
  return_to_zone_id TEXT,
  fare_zone_id TEXT,
  estimated_quote_json TEXT,
  final_quote_json TEXT,
  status TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  payment_note TEXT DEFAULT '',
  cancel_request_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  type TEXT NOT NULL,
  driver_id TEXT,
  status TEXT NOT NULL,
  from_json TEXT NOT NULL,
  to_json TEXT NOT NULL,
  pickup_time TEXT,
  dropoff_time TEXT,
  evidence_pickup_json TEXT,
  evidence_dropoff_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS trip_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id TEXT NOT NULL,
  status TEXT NOT NULL,
  at TEXT NOT NULL,
  note TEXT,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  trip_id TEXT,
  booking_id TEXT,
  dedupe_key TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  booking_id TEXT,
  driver_id TEXT,
  reason_id TEXT,
  message TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trips_booking ON trips(booking_id);
CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_notifications_driver ON notifications(driver_id);
`;

export const SEED_ZONES = [
  { id: '1', label: 'Zone 1', price: 100 },
  { id: '2', label: 'Zone 2', price: 150 },
];

export const SEED_CLINICS = [
  {
    id: 'clinic-1',
    name: 'คลินิกมะแอ่ว',
    address: '99/9 ถนนพหลโยธิน แขวงจตุจักร เขตจตุจักร กรุงเทพฯ 10900',
    district_id: 'chatuchak',
    subdistrict_id: 'chatuchak',
    zone_id: '1',
    map_url: null,
  },
];

export const SEED_HOTELS = [
  {
    id: 'hotel-1',
    name: 'PetCare Hotel ลาดยาว',
    address: '45 ถ.วิภาวดี แขวงลาดยาว',
    district_id: 'chatuchak',
    subdistrict_id: 'latyao',
    zone_id: '2',
    map_url: null,
  },
  {
    id: 'hotel-2',
    name: 'Cat Nest จันทรเกษม',
    address: '12 ถ.ประดิพัทธ์ แขวงจันทรเกษม',
    district_id: 'chatuchak',
    subdistrict_id: 'chantharakasem',
    zone_id: '2',
    map_url: null,
  },
];

function seedCatalogIfEmpty() {
  const zoneCount = queryOne('SELECT COUNT(*) AS c FROM zones')?.c ?? 0;
  if (zoneCount === 0) {
    for (const z of SEED_ZONES) {
      run('INSERT INTO zones (id, label, price) VALUES (?, ?, ?)', [z.id, z.label, z.price]);
    }
  }

  const clinicCount = queryOne('SELECT COUNT(*) AS c FROM clinics')?.c ?? 0;
  if (clinicCount === 0) {
    for (const c of SEED_CLINICS) {
      run(
        `INSERT INTO clinics (id, name, address, district_id, subdistrict_id, zone_id, map_url)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [c.id, c.name, c.address, c.district_id, c.subdistrict_id, c.zone_id, c.map_url],
      );
    }
  }

  const hotelCount = queryOne('SELECT COUNT(*) AS c FROM hotels')?.c ?? 0;
  if (hotelCount === 0) {
    for (const h of SEED_HOTELS) {
      run(
        `INSERT INTO hotels (id, name, address, district_id, subdistrict_id, zone_id, map_url)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [h.id, h.name, h.address, h.district_id, h.subdistrict_id, h.zone_id, h.map_url],
      );
    }
  }
}

export function migrate() {
  exec(SCHEMA);
  seedCatalogIfEmpty();
}

export function reseedsCatalog() {
  for (const z of SEED_ZONES) {
    run(
      `INSERT INTO zones (id, label, price) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET label = excluded.label, price = excluded.price`,
      [z.id, z.label, z.price],
    );
  }
  for (const c of SEED_CLINICS) {
    run(
      `INSERT INTO clinics (id, name, address, district_id, subdistrict_id, zone_id, map_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         address = excluded.address,
         district_id = excluded.district_id,
         subdistrict_id = excluded.subdistrict_id,
         zone_id = excluded.zone_id,
         map_url = excluded.map_url`,
      [c.id, c.name, c.address, c.district_id, c.subdistrict_id, c.zone_id, c.map_url],
    );
  }
  for (const h of SEED_HOTELS) {
    run(
      `INSERT INTO hotels (id, name, address, district_id, subdistrict_id, zone_id, map_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         address = excluded.address,
         district_id = excluded.district_id,
         subdistrict_id = excluded.subdistrict_id,
         zone_id = excluded.zone_id,
         map_url = excluded.map_url`,
      [h.id, h.name, h.address, h.district_id, h.subdistrict_id, h.zone_id, h.map_url],
    );
  }
}
