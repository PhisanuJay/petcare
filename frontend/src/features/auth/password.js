/**
 * Local-only password hashing. Hashes are tagged with their algorithm because
 * crypto.subtle is unavailable on non-secure origins (e.g. http://192.168.x.x).
 */
async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export async function hashPassword(password, salt) {
  const input = `${salt}:${password}`;
  if (globalThis.crypto?.subtle) return `sha256:${await sha256(input)}`;
  return `fnv:${fnv1a(input)}`;
}

export async function verifyPassword(password, salt, stored) {
  const [algo] = stored.split(':');
  const input = `${salt}:${password}`;
  if (algo === 'sha256') {
    if (!globalThis.crypto?.subtle) return false;
    return stored === `sha256:${await sha256(input)}`;
  }
  return stored === `fnv:${fnv1a(input)}`;
}
