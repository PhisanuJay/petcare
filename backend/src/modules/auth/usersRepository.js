import { queryAll, queryOne, run } from '../../db/mssql.js';

function bit(value) {
  return value ? 1 : 0;
}

function mapUser(row) {
  if (!row) return null;
  let extra = {};
  if (row.data) {
    try {
      extra = JSON.parse(row.data);
    } catch {
      extra = {};
    }
  }
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    salt: row.salt,
    role: row.role,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    address: row.address,
    emergencyName: row.emergency_name,
    emergencyPhone: row.emergency_phone,
    avatar: row.avatar,
    points: Number(row.points || 0),
    vehicle: row.vehicle,
    plateNumber: row.plate_number,
    licenseNumber: row.license_number,
    licenseExpiry: row.license_expiry,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...extra,
  };
}

const SELECT_USER = `
  SELECT id, email, password_hash, salt, role, first_name, last_name, phone, address,
         emergency_name, emergency_phone, avatar, points, vehicle, plate_number,
         license_number, license_expiry, active, data, created_at, updated_at
  FROM dbo.users
`;

export async function findUserByEmail(email) {
  const row = await queryOne(
    `${SELECT_USER} WHERE lower(email) = ?`,
    [String(email || '').trim().toLowerCase()],
  );
  return mapUser(row);
}

export async function findUserById(id) {
  const row = await queryOne(`${SELECT_USER} WHERE id = ?`, [id]);
  return mapUser(row);
}

export async function listUsersByRole(role) {
  const rows = await queryAll(`${SELECT_USER} WHERE role = ? ORDER BY first_name, last_name, email`, [role]);
  return rows.map(mapUser);
}

export async function listActiveOwners() {
  const rows = await queryAll(
    `${SELECT_USER} WHERE role = N'owner' AND active = 1 ORDER BY first_name, last_name, email`,
  );
  return rows.map(mapUser);
}

export async function listAllUsers() {
  const rows = await queryAll(`${SELECT_USER} ORDER BY role, first_name, last_name, email`);
  return rows.map(mapUser);
}

export async function upsertUser(user) {
  const now = new Date().toISOString();
  const createdAt = user.createdAt || now;
  const updatedAt = now;
  const data = user.data != null
    ? (typeof user.data === 'string' ? user.data : JSON.stringify(user.data))
    : null;

  await run(
    `MERGE dbo.users AS t
     USING (SELECT ? AS id) AS s ON t.id = s.id
     WHEN MATCHED THEN UPDATE SET
       email = ?, password_hash = ?, salt = ?, role = ?,
       first_name = ?, last_name = ?, phone = ?, address = ?,
       emergency_name = ?, emergency_phone = ?, avatar = ?, points = ?,
       vehicle = ?, plate_number = ?, license_number = ?, license_expiry = ?,
       active = ?, data = ?, updated_at = ?
     WHEN NOT MATCHED THEN INSERT (
       id, email, password_hash, salt, role, first_name, last_name, phone, address,
       emergency_name, emergency_phone, avatar, points, vehicle, plate_number,
       license_number, license_expiry, active, data, created_at, updated_at
     ) VALUES (
       ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
     );`,
    [
      user.id,
      user.email,
      user.passwordHash || '',
      user.salt || '',
      user.role,
      user.firstName || '',
      user.lastName || '',
      user.phone || '',
      user.address || '',
      user.emergencyName || '',
      user.emergencyPhone || '',
      user.avatar || '',
      Number(user.points || 0),
      user.vehicle || '',
      user.plateNumber || '',
      user.licenseNumber || '',
      user.licenseExpiry || '',
      bit(user.active !== false),
      data,
      updatedAt,
      user.id,
      user.email,
      user.passwordHash || '',
      user.salt || '',
      user.role,
      user.firstName || '',
      user.lastName || '',
      user.phone || '',
      user.address || '',
      user.emergencyName || '',
      user.emergencyPhone || '',
      user.avatar || '',
      Number(user.points || 0),
      user.vehicle || '',
      user.plateNumber || '',
      user.licenseNumber || '',
      user.licenseExpiry || '',
      bit(user.active !== false),
      data,
      createdAt,
      updatedAt,
    ],
  );
  return findUserById(user.id);
}

export async function updateUserFields(id, patch) {
  const current = await findUserById(id);
  if (!current) return null;
  return upsertUser({
    ...current,
    ...patch,
    passwordHash: patch.passwordHash ?? current.passwordHash,
    salt: patch.salt ?? current.salt,
  });
}

export async function emailTaken(email, exceptId = null) {
  const row = await queryOne(
    `SELECT id FROM dbo.users WHERE lower(email) = ?${exceptId ? ' AND id <> ?' : ''}`,
    exceptId
      ? [String(email || '').trim().toLowerCase(), exceptId]
      : [String(email || '').trim().toLowerCase()],
  );
  return Boolean(row);
}
