/** App roles for PetCare auth (localStorage MVP). */

export const ROLES = {
  owner: 'owner',
  admin: 'admin',
  driver: 'driver',
  accountant: 'accountant',
  finance: 'finance',
};

export const ROLE_LABELS = {
  owner: 'เจ้าของสัตว์เลี้ยง',
  admin: 'แอดมิน',
  driver: 'พนักงานขับรถ',
  accountant: 'ฝ่ายบัญชี',
  finance: 'ฝ่ายการเงิน',
};

/** Default landing path after login. */
export function homePathForRole(role) {
  if (role === ROLES.admin) return '/admin/transport';
  if (role === ROLES.driver) return '/pet-transport';
  if (role === ROLES.accountant) return '/accounting';
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
  if (role === ROLES.accountant) {
    return path === '/accounting' || path.startsWith('/accounting/');
  }
  if (role === ROLES.finance) {
    return path === '/finance' || path.startsWith('/finance/');
  }
  if (role !== ROLES.owner) return false;

  return ![
    '/admin',
    '/accounting',
    '/finance',
    '/pet-transport',
    '/veterinarian',
    '/medical-assistant',
    '/clinic-admin',
    '/pet-hotel',
    '/adoption',
    '/super-admin',
    '/pet-profile',
  ].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function normalizeRole(role) {
  return Object.values(ROLES).includes(role) ? role : ROLES.owner;
}
