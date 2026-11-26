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

/**
 * Admin เหลือ 2 ฝั่งตามธุรกิจ — ไม่แตกแอดมินยิบย่อยตามเมนู
 * - hotel: โรงแรม + รับส่ง + คนขับ + CCTV + หาบ้าน (โต๊ะงานใน /admin/adoption)
 * - clinic: คลินิก (staff session clinic_admin) — vet เป็นพนักงาน; งานหน้าร้านรวมในแอดมินคลินิก
 */
export const ADMIN_SIDES = {
  hotel: {
    role: 'admin',
    label: 'แอดมินโรงแรม',
    home: '/admin/stays',
  },
  clinic: {
    role: 'clinic_admin',
    label: 'แอดมินคลินิก',
    home: '/clinic-admin',
  },
};

export const ROLE_LABELS = {
  owner: 'เจ้าของสัตว์เลี้ยง',
  admin: 'แอดมินโรงแรม',
  driver: 'พนักงานขับรถ (โรงแรม)',
  accountant: 'ฝ่ายบัญชี',
  super_admin: 'Super Admin',
  find_home: 'หาบ้าน',
  adoption_staff: 'พนักงานหาบ้านสัตว์',
  veterinarian: 'สัตวแพทย์ (คลินิก)',
  medical_assistant: 'ผู้ช่วยสัตวแพทย์',
  clinic_admin: 'แอดมินคลินิก',
};

/** Default landing path after login — Admin 2 ฝั่ง: โรงแรม + คลินิก */
export function homePathForRole(role) {
  if (role === ROLES.admin) return ADMIN_SIDES.hotel.home;
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
    return path === '/admin'
      || path.startsWith('/admin/')
      || path === '/pet-hotel'
      || path.startsWith('/pet-hotel/');
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
