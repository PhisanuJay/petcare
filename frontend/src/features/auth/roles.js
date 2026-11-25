/** App roles for PetCare auth (localStorage MVP). */

export const ROLES = {
  owner: 'owner',
  admin: 'admin',
  driver: 'driver',
  accountant: 'accountant',
};

export const ROLE_LABELS = {
  owner: 'เจ้าของสัตว์เลี้ยง',
  admin: 'แอดมิน',
  driver: 'พนักงานขับรถ',
  accountant: 'ฝ่ายบัญชี',
};

/** Default landing path after login. */
export function homePathForRole(role) {
  if (role === ROLES.admin) return '/admin/transport';
  if (role === ROLES.driver) return '/pet-transport';
  if (role === ROLES.accountant) return '/accounting';
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
  if (role === ROLES.accountant) {
    return path === '/accounting' || path.startsWith('/accounting/');
  }
  // Owner: customer site only — not admin / driver / other staff shells
  if (
    path.startsWith('/admin') ||
    path.startsWith('/pet-transport') ||
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
  if (role === ROLES.admin || role === ROLES.driver || role === ROLES.owner || role === ROLES.accountant) return role;
  return ROLES.owner;
}
