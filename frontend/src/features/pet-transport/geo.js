/**
 * Parse Google Maps (and plain lat,lng) links → coordinates.
 * Straight-line distance via Haversine (MVP, no Maps API key).
 */

const SHORT_HOSTS = /(?:maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/maps)/i;

function asCoord(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  if (la < -90 || la > 90 || ln < -180 || ln > 180) return null;
  return { lat: la, lng: ln };
}

/** Prefer the most specific pin (!3d!4d) then @lat,lng then query params. */
export function parseMapsUrl(raw) {
  const text = String(raw || '').trim();
  if (!text) return { ok: false, error: 'ว่างเปล่า' };

  if (SHORT_HOSTS.test(text)) {
    return {
      ok: false,
      error: 'ลิงก์สั้นใช้ไม่ได้ในเบราว์เซอร์ — เปิดใน Google Maps แล้วคัดลอก “ลิงก์เต็ม” แทน',
    };
  }

  // Plain "13.7563, 100.5018" or "13.7563 100.5018"
  const plain = text.match(/^(-?\d{1,2}\.\d+)\s*[, ]\s*(-?\d{1,3}\.\d+)$/);
  if (plain) {
    const c = asCoord(plain[1], plain[2]);
    if (c) return { ok: true, ...c, source: 'plain' };
  }

  let url;
  try {
    url = new URL(text.startsWith('http') ? text : `https://${text}`);
  } catch {
    return { ok: false, error: 'รูปแบบลิงก์ไม่ถูกต้อง' };
  }

  const href = url.href;

  // Place pin: !3dLAT!4dLNG (more accurate than map center)
  const pin = href.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (pin) {
    const c = asCoord(pin[1], pin[2]);
    if (c) return { ok: true, ...c, source: 'pin' };
  }

  // /@lat,lng,zoom
  const at = href.match(/@(-?\d+\.\d+),(-?\d+\.\d+)(?:,|$)/);
  if (at) {
    const c = asCoord(at[1], at[2]);
    if (c) return { ok: true, ...c, source: 'at' };
  }

  // /maps/dir/lat,lng/lat,lng or place names mixed — take first coord pair in path
  const dir = href.match(/\/maps\/dir\/[^/]*?(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (dir) {
    const c = asCoord(dir[1], dir[2]);
    if (c) return { ok: true, ...c, source: 'dir' };
  }

  const q =
    url.searchParams.get('q')
    || url.searchParams.get('query')
    || url.searchParams.get('ll')
    || url.searchParams.get('destination')
    || url.searchParams.get('origin');

  if (q) {
    const m = String(q).match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    if (m) {
      const c = asCoord(m[1], m[2]);
      if (c) return { ok: true, ...c, source: 'query' };
    }
  }

  return {
    ok: false,
    error: 'ไม่พบพิกัดในลิงก์ — ลองแชร์ตำแหน่งบนแผนที่แล้วคัดลอกลิงก์ที่มีตัวเลขละติจูด/ลองจิจูด',
  };
}

/** Earth distance in km (great-circle). */
export function haversineKm(a, b) {
  if (!a || !b) return null;
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function coordsOf(place) {
  if (!place) return null;
  const lat = Number(place.lat);
  const lng = Number(place.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** Round to 1 decimal for zone pricing display. */
export function formatDistanceKm(km) {
  if (km == null || !Number.isFinite(km)) return null;
  return Math.round(km * 10) / 10;
}
