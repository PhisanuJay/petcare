/** App roles for PetCare auth (dbo.users). */

export const ROLES = {
  owner: 'owner',
  admin: 'admin',
  driver: 'driver',
  accountant: 'accountant',
  super_admin: 'super_admin',
  find_home: 'find_home',
  adoption_staff: 'adoption_staff',
};

export const ROLE_LABELS = {
  owner: 'เจ้าของสัตว์เลี้ยง',
  admin: 'แอดมิน',
  driver: 'พนักงานขับรถ',
  accountant: 'ฝ่ายบัญชี',
  super_admin: 'Super Admin',
  find_home: 'หาบ้าน',
  adoption_staff: 'พนักงานหาบ้านสัตว์',
};

/** Default landing path after login. */
export function homePathForRole(role) {
  if (role === ROLES.admin) return '/admin/transport';
  if (role === ROLES.driver) return '/pet-transport';
  if (role === ROLES.accountant) return '/accounting';
  if (role === ROLES.super_admin) return '/super-admin';
  if (role === ROLES.find_home) return '/find-home';
  if (role === ROLES.adoption_staff) return '/adoption';
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
  if (role === ROLES.super_admin) {
    return path === '/super-admin' || path.startsWith('/super-admin/');
  }
  if (role === ROLES.find_home) {
    return path === '/find-home'
      || path.startsWith('/find-home/')
      || path === '/profile'
      || path.startsWith('/profile/');
  }
  if (role === ROLES.adoption_staff) {
    return path === '/adoption' || path.startsWith('/adoption/');
  }
  if (role !== ROLES.owner) return false;

  return ![
    '/admin',
    '/accounting',
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
