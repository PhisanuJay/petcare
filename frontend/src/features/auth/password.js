/**
 * Local-only password hashing for PetCare MVP (localStorage).
 * Always use FNV so login works on non-secure origins (http://192.168.x.x)
 * where crypto.subtle is unavailable. Still verifies legacy sha256 hashes
 * when Secure Context is available.
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

/** Always FNV — portable across localhost and LAN http. */
export async function hashPassword(password, salt) {
  const input = `${salt}:${password}`;
  return `fnv:${fnv1a(input)}`;
}

export async function verifyPassword(password, salt, stored) {
  if (!password || !salt || !stored || typeof stored !== 'string') return false;
  const input = `${salt}:${password}`;
  const [algo, ...rest] = stored.split(':');
  const digest = rest.join(':');

  if (algo === 'fnv') {
    return digest === fnv1a(input);
  }

  if (algo === 'sha256') {
    if (!globalThis.crypto?.subtle) return false;
    return digest === (await sha256(input));
  }

  // Legacy untagged hashes
  if (stored === `fnv:${fnv1a(input)}` || stored === fnv1a(input)) return true;
  if (globalThis.crypto?.subtle) {
    const hex = await sha256(input);
    return stored === hex || stored === `sha256:${hex}`;
  }
  return false;
}

/** True when stored hash should be rewritten to current FNV format. */
export function needsPasswordRehash(stored) {
  return typeof stored === 'string' && !stored.startsWith('fnv:');
}
