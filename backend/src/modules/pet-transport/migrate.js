import { exec, queryOne, run } from './db.js';

const SCHEMA = `
IF OBJECT_ID(N'dbo.zones', N'U') IS NULL
CREATE TABLE dbo.zones (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  label NVARCHAR(200) NOT NULL,
  price DECIMAL(18,2) NOT NULL
);

IF OBJECT_ID(N'dbo.clinics', N'U') IS NULL
CREATE TABLE dbo.clinics (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  name NVARCHAR(200) NOT NULL,
  address NVARCHAR(500) NULL,
  district_id NVARCHAR(64) NULL,
  subdistrict_id NVARCHAR(64) NULL,
  zone_id NVARCHAR(64) NULL,
  map_url NVARCHAR(1000) NULL
);

IF OBJECT_ID(N'dbo.hotels', N'U') IS NULL
CREATE TABLE dbo.hotels (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  name NVARCHAR(200) NOT NULL,
  address NVARCHAR(500) NULL,
  district_id NVARCHAR(64) NULL,
  subdistrict_id NVARCHAR(64) NULL,
  zone_id NVARCHAR(64) NULL,
  map_url NVARCHAR(1000) NULL
);

IF OBJECT_ID(N'dbo.hotel_room_prices', N'U') IS NULL
CREATE TABLE dbo.hotel_room_prices (
  room_id NVARCHAR(64) NOT NULL PRIMARY KEY,
  label NVARCHAR(200) NOT NULL,
  price DECIMAL(18,2) NOT NULL,
  sort_order INT NOT NULL
);

IF OBJECT_ID(N'dbo.hotel_room_types', N'U') IS NULL
CREATE TABLE dbo.hotel_room_types (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  species NVARCHAR(16) NOT NULL,
  size_code NVARCHAR(8) NOT NULL,
  title_th NVARCHAR(200) NOT NULL,
  description_th NVARCHAR(1000) NOT NULL CONSTRAINT DF_hotel_room_types_desc DEFAULT (N''),
  image_url NVARCHAR(500) NOT NULL CONSTRAINT DF_hotel_room_types_img DEFAULT (N''),
  max_pets_per_unit INT NOT NULL,
  total_units INT NOT NULL,
  sort_order INT NOT NULL
);

IF OBJECT_ID(N'dbo.hotel_stays', N'U') IS NULL
CREATE TABLE dbo.hotel_stays (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  owner_id NVARCHAR(64) NOT NULL,
  owner_email NVARCHAR(200) NOT NULL CONSTRAINT DF_hotel_stays_email DEFAULT (N''),
  check_in NVARCHAR(10) NOT NULL,
  check_out NVARCHAR(10) NOT NULL,
  nights INT NOT NULL,
  status NVARCHAR(50) NOT NULL,
  note NVARCHAR(1000) NOT NULL CONSTRAINT DF_hotel_stays_note DEFAULT (N''),
  subtotal DECIMAL(18,2) NOT NULL,
  discount DECIMAL(18,2) NOT NULL CONSTRAINT DF_hotel_stays_discount DEFAULT (0),
  total_price DECIMAL(18,2) NOT NULL,
  promo_applied BIT NOT NULL CONSTRAINT DF_hotel_stays_promo DEFAULT (0),
  created_at NVARCHAR(40) NOT NULL,
  updated_at NVARCHAR(40) NOT NULL
);

IF OBJECT_ID(N'dbo.hotel_stay_units', N'U') IS NULL
CREATE TABLE dbo.hotel_stay_units (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  stay_id NVARCHAR(64) NOT NULL,
  room_type_id NVARCHAR(64) NOT NULL,
  units INT NOT NULL,
  price_per_night DECIMAL(18,2) NOT NULL,
  line_subtotal DECIMAL(18,2) NOT NULL,
  pet_ids_json NVARCHAR(MAX) NOT NULL
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'hotel_stays_owner_idx' AND object_id = OBJECT_ID(N'dbo.hotel_stays'))
  CREATE INDEX hotel_stays_owner_idx ON dbo.hotel_stays(owner_id, created_at DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'hotel_stays_dates_idx' AND object_id = OBJECT_ID(N'dbo.hotel_stays'))
  CREATE INDEX hotel_stays_dates_idx ON dbo.hotel_stays(check_in, check_out, status);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'hotel_stay_units_stay_idx' AND object_id = OBJECT_ID(N'dbo.hotel_stay_units'))
  CREATE INDEX hotel_stay_units_stay_idx ON dbo.hotel_stay_units(stay_id);

IF OBJECT_ID(N'dbo.bookings', N'U') IS NULL
CREATE TABLE dbo.bookings (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  owner_id NVARCHAR(64) NULL,
  owner_name NVARCHAR(200) NULL,
  owner_phone NVARCHAR(50) NULL,
  pet_id NVARCHAR(64) NULL,
  pet_name NVARCHAR(200) NOT NULL,
  pet_species NVARCHAR(100) NOT NULL CONSTRAINT DF_bookings_pet_species DEFAULT (N''),
  pet_notes NVARCHAR(1000) NOT NULL CONSTRAINT DF_bookings_pet_notes DEFAULT (N''),
  service_type NVARCHAR(50) NOT NULL,
  from_zone_id NVARCHAR(64) NULL,
  to_zone_id NVARCHAR(64) NULL,
  return_from_zone_id NVARCHAR(64) NULL,
  return_to_zone_id NVARCHAR(64) NULL,
  fare_zone_id NVARCHAR(64) NULL,
  estimated_quote_json NVARCHAR(MAX) NULL,
  final_quote_json NVARCHAR(MAX) NULL,
  status NVARCHAR(50) NOT NULL,
  payment_status NVARCHAR(50) NOT NULL CONSTRAINT DF_bookings_payment_status DEFAULT (N'unpaid'),
  payment_note NVARCHAR(500) NOT NULL CONSTRAINT DF_bookings_payment_note DEFAULT (N''),
  payment_slip NVARCHAR(MAX) NOT NULL CONSTRAINT DF_bookings_payment_slip DEFAULT (N''),
  cancel_request_json NVARCHAR(MAX) NULL,
  created_at NVARCHAR(40) NOT NULL,
  updated_at NVARCHAR(40) NOT NULL
);

IF OBJECT_ID(N'dbo.trips', N'U') IS NULL
CREATE TABLE dbo.trips (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  booking_id NVARCHAR(64) NOT NULL,
  type NVARCHAR(50) NOT NULL,
  driver_id NVARCHAR(64) NULL,
  status NVARCHAR(50) NOT NULL,
  from_json NVARCHAR(MAX) NOT NULL,
  to_json NVARCHAR(MAX) NOT NULL,
  pickup_time NVARCHAR(40) NULL,
  dropoff_time NVARCHAR(40) NULL,
  evidence_pickup_json NVARCHAR(MAX) NULL,
  evidence_dropoff_json NVARCHAR(MAX) NULL,
  created_at NVARCHAR(40) NOT NULL,
  CONSTRAINT FK_trips_booking FOREIGN KEY (booking_id) REFERENCES dbo.bookings(id) ON DELETE CASCADE
);

IF OBJECT_ID(N'dbo.trip_status_history', N'U') IS NULL
CREATE TABLE dbo.trip_status_history (
  id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  trip_id NVARCHAR(64) NOT NULL,
  status NVARCHAR(50) NOT NULL,
  at NVARCHAR(40) NOT NULL,
  note NVARCHAR(500) NULL,
  CONSTRAINT FK_trip_history_trip FOREIGN KEY (trip_id) REFERENCES dbo.trips(id) ON DELETE CASCADE
);

IF OBJECT_ID(N'dbo.notifications', N'U') IS NULL
CREATE TABLE dbo.notifications (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  driver_id NVARCHAR(64) NOT NULL,
  type NVARCHAR(50) NOT NULL,
  title NVARCHAR(300) NOT NULL,
  body NVARCHAR(1000) NOT NULL CONSTRAINT DF_notifications_body DEFAULT (N''),
  trip_id NVARCHAR(64) NULL,
  booking_id NVARCHAR(64) NULL,
  dedupe_key NVARCHAR(200) NULL,
  read_at NVARCHAR(40) NULL,
  created_at NVARCHAR(40) NOT NULL
);

IF OBJECT_ID(N'dbo.issues', N'U') IS NULL
CREATE TABLE dbo.issues (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  trip_id NVARCHAR(64) NOT NULL,
  booking_id NVARCHAR(64) NULL,
  driver_id NVARCHAR(64) NULL,
  reason_id NVARCHAR(64) NULL,
  message NVARCHAR(1000) NULL,
  created_at NVARCHAR(40) NOT NULL,
  CONSTRAINT FK_issues_trip FOREIGN KEY (trip_id) REFERENCES dbo.trips(id) ON DELETE CASCADE
);

IF OBJECT_ID(N'dbo.payments', N'U') IS NULL
CREATE TABLE dbo.payments (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  owner_id NVARCHAR(64) NOT NULL,
  kind NVARCHAR(50) NOT NULL,
  ref_id NVARCHAR(64) NOT NULL,
  status NVARCHAR(50) NOT NULL,
  created_at NVARCHAR(40) NOT NULL,
  data NVARCHAR(MAX) NOT NULL
);

IF OBJECT_ID(N'dbo.cancellations', N'U') IS NULL
CREATE TABLE dbo.cancellations (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  owner_id NVARCHAR(64) NOT NULL,
  kind NVARCHAR(50) NOT NULL,
  ref_id NVARCHAR(64) NOT NULL,
  status NVARCHAR(50) NOT NULL,
  created_at NVARCHAR(40) NOT NULL,
  data NVARCHAR(MAX) NOT NULL
);

IF OBJECT_ID(N'dbo.payment_legacy_imports', N'U') IS NULL
CREATE TABLE dbo.payment_legacy_imports (
  owner_id NVARCHAR(64) NOT NULL PRIMARY KEY,
  imported_at NVARCHAR(40) NOT NULL
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_trips_booking' AND object_id = OBJECT_ID(N'dbo.trips'))
  CREATE INDEX idx_trips_booking ON dbo.trips(booking_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_trips_driver' AND object_id = OBJECT_ID(N'dbo.trips'))
  CREATE INDEX idx_trips_driver ON dbo.trips(driver_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_notifications_driver' AND object_id = OBJECT_ID(N'dbo.notifications'))
  CREATE INDEX idx_notifications_driver ON dbo.notifications(driver_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'payments_owner_idx' AND object_id = OBJECT_ID(N'dbo.payments'))
  CREATE INDEX payments_owner_idx ON dbo.payments(owner_id, created_at);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'payments_status_idx' AND object_id = OBJECT_ID(N'dbo.payments'))
  CREATE INDEX payments_status_idx ON dbo.payments(status, created_at);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'cancellations_owner_idx' AND object_id = OBJECT_ID(N'dbo.cancellations'))
  CREATE INDEX cancellations_owner_idx ON dbo.cancellations(owner_id, created_at);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'cancellations_status_idx' AND object_id = OBJECT_ID(N'dbo.cancellations'))
  CREATE INDEX cancellations_status_idx ON dbo.cancellations(status, created_at);
`;

