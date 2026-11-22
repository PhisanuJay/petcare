function asDate(value) {
  if (value instanceof Date) return value;
  const text = String(value || '').trim().replace(' ', 'T');
  if (!text) return new Date(NaN);
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(text)) return new Date(text);
  return new Date(`${text}+07:00`);
}

function isGrantActive(grant, now) {
  if (!grant || grant.revoked_at) return false;
  const start = asDate(grant.starts_at);
  const end = asDate(grant.ends_at);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return start <= now && end > now;
}

function isSessionUsable(session, grant, now) {
  if (!session || session.revoked_at) return false;
  const expires = asDate(session.expires_at);
  if (Number.isNaN(expires.getTime()) || expires <= now) return false;
  if (Number(session.user_id) !== Number(grant && grant.user_id)) return false;
  if (Number(session.camera_id) !== Number(grant && grant.camera_id)) return false;
  return isGrantActive(grant, now);
}

function interpretPath(info) {
  if (!info) return 'unknown';
  const hasPicture = Number(info.inboundBytes || info.bytesReceived || 0) > 0
    || (Array.isArray(info.tracks2) && info.tracks2.length > 0)
    || (Array.isArray(info.tracks) && info.tracks.length > 0);
  const clockStarted = info.onlineTime && !String(info.onlineTime).startsWith('0001-');
  if (info.ready === true || info.available === true || (info.online === true && clockStarted && hasPicture)) return 'online';
  if (Array.isArray(info.readers) && info.readers.length > 0) return 'connecting';
  return 'unknown';
}

module.exports = { isGrantActive, isSessionUsable, interpretPath };
