import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Staff accounts kept in the backend (no sign-up: staff are already in the system).
 * DEVELOPMENT DATA ONLY — the passwords below are plain text in the source so the team can log in.
 * Replace this list with a real accounts table before the system is used outside development.
 *
 * `role` decides which pages a staff member may open: 'veterinarian' (more roles can be added later,
 * e.g. 'medical_assistant').
 */
const DEV_PASSWORD = 'vet12345';

const DEV_STAFF = [
  { id: 'staff-vet-1', name: 'สพ.ญ.ณัฐชา ใจดี', email: 'vet1@petcare.clinic', role: 'veterinarian' },
  { id: 'staff-vet-2', name: 'น.สพ.วิทยา รักสัตว์', email: 'vet2@petcare.clinic', role: 'veterinarian' },
  { id: 'staff-vet-3', name: 'สพ.ญ.พิมพ์ชนก แสนสุข', email: 'vet3@petcare.clinic', role: 'veterinarian' },
];

const hashPassword = (password, salt) => scryptSync(password, salt, 32);

const accounts = DEV_STAFF.map((staff) => {
  const salt = randomBytes(16);
  return { ...staff, salt, passwordHash: hashPassword(DEV_PASSWORD, salt) };
});

/** What the frontend may know about a staff member (never the password hash). */
export const toPublicStaff = ({ id, name, email, role }) => ({ id, name, email, role });

export function findStaffById(id) {
  return accounts.find((a) => a.id === id) ?? null;
}

/** The matching account when the email and password are right, otherwise null. */
export function checkStaffLogin(email, password) {
  const account = accounts.find((a) => a.email === String(email ?? '').trim().toLowerCase());
  // Hash even when the email is unknown so both cases take about the same time.
  const hash = hashPassword(String(password ?? ''), account?.salt ?? Buffer.alloc(16));
  if (!account || !timingSafeEqual(hash, account.passwordHash)) return null;
  return account;
}