/** App domain tables (auth, pets, clinic, hotel, adoption) — previously JSON/localStorage/memory. */
const SCHEMA_APP = `
IF OBJECT_ID(N'dbo.users', N'U') IS NULL
CREATE TABLE dbo.users (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  email NVARCHAR(200) NOT NULL,
  password_hash NVARCHAR(200) NOT NULL CONSTRAINT DF_users_password_hash DEFAULT (N''),
  salt NVARCHAR(100) NOT NULL CONSTRAINT DF_users_salt DEFAULT (N''),
  role NVARCHAR(50) NOT NULL CONSTRAINT DF_users_role DEFAULT (N'owner'),
  first_name NVARCHAR(100) NOT NULL CONSTRAINT DF_users_first_name DEFAULT (N''),
  last_name NVARCHAR(100) NOT NULL CONSTRAINT DF_users_last_name DEFAULT (N''),
  phone NVARCHAR(50) NOT NULL CONSTRAINT DF_users_phone DEFAULT (N''),
  address NVARCHAR(500) NOT NULL CONSTRAINT DF_users_address DEFAULT (N''),
  emergency_name NVARCHAR(200) NOT NULL CONSTRAINT DF_users_emergency_name DEFAULT (N''),
  emergency_phone NVARCHAR(50) NOT NULL CONSTRAINT DF_users_emergency_phone DEFAULT (N''),
  avatar NVARCHAR(MAX) NOT NULL CONSTRAINT DF_users_avatar DEFAULT (N''),
  points INT NOT NULL CONSTRAINT DF_users_points DEFAULT (0),
  vehicle NVARCHAR(200) NOT NULL CONSTRAINT DF_users_vehicle DEFAULT (N''),
  plate_number NVARCHAR(50) NOT NULL CONSTRAINT DF_users_plate_number DEFAULT (N''),
  license_number NVARCHAR(100) NOT NULL CONSTRAINT DF_users_license_number DEFAULT (N''),
  license_expiry NVARCHAR(40) NOT NULL CONSTRAINT DF_users_license_expiry DEFAULT (N''),
  active BIT NOT NULL CONSTRAINT DF_users_active DEFAULT (1),
  data NVARCHAR(MAX) NULL,
  created_at NVARCHAR(40) NOT NULL,
  updated_at NVARCHAR(40) NOT NULL
);

IF OBJECT_ID(N'dbo.sessions', N'U') IS NULL
CREATE TABLE dbo.sessions (
  token NVARCHAR(128) NOT NULL PRIMARY KEY,
  user_id NVARCHAR(64) NOT NULL,
  expires_at NVARCHAR(40) NOT NULL,
  created_at NVARCHAR(40) NOT NULL
);

IF OBJECT_ID(N'dbo.staff_accounts', N'U') IS NULL
CREATE TABLE dbo.staff_accounts (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  name NVARCHAR(200) NOT NULL,
  email NVARCHAR(200) NOT NULL,
  role NVARCHAR(50) NOT NULL,
  active BIT NOT NULL CONSTRAINT DF_staff_accounts_active DEFAULT (1),
  salt NVARCHAR(100) NOT NULL CONSTRAINT DF_staff_accounts_salt DEFAULT (N''),
  password_hash NVARCHAR(200) NOT NULL CONSTRAINT DF_staff_accounts_password_hash DEFAULT (N''),
  created_at NVARCHAR(40) NOT NULL,
  updated_at NVARCHAR(40) NOT NULL
);

IF OBJECT_ID(N'dbo.staff_sessions', N'U') IS NULL
CREATE TABLE dbo.staff_sessions (
  token NVARCHAR(128) NOT NULL PRIMARY KEY,
  staff_id NVARCHAR(64) NOT NULL,
  expires_at NVARCHAR(40) NOT NULL,
  created_at NVARCHAR(40) NOT NULL
);

IF OBJECT_ID(N'dbo.pets', N'U') IS NULL
CREATE TABLE dbo.pets (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  owner_id NVARCHAR(64) NOT NULL,
  name NVARCHAR(200) NOT NULL,
  species NVARCHAR(100) NOT NULL CONSTRAINT DF_pets_species DEFAULT (N''),
  breed NVARCHAR(200) NOT NULL CONSTRAINT DF_pets_breed DEFAULT (N''),
  sex NVARCHAR(20) NOT NULL CONSTRAINT DF_pets_sex DEFAULT (N''),
  birth_date NVARCHAR(40) NOT NULL CONSTRAINT DF_pets_birth_date DEFAULT (N''),
  weight NVARCHAR(40) NOT NULL CONSTRAINT DF_pets_weight DEFAULT (N''),
  color NVARCHAR(200) NOT NULL CONSTRAINT DF_pets_color DEFAULT (N''),
  microchip NVARCHAR(100) NOT NULL CONSTRAINT DF_pets_microchip DEFAULT (N''),
  photo NVARCHAR(MAX) NOT NULL CONSTRAINT DF_pets_photo DEFAULT (N''),
  data NVARCHAR(MAX) NULL,
  created_at NVARCHAR(40) NOT NULL,
  updated_at NVARCHAR(40) NOT NULL
);

IF OBJECT_ID(N'dbo.owners', N'U') IS NULL
CREATE TABLE dbo.owners (
  owner_id NVARCHAR(64) NOT NULL PRIMARY KEY,
  name NVARCHAR(200) NOT NULL CONSTRAINT DF_owners_name DEFAULT (N''),
  phone NVARCHAR(50) NOT NULL CONSTRAINT DF_owners_phone DEFAULT (N''),
  email NVARCHAR(200) NOT NULL CONSTRAINT DF_owners_email DEFAULT (N''),
  address NVARCHAR(500) NOT NULL CONSTRAINT DF_owners_address DEFAULT (N''),
  emergency_name NVARCHAR(200) NOT NULL CONSTRAINT DF_owners_emergency_name DEFAULT (N''),
  emergency_phone NVARCHAR(50) NOT NULL CONSTRAINT DF_owners_emergency_phone DEFAULT (N''),
  updated_at NVARCHAR(40) NOT NULL
);

IF OBJECT_ID(N'dbo.clinic_bookings', N'U') IS NULL
CREATE TABLE dbo.clinic_bookings (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  owner_id NVARCHAR(64) NOT NULL,
  pet_id NVARCHAR(64) NULL,
  pet_name NVARCHAR(200) NOT NULL CONSTRAINT DF_clinic_bookings_pet_name DEFAULT (N''),
  pet_species NVARCHAR(100) NOT NULL CONSTRAINT DF_clinic_bookings_pet_species DEFAULT (N''),
  owner_name NVARCHAR(200) NOT NULL CONSTRAINT DF_clinic_bookings_owner_name DEFAULT (N''),
  owner_phone NVARCHAR(50) NOT NULL CONSTRAINT DF_clinic_bookings_owner_phone DEFAULT (N''),
  service NVARCHAR(100) NOT NULL,
  service_label NVARCHAR(200) NOT NULL CONSTRAINT DF_clinic_bookings_service_label DEFAULT (N''),
  [date] NVARCHAR(20) NOT NULL,
  [time] NVARCHAR(20) NOT NULL,
  note NVARCHAR(1000) NOT NULL CONSTRAINT DF_clinic_bookings_note DEFAULT (N''),
  status NVARCHAR(50) NOT NULL,
  clinic_note NVARCHAR(1000) NOT NULL CONSTRAINT DF_clinic_bookings_clinic_note DEFAULT (N''),
  data NVARCHAR(MAX) NULL,
  created_at NVARCHAR(40) NOT NULL,
  updated_at NVARCHAR(40) NOT NULL
);

IF OBJECT_ID(N'dbo.hotel_reservations', N'U') IS NULL
CREATE TABLE dbo.hotel_reservations (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  owner_id NVARCHAR(64) NOT NULL,
  pet_id NVARCHAR(64) NULL,
  pet_name NVARCHAR(200) NOT NULL CONSTRAINT DF_hotel_reservations_pet_name DEFAULT (N''),
  pet_species NVARCHAR(100) NOT NULL CONSTRAINT DF_hotel_reservations_pet_species DEFAULT (N''),
  room_type NVARCHAR(64) NOT NULL,
  room_label NVARCHAR(200) NOT NULL CONSTRAINT DF_hotel_reservations_room_label DEFAULT (N''),
  price_per_night DECIMAL(18,2) NOT NULL CONSTRAINT DF_hotel_reservations_price_per_night DEFAULT (0),
  check_in NVARCHAR(40) NOT NULL,
  check_out NVARCHAR(40) NOT NULL,
  nights INT NOT NULL CONSTRAINT DF_hotel_reservations_nights DEFAULT (1),
  total_price DECIMAL(18,2) NOT NULL CONSTRAINT DF_hotel_reservations_total_price DEFAULT (0),
  note NVARCHAR(1000) NOT NULL CONSTRAINT DF_hotel_reservations_note DEFAULT (N''),
  status NVARCHAR(50) NOT NULL,
  data NVARCHAR(MAX) NULL,
  created_at NVARCHAR(40) NOT NULL,
  updated_at NVARCHAR(40) NOT NULL
);

IF OBJECT_ID(N'dbo.transport_requests', N'U') IS NULL
CREATE TABLE dbo.transport_requests (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  owner_id NVARCHAR(64) NOT NULL,
  pet_id NVARCHAR(64) NULL,
  pet_name NVARCHAR(200) NOT NULL CONSTRAINT DF_transport_requests_pet_name DEFAULT (N''),
  pet_species NVARCHAR(100) NOT NULL CONSTRAINT DF_transport_requests_pet_species DEFAULT (N''),
  direction NVARCHAR(50) NOT NULL,
  direction_label NVARCHAR(200) NOT NULL CONSTRAINT DF_transport_requests_direction_label DEFAULT (N''),
  [date] NVARCHAR(20) NOT NULL,
  [time] NVARCHAR(20) NOT NULL,
  address NVARCHAR(500) NOT NULL CONSTRAINT DF_transport_requests_address DEFAULT (N''),
  phone NVARCHAR(50) NOT NULL CONSTRAINT DF_transport_requests_phone DEFAULT (N''),
  note NVARCHAR(1000) NOT NULL CONSTRAINT DF_transport_requests_note DEFAULT (N''),
  status NVARCHAR(50) NOT NULL,
  data NVARCHAR(MAX) NULL,
  created_at NVARCHAR(40) NOT NULL,
  updated_at NVARCHAR(40) NOT NULL
);

IF OBJECT_ID(N'dbo.visits', N'U') IS NULL
CREATE TABLE dbo.visits (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  booking_id NVARCHAR(64) NULL,
  pet_id NVARCHAR(64) NULL,
  owner_id NVARCHAR(64) NULL,
  status NVARCHAR(50) NOT NULL CONSTRAINT DF_visits_status DEFAULT (N''),
  data NVARCHAR(MAX) NULL,
  created_at NVARCHAR(40) NOT NULL,
  updated_at NVARCHAR(40) NOT NULL
);

IF OBJECT_ID(N'dbo.patient_notes', N'U') IS NULL
CREATE TABLE dbo.patient_notes (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  pet_id NVARCHAR(64) NULL,
  owner_id NVARCHAR(64) NULL,
  author_staff_id NVARCHAR(64) NULL,
  note NVARCHAR(MAX) NOT NULL CONSTRAINT DF_patient_notes_note DEFAULT (N''),
  data NVARCHAR(MAX) NULL,
  created_at NVARCHAR(40) NOT NULL,
  updated_at NVARCHAR(40) NOT NULL
);

IF OBJECT_ID(N'dbo.clinic_settings', N'U') IS NULL
CREATE TABLE dbo.clinic_settings (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  data NVARCHAR(MAX) NOT NULL,
  updated_at NVARCHAR(40) NOT NULL
);

IF OBJECT_ID(N'dbo.clinic_roster', N'U') IS NULL
CREATE TABLE dbo.clinic_roster (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  week_key NVARCHAR(40) NOT NULL CONSTRAINT DF_clinic_roster_week_key DEFAULT (N''),
  data NVARCHAR(MAX) NOT NULL,
  updated_at NVARCHAR(40) NOT NULL
);

IF OBJECT_ID(N'dbo.adoption_animals', N'U') IS NULL
CREATE TABLE dbo.adoption_animals (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  owner_id NVARCHAR(64) NULL,
  name NVARCHAR(200) NOT NULL,
  species NVARCHAR(100) NOT NULL CONSTRAINT DF_adoption_animals_species DEFAULT (N''),
  status NVARCHAR(50) NOT NULL CONSTRAINT DF_adoption_animals_status DEFAULT (N'available'),
  data NVARCHAR(MAX) NULL,
  created_at NVARCHAR(40) NOT NULL,
  updated_at NVARCHAR(40) NOT NULL
);

IF OBJECT_ID(N'dbo.adoption_applications', N'U') IS NULL
CREATE TABLE dbo.adoption_applications (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  animal_id NVARCHAR(64) NOT NULL,
  applicant_user_id NVARCHAR(64) NULL,
  status NVARCHAR(50) NOT NULL CONSTRAINT DF_adoption_applications_status DEFAULT (N'pending'),
  data NVARCHAR(MAX) NULL,
  created_at NVARCHAR(40) NOT NULL,
  updated_at NVARCHAR(40) NOT NULL
);

IF OBJECT_ID(N'dbo.adoption_requests', N'U') IS NULL
CREATE TABLE dbo.adoption_requests (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  owner_id NVARCHAR(64) NOT NULL,
  animal_id NVARCHAR(64) NOT NULL,
  animal_name NVARCHAR(200) NOT NULL CONSTRAINT DF_adoption_requests_animal_name DEFAULT (N''),
  status NVARCHAR(50) NOT NULL CONSTRAINT DF_adoption_requests_status DEFAULT (N'pending'),
  data NVARCHAR(MAX) NULL,
  created_at NVARCHAR(40) NOT NULL,
  updated_at NVARCHAR(40) NOT NULL
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UQ_users_email' AND object_id = OBJECT_ID(N'dbo.users'))
  CREATE UNIQUE INDEX UQ_users_email ON dbo.users(email);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_sessions_user' AND object_id = OBJECT_ID(N'dbo.sessions'))
  CREATE INDEX idx_sessions_user ON dbo.sessions(user_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UQ_staff_accounts_email' AND object_id = OBJECT_ID(N'dbo.staff_accounts'))
  CREATE UNIQUE INDEX UQ_staff_accounts_email ON dbo.staff_accounts(email);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_staff_sessions_staff' AND object_id = OBJECT_ID(N'dbo.staff_sessions'))
  CREATE INDEX idx_staff_sessions_staff ON dbo.staff_sessions(staff_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_pets_owner' AND object_id = OBJECT_ID(N'dbo.pets'))
  CREATE INDEX idx_pets_owner ON dbo.pets(owner_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_clinic_bookings_owner' AND object_id = OBJECT_ID(N'dbo.clinic_bookings'))
  CREATE INDEX idx_clinic_bookings_owner ON dbo.clinic_bookings(owner_id, [date], [time]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_clinic_bookings_status' AND object_id = OBJECT_ID(N'dbo.clinic_bookings'))
  CREATE INDEX idx_clinic_bookings_status ON dbo.clinic_bookings(status, [date]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_hotel_reservations_owner' AND object_id = OBJECT_ID(N'dbo.hotel_reservations'))
  CREATE INDEX idx_hotel_reservations_owner ON dbo.hotel_reservations(owner_id, check_in);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_transport_requests_owner' AND object_id = OBJECT_ID(N'dbo.transport_requests'))
  CREATE INDEX idx_transport_requests_owner ON dbo.transport_requests(owner_id, [date]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_visits_booking' AND object_id = OBJECT_ID(N'dbo.visits'))
  CREATE INDEX idx_visits_booking ON dbo.visits(booking_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_patient_notes_pet' AND object_id = OBJECT_ID(N'dbo.patient_notes'))
  CREATE INDEX idx_patient_notes_pet ON dbo.patient_notes(pet_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_adoption_animals_status' AND object_id = OBJECT_ID(N'dbo.adoption_animals'))
  CREATE INDEX idx_adoption_animals_status ON dbo.adoption_animals(status);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_adoption_applications_animal' AND object_id = OBJECT_ID(N'dbo.adoption_applications'))
  CREATE INDEX idx_adoption_applications_animal ON dbo.adoption_applications(animal_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_adoption_requests_owner' AND object_id = OBJECT_ID(N'dbo.adoption_requests'))
  CREATE INDEX idx_adoption_requests_owner ON dbo.adoption_requests(owner_id);
`;

