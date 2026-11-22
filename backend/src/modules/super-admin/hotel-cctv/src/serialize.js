function sqlToIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const text = String(value).replace(' ', 'T');
  const date = new Date(text.includes('+') || text.endsWith('Z') ? text : `${text}+07:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function publicCamera(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    roomLabel: row.room_label || '',
    catName: row.cat_name || '',
    isEnabled: Boolean(row.is_enabled),
    streamStatus: row.stream_status,
    streamPath: `cam${row.id}`,
    lastError: row.last_error || '',
    lastSeenAt: sqlToIso(row.last_seen_at),
    updatedAt: sqlToIso(row.updated_at),
  };
}

function publicUser(row) {
  const user = {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    isActive: Boolean(row.is_active),
  };
  if (row.permissions) user.permissions = row.permissions;
  return user;
}

function publicCare(row) {
  return {
    id: row.id,
    kind: row.kind,
    note: row.note || '',
    loggedAt: sqlToIso(row.logged_at),
    author: row.display_name || '',
    cameraId: row.camera_id || undefined,
    cameraName: row.camera_name || undefined,
    roomLabel: row.room_label || undefined,
    catName: row.cat_name || undefined,
  };
}

function publicGrant(row) {
  const now = Date.now();
  const startsAt = sqlToIso(row.starts_at);
  const endsAt = sqlToIso(row.ends_at);
  const revokedAt = sqlToIso(row.revoked_at);
  const startMs = startsAt ? new Date(startsAt).getTime() : 0;
  const endMs = endsAt ? new Date(endsAt).getTime() : 0;
  const isActive = !revokedAt && startMs <= now && endMs > now && (row.user_active === undefined || Boolean(row.user_active));
  return {
    id: row.id,
    cameraId: row.camera_id,
    userId: row.user_id,
    email: row.email || '',
    displayName: row.display_name || '',
    petName: row.pet_name || '',
    roomLabel: row.room_label || row.camera_room || '',
    cameraName: row.camera_name || '',
    cameraCat: row.camera_cat || row.cat_name || '',
    cameraRoom: row.camera_room || '',
    streamStatus: row.stream_status || '',
    isEnabled: row.is_enabled === undefined ? undefined : Boolean(row.is_enabled),
    startsAt,
    endsAt,
    revokedAt,
    createdAt: sqlToIso(row.created_at),
    isActive,
  };
}

module.exports = { publicCamera, publicUser, publicCare, publicGrant, sqlToIso };
