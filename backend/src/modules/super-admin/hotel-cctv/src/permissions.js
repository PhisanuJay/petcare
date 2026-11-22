const PERMISSIONS = [
  { key: 'view_cameras', label: 'ดูภาพกล้อง / ภาพรวม' },
  { key: 'manage_cameras', label: 'เพิ่ม แก้ไข ลบกล้อง' },
  { key: 'care_logs', label: 'บันทึกการดูแลสัตว์' },
  { key: 'manage_rooms', label: 'จัดการห้อง' },
  { key: 'manage_customers', label: 'จัดการบัญชีลูกค้า' },
  { key: 'manage_grants', label: 'ให้สิทธิ์ลูกค้าดูกล้อง' },
  { key: 'view_logs', label: 'ดูบันทึกกิจกรรม' },
  { key: 'view_settings', label: 'ดูตั้งค่าระบบ' },
];

const PERMISSION_KEYS = PERMISSIONS.map((item) => item.key);

const DEFAULT_STAFF_PERMISSIONS = {
  view_cameras: true,
  manage_cameras: false,
  care_logs: true,
  manage_rooms: false,
  manage_customers: false,
  manage_grants: false,
  view_logs: false,
  view_settings: false,
};

const ALL_PERMISSIONS = Object.fromEntries(PERMISSION_KEYS.map((key) => [key, true]));

function normalizePermissions(input = {}) {
  const next = { ...DEFAULT_STAFF_PERMISSIONS };
  for (const key of PERMISSION_KEYS) {
    if (input[key] !== undefined) next[key] = Boolean(input[key]);
  }
  // จัดการกล้องต้องดูกล้องได้ด้วย
  if (next.manage_cameras) next.view_cameras = true;
  return next;
}

function permissionsFromRow(row) {
  if (!row) return { ...DEFAULT_STAFF_PERMISSIONS };
  return normalizePermissions({
    view_cameras: row.view_cameras,
    manage_cameras: row.manage_cameras,
    care_logs: row.care_logs,
    manage_rooms: row.manage_rooms,
    manage_customers: row.manage_customers,
    manage_grants: row.manage_grants,
    view_logs: row.view_logs,
    view_settings: row.view_settings,
  });
}

function hasPermission(user, key) {
  if (!user || !user.is_active) return false;
  if (user.role === 'admin') return true;
  if (user.role !== 'staff') return false;
  return Boolean(user.permissions && user.permissions[key]);
}

module.exports = {
  PERMISSIONS,
  PERMISSION_KEYS,
  DEFAULT_STAFF_PERMISSIONS,
  ALL_PERMISSIONS,
  normalizePermissions,
  permissionsFromRow,
  hasPermission,
};