export const SEED_ZONES = [
  { id: '1', label: 'Zone 1', price: 100 },
  { id: '2', label: 'Zone 2', price: 150 },
];

export const SEED_CLINICS = [
  {
    id: 'clinic-1',
    name: 'Pet Care',
    address: '99/9 ถนนพหลโยธิน แขวงจตุจักร เขตจตุจักร กรุงเทพฯ 10900',
    district_id: 'chatuchak',
    subdistrict_id: 'chatuchak',
    zone_id: '1',
    map_url: null,
  },
];

export const SEED_HOTEL_ROOM_TYPES = [
  { id: 'dog_s', species: 'dog', sizeCode: 'S', titleTh: 'ห้องสุนัข ไซส์ S', descriptionTh: 'เหมาะสุนัขเล็กและจิ๋ว', imageUrl: '/rooms/dog-s.jpg', maxPetsPerUnit: 1, totalUnits: 6, sortOrder: 1 },
  { id: 'dog_m', species: 'dog', sizeCode: 'M', titleTh: 'ห้องสุนัข ไซส์ M', descriptionTh: 'สุนัขขนาดกลาง สบายตัว', imageUrl: '/rooms/dog-m.jpg', maxPetsPerUnit: 1, totalUnits: 8, sortOrder: 2 },
  { id: 'dog_l', species: 'dog', sizeCode: 'L', titleTh: 'ห้องสุนัข ไซส์ L', descriptionTh: 'สุนัขกลาง–ใหญ่', imageUrl: '/rooms/dog-l.jpg', maxPetsPerUnit: 1, totalUnits: 5, sortOrder: 3 },
  { id: 'dog_xl', species: 'dog', sizeCode: 'XL', titleTh: 'ห้องสุนัข ไซส์ XL', descriptionTh: 'สุนัขใหญ่พิเศษ', imageUrl: '/rooms/dog-xl.jpg', maxPetsPerUnit: 2, totalUnits: 3, sortOrder: 4 },
  { id: 'cat_s', species: 'cat', sizeCode: 'S', titleTh: 'ห้องแมว ไซส์ S', descriptionTh: 'แมวตัวเดียว เงียบสงบ', imageUrl: '/rooms/cat-s.jpg', maxPetsPerUnit: 3, totalUnits: 8, sortOrder: 5 },
  { id: 'cat_m', species: 'cat', sizeCode: 'M', titleTh: 'ห้องแมว ไซส์ M', descriptionTh: 'แมวขนาดกลาง มีที่ปีน', imageUrl: '/rooms/cat-m.jpg', maxPetsPerUnit: 3, totalUnits: 10, sortOrder: 6 },
  { id: 'cat_l', species: 'cat', sizeCode: 'L', titleTh: 'ห้องแมว ไซส์ L', descriptionTh: 'แมวหลายตัว / พื้นที่กว้าง', imageUrl: '/rooms/cat-l.jpg', maxPetsPerUnit: 3, totalUnits: 6, sortOrder: 7 },
  { id: 'cat_xl', species: 'cat', sizeCode: 'XL', titleTh: 'ห้องแมว ไซส์ XL', descriptionTh: 'ห้องใหญ่สำหรับแมวหลายตัว', imageUrl: '/rooms/cat-xl.jpg', maxPetsPerUnit: 2, totalUnits: 4, sortOrder: 8 },
];

