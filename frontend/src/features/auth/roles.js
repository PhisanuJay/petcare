/** App roles for PetCare auth (localStorage MVP). */

export const ROLES = {
  owner: 'owner',
  admin: 'admin',
  driver: 'driver',
<<<<<<< HEAD
  accountant: 'accountant',
=======
  finance: 'finance',
>>>>>>> origin/Pet-Transport
};

export const ROLE_LABELS = {
  owner: 'เจ้าของสัตว์เลี้ยง',
  admin: 'แอดมิน',
  driver: 'พนักงานขับรถ',
<<<<<<< HEAD
  accountant: 'ฝ่ายบัญชี',
=======
  finance: 'ฝ่ายการเงิน',
>>>>>>> origin/Pet-Transport
};

/** Default landing path after login. */
export function homePathForRole(role) {
  if (role === ROLES.admin) return '/admin/transport';
  if (role === ROLES.driver) return '/pet-transport';
<<<<<<< HEAD
  if (role === ROLES.accountant) return '/accounting';
=======
  if (role === ROLES.finance) return '/finance';
>>>>>>> origin/Pet-Transport
  return '/';
}

/** Whether a role may open a pathname. */
export function canAccessPath(role, pathname) {
  const path = pathname || '/';

  if (role === ROLES.admin) {
    return path === '/admin' || path.startsWith('/admin/');
  }
  if (role === ROLES.driver) {
    return path === '/pet-transport' || path.startsWith('/pet-transport/');
  }
<<<<<<< HEAD
  if (role === ROLES.accountant) {
    return path === '/accounting' || path.startsWith('/accounting/');
  }
  // Owner: customer site only — not admin / driver / other staff shells
=======
  if (role === ROLES.finance) {
    return path === '/finance' || path.startsWith('/finance/');
  }
  // Owner: customer site only — not admin / driver / finance / other staff shells
>>>>>>> origin/Pet-Transport
  if (
    path.startsWith('/admin') ||
    path.startsWith('/pet-transport') ||
    path.startsWith('/finance') ||
    path.startsWith('/veterinarian') ||
    path.startsWith('/medical-assistant') ||
    path.startsWith('/pet-hotel') ||
    path.startsWith('/adoption') ||
    path.startsWith('/super-admin') ||
    path.startsWith('/pet-profile') ||
    path.startsWith('/accounting')
  ) {
    return false;
  }
  return true;
}

export function normalizeRole(role) {
<<<<<<< HEAD
  if (role === ROLES.admin || role === ROLES.driver || role === ROLES.owner || role === ROLES.accountant) return role;
=======
  if (
    role === ROLES.admin
    || role === ROLES.driver
    || role === ROLES.owner
    || role === ROLES.finance
  ) {
    return role;
  }
>>>>>>> origin/Pet-Transport
  return ROLES.owner;
}
