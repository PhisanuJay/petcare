import '../src/config/index.js';
import { closePool, getPool, queryAll } from '../src/db/mssql.js';

const REQUIRED = [
  'zones', 'clinics', 'hotels', 'hotel_room_prices', 'bookings', 'trips',
  'trip_status_history', 'notifications', 'issues', 'payments', 'cancellations',
  'payment_legacy_imports',
  'users', 'sessions', 'staff_accounts', 'staff_sessions', 'pets', 'owners',
  'clinic_bookings', 'hotel_reservations', 'transport_requests', 'visits',
  'patient_notes', 'clinic_settings', 'clinic_roster', 'adoption_animals',
  'adoption_applications', 'adoption_requests',
  'cctv_users', 'cctv_staff_permissions', 'cctv_cameras', 'cctv_camera_grants',
  'cctv_petcare_camera_grants', 'cctv_stream_sessions', 'cctv_care_logs',
];

await getPool();
const existing = new Set(
  (await queryAll(
    "SELECT TABLE_NAME AS name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='dbo' AND TABLE_TYPE='BASE TABLE'",
  )).map((r) => r.name),
);
const missing = REQUIRED.filter((t) => !existing.has(t));
console.log({ total: existing.size, required: REQUIRED.length, missing });
await closePool();