export const SEED_HOTEL_ROOM_PRICES = [
  { id: 'dog_s', label: 'สุนัข S', price: 450, sortOrder: 1 },
  { id: 'dog_m', label: 'สุนัข M', price: 650, sortOrder: 2 },
  { id: 'dog_l', label: 'สุนัข L', price: 950, sortOrder: 3 },
  { id: 'dog_xl', label: 'สุนัข XL', price: 1350, sortOrder: 4 },
  { id: 'cat_s', label: 'แมว S', price: 350, sortOrder: 5 },
  { id: 'cat_m', label: 'แมว M', price: 550, sortOrder: 6 },
  { id: 'cat_l', label: 'แมว L', price: 750, sortOrder: 7 },
  { id: 'cat_xl', label: 'แมว XL', price: 1050, sortOrder: 8 },
];

async function upsertZone(z) {
  await run(
    `MERGE dbo.zones AS t
     USING (SELECT ? AS id, ? AS label, ? AS price) AS s
     ON t.id = s.id
     WHEN MATCHED THEN UPDATE SET label = s.label, price = s.price
     WHEN NOT MATCHED THEN INSERT (id, label, price) VALUES (s.id, s.label, s.price);`,
    [z.id, z.label, z.price],
  );
}

async function upsertClinic(c) {
  await run(
    `MERGE dbo.clinics AS t
     USING (SELECT ? AS id, ? AS name, ? AS address, ? AS district_id, ? AS subdistrict_id, ? AS zone_id, ? AS map_url) AS s
     ON t.id = s.id
     WHEN MATCHED THEN UPDATE SET
       name = s.name, address = s.address, district_id = s.district_id,
       subdistrict_id = s.subdistrict_id, zone_id = s.zone_id, map_url = s.map_url
     WHEN NOT MATCHED THEN INSERT (id, name, address, district_id, subdistrict_id, zone_id, map_url)
       VALUES (s.id, s.name, s.address, s.district_id, s.subdistrict_id, s.zone_id, s.map_url);`,
    [c.id, c.name, c.address, c.district_id, c.subdistrict_id, c.zone_id, c.map_url],
  );
}

