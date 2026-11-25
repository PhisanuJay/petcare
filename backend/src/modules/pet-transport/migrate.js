import { exec, queryAll, queryOne, run } from './db.js';

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

CREATE TABLE IF NOT EXISTS hotel_room_prices (
  room_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  price REAL NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  owner_name TEXT,
  owner_phone TEXT,
  pet_id TEXT,
  pet_name TEXT NOT NULL,
  pet_species TEXT DEFAULT '',
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
  payment_slip TEXT NOT NULL DEFAULT '',
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

export const SEED_HOTEL_ROOM_PRICES = [
  { id: 'standard', label: 'Standard', price: 450, sortOrder: 1 },
  { id: 'deluxe', label: 'Deluxe', price: 750, sortOrder: 2 },
  { id: 'suite', label: 'Suite', price: 1200, sortOrder: 3 },
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

  const hotelPriceCount = queryOne('SELECT COUNT(*) AS c FROM hotel_room_prices')?.c ?? 0;
  if (hotelPriceCount === 0) {
    for (const room of SEED_HOTEL_ROOM_PRICES) {
      run(
        'INSERT INTO hotel_room_prices (room_id, label, price, sort_order) VALUES (?, ?, ?, ?)',
        [room.id, room.label, room.price, room.sortOrder],
      );
    }
  }
}

export function migrate() {
  exec(SCHEMA);
  const bookingColumns = queryAll('PRAGMA table_info(bookings)');
  if (!bookingColumns.some((column) => column.name === 'pet_species')) {
    exec("ALTER TABLE bookings ADD COLUMN pet_species TEXT DEFAULT ''");
  }
  if (!bookingColumns.some((column) => column.name === 'payment_slip')) {
    exec("ALTER TABLE bookings ADD COLUMN payment_slip TEXT NOT NULL DEFAULT ''");
  }
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
  for (const room of SEED_HOTEL_ROOM_PRICES) {
    run(
      `INSERT INTO hotel_room_prices (room_id, label, price, sort_order)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(room_id) DO UPDATE SET
         label = excluded.label,
         price = excluded.price,
         sort_order = excluded.sort_order`,
      [room.id, room.label, room.price, room.sortOrder],
    );
  }
}
