/** App roles for PetCare auth (localStorage MVP). */

export const ROLES = {
  owner: 'owner',
  admin: 'admin',
  driver: 'driver',
  finance: 'finance',
};

export const ROLE_LABELS = {
  owner: 'เจ้าของสัตว์เลี้ยง',
  admin: 'แอดมิน',
  driver: 'พนักงานขับรถ',
  finance: 'ฝ่ายการเงิน',
};

/** Default landing path after login. */
export function homePathForRole(role) {
  if (role === ROLES.admin) return '/admin/transport';
  if (role === ROLES.driver) return '/pet-transport';
  if (role === ROLES.finance) return '/finance';
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
  if (role === ROLES.finance) {
    return path === '/finance' || path.startsWith('/finance/');
  }
  // Owner: customer site only — not admin / driver / finance / other staff shells
  if (
    path.startsWith('/admin') ||
    path.startsWith('/pet-transport') ||
    path.startsWith('/finance') ||
    path.startsWith('/veterinarian') ||
    path.startsWith('/medical-assistant') ||
    path.startsWith('/pet-hotel') ||
    path.startsWith('/adoption') ||
    path.startsWith('/super-admin') ||
    path.startsWith('/pet-profile')
  ) {
    return false;
  }
  return true;
}

export function normalizeRole(role) {
  if (
    role === ROLES.admin
    || role === ROLES.driver
    || role === ROLES.owner
    || role === ROLES.finance
  ) {
    return role;
  }
  return ROLES.owner;
}