async function upsertHotelRoom(room) {
  await run(
    `MERGE dbo.hotel_room_prices AS t
     USING (SELECT ? AS room_id, ? AS label, ? AS price, ? AS sort_order) AS s
     ON t.room_id = s.room_id
     WHEN MATCHED THEN UPDATE SET label = s.label, price = s.price, sort_order = s.sort_order
     WHEN NOT MATCHED THEN INSERT (room_id, label, price, sort_order)
       VALUES (s.room_id, s.label, s.price, s.sort_order);`,
    [room.id, room.label, room.price, room.sortOrder],
  );
}

async function upsertHotelRoomType(row) {
  await run(
    `MERGE dbo.hotel_room_types AS t
     USING (SELECT ? AS id, ? AS species, ? AS size_code, ? AS title_th, ? AS description_th,
            ? AS image_url, ? AS max_pets_per_unit, ? AS total_units, ? AS sort_order) AS s
     ON t.id = s.id
     WHEN MATCHED THEN UPDATE SET
       species = s.species, size_code = s.size_code, title_th = s.title_th,
       description_th = s.description_th, image_url = s.image_url,
       max_pets_per_unit = s.max_pets_per_unit, total_units = s.total_units, sort_order = s.sort_order
     WHEN NOT MATCHED THEN INSERT (id, species, size_code, title_th, description_th, image_url,
       max_pets_per_unit, total_units, sort_order)
       VALUES (s.id, s.species, s.size_code, s.title_th, s.description_th, s.image_url,
         s.max_pets_per_unit, s.total_units, s.sort_order);`,
    [
      row.id, row.species, row.sizeCode, row.titleTh, row.descriptionTh,
      row.imageUrl, row.maxPetsPerUnit, row.totalUnits, row.sortOrder,
    ],
  );
}

