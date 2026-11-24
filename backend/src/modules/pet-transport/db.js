import { getDb } from '../../db/sqlite.js';
import { DEMO_CLINICS, DEMO_HOTELS, ZONES } from './constants.js';

export function initTransportDb() {
  const db = getDb();
  db.exec(`
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

    CREATE INDEX IF NOT EXISTS idx_trips_booking ON trips(booking_id);
    CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_driver ON notifications(driver_id);
  `);

  seedIfEmpty(db);
  return db;
}

function seedIfEmpty(db) {
  const zoneCount = db.prepare('SELECT COUNT(*) AS c FROM zones').get().c;
  if (zoneCount === 0) {
    const insertZone = db.prepare('INSERT INTO zones (id, label, price) VALUES (?, ?, ?)');
    for (const z of ZONES) insertZone.run(z.id, z.label, z.price);
  }

  const clinicCount = db.prepare('SELECT COUNT(*) AS c FROM clinics').get().c;
  if (clinicCount === 0) {
    const insert = db.prepare(`
      INSERT INTO clinics (id, name, address, district_id, subdistrict_id, zone_id, map_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const c of DEMO_CLINICS) {
      insert.run(c.id, c.name, c.address, c.districtId, c.subdistrictId, c.zoneId, c.mapUrl || null);
    }
  }

  const hotelCount = db.prepare('SELECT COUNT(*) AS c FROM hotels').get().c;
  if (hotelCount === 0) {
    const insert = db.prepare(`
      INSERT INTO hotels (id, name, address, district_id, subdistrict_id, zone_id, map_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const h of DEMO_HOTELS) {
      insert.run(h.id, h.name, h.address, h.districtId, h.subdistrictId, h.zoneId, h.mapUrl || null);
    }
  }
}
