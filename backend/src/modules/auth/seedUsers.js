import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { queryOne } from '../../db/mssql.js';
import { findUserByEmail, upsertUser } from './usersRepository.js';

const scrypt = promisify(scryptCallback);

async function hashPassword(password, saltHex) {
  return (await scrypt(String(password), saltHex, 64)).toString('hex');
}

async function buildUser(seed) {
  const existing = await findUserByEmail(seed.email);
  const salt = existing?.salt || randomBytes(16).toString('hex');
  const passwordHash = await hashPassword(seed.password, salt);
  const [firstName, ...rest] = String(seed.name || '').trim().split(/\s+/);
  const lastName = rest.join(' ');
  return {
    id: seed.id,
    email: seed.email.toLowerCase(),
    passwordHash,
    salt,
    role: seed.role,
    firstName: seed.firstName ?? firstName ?? '',
    lastName: seed.lastName ?? lastName ?? '',
    phone: seed.phone || '',
    address: '',
    emergencyName: '',
    emergencyPhone: '',
    avatar: '',
    points: seed.role === 'owner' ? 50 : 0,
    vehicle: seed.vehicle || '',
    plateNumber: seed.plateNumber || '',
    licenseNumber: seed.licenseNumber || '',
    licenseExpiry: seed.licenseExpiry || '',
    active: true,
    createdAt: existing?.createdAt || new Date().toISOString(),
  };
}

/** All app roles — canonical accounts in dbo.users (no frontend fixtures). */
export const ROLE_SEED_USERS = [
  {
    id: 'owner-seed',
    email: 'owner@petcare.local',
    password: 'Owner1234',
    role: 'owner',
    firstName: 'มานี',
    lastName: 'รักสัตว์',
    phone: '0810001111',
  },
  {
    id: 'admin-seed',
    email: 'admin@petcare.local',
    password: 'Admin1234',
    role: 'admin',
    firstName: 'Admin',
    lastName: 'PetCare',
    phone: '0200000000',
  },
  {
    id: 'driver-seed',
    email: 'driver@petcare.local',
    password: '1234',
    role: 'driver',
    firstName: 'สมชาย',
    lastName: 'คนขับ',
    phone: '0890001122',
    vehicle: 'รถตู้',
    plateNumber: 'สก 1234',
    licenseNumber: 'DL-88001234',
    licenseExpiry: '2028-12-31',
  },
  {
    id: 'accountant-seed',
    email: 'accountant@petcare.local',
    password: 'Account1234',
    role: 'accountant',
    firstName: 'ฝ่าย',
    lastName: 'บัญชี',
    phone: '0200000001',
  },
  {
    id: 'super-admin-seed',
    email: 'superadmin@petcare.local',
    password: '1234',
    role: 'super_admin',
    firstName: 'Super',
    lastName: 'Admin',
    phone: '0200000002',
  },
  {
    id: 'find-home-seed',
    email: 'findhome@petcare.local',
    password: 'FindHome1234',
    role: 'find_home',
    firstName: 'ผู้ใช้',
    lastName: 'หาบ้าน',
    phone: '0810002222',
  },
  {
    id: 'adoption-staff-seed',
    email: 'adoption@petcare.local',
    password: 'Adoption1234',
    role: 'adoption_staff',
    firstName: 'พนักงาน',
    lastName: 'หาบ้านสัตว์',
    phone: '0200000003',
  },
  {
    id: 'staff-vet-1',
    email: 'vet1@petcare.clinic',
    password: 'vet12345',
    role: 'veterinarian',
    name: 'สพ.ญ.ณัฐชา ใจดี',
  },
  {
    id: 'staff-vet-2',
    email: 'vet2@petcare.clinic',
    password: 'vet12345',
    role: 'veterinarian',
    name: 'น.สพ.วิทยา รักสัตว์',
  },
  {
    id: 'staff-vet-3',
    email: 'vet3@petcare.clinic',
    password: 'vet12345',
    role: 'veterinarian',
    name: 'สพ.ญ.พิมพ์ชนก แสนสุข',
  },
  {
    id: 'staff-vet-4',
    email: 'vet4@petcare.clinic',
    password: 'vet12345',
    role: 'veterinarian',
    name: 'น.สพ.ธนกฤต ใจเย็น',
  },
  {
    id: 'staff-ma-1',
    email: 'ma1@petcare.clinic',
    password: 'vet12345',
    role: 'medical_assistant',
    name: 'สมใจ ช่วยดี',
  },
  {
    id: 'staff-ma-2',
    email: 'ma2@petcare.clinic',
    password: 'vet12345',
    role: 'medical_assistant',
    name: 'กมล ใส่ใจ',
  },
  {
    id: 'staff-admin-1',
    email: 'admin@petcare.clinic',
    password: 'vet12345',
    role: 'clinic_admin',
    name: 'ผู้ดูแลคลินิก',
  },
];

export async function seedRoleUsers() {
  for (const seed of ROLE_SEED_USERS) {
    const existing = await findUserByEmail(seed.email);
    if (existing) continue;
    const byId = await queryOne('SELECT id FROM dbo.users WHERE id = ?', [seed.id]);
    if (byId) continue;
    await upsertUser(await buildUser(seed));
  }
}