async function seedHotelRoomCatalog() {
  for (const row of SEED_HOTEL_ROOM_TYPES) {
    await upsertHotelRoomType(row);
  }
  for (const room of SEED_HOTEL_ROOM_PRICES) {
    await upsertHotelRoom(room);
  }
}

async function seedCatalogIfEmpty() {
  const zoneCount = Number((await queryOne('SELECT COUNT(*) AS c FROM dbo.zones'))?.c ?? 0);
  if (zoneCount === 0) {
    for (const z of SEED_ZONES) {
      await run('INSERT INTO dbo.zones (id, label, price) VALUES (?, ?, ?)', [z.id, z.label, z.price]);
    }
  }

  const clinicCount = Number((await queryOne('SELECT COUNT(*) AS c FROM dbo.clinics'))?.c ?? 0);
  if (clinicCount === 0) {
    for (const c of SEED_CLINICS) {
      await run(
        `INSERT INTO dbo.clinics (id, name, address, district_id, subdistrict_id, zone_id, map_url)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [c.id, c.name, c.address, c.district_id, c.subdistrict_id, c.zone_id, c.map_url],
      );
    }
  }

  const typeCount = Number((await queryOne('SELECT COUNT(*) AS c FROM dbo.hotel_room_types'))?.c ?? 0);
  if (typeCount === 0) {
    await seedHotelRoomCatalog();
  } else {
    const priceCount = Number((await queryOne('SELECT COUNT(*) AS c FROM dbo.hotel_room_prices'))?.c ?? 0);
    if (priceCount === 0) {
      for (const room of SEED_HOTEL_ROOM_PRICES) {
        await run(
          'INSERT INTO dbo.hotel_room_prices (room_id, label, price, sort_order) VALUES (?, ?, ?, ?)',
          [room.id, room.label, room.price, room.sortOrder],
        );
      }
    }
  }
}

async function syncSeedTransportCatalog() {
  for (const z of SEED_ZONES) await upsertZone(z);
  for (const c of SEED_CLINICS) await upsertClinic(c);
}

export async function migrate() {
  await exec(SCHEMA);
  await exec(SCHEMA_APP);
  await seedCatalogIfEmpty();
  await syncSeedTransportCatalog();
  const { seedRoleUsers } = await import('../auth/seedUsers.js');
  await seedRoleUsers();
  const { ensureStaffReady } = await import('../auth/staffAccounts.js');
  await ensureStaffReady();
  const { migrateCctv } = await import('../super-admin/cctvMigrate.js');
  await migrateCctv();
}

export async function reseedsCatalog() {
  await syncSeedTransportCatalog();
  await seedHotelRoomCatalog();
}

export { upsertZone, upsertHotelRoom, upsertHotelRoomType, seedHotelRoomCatalog };
