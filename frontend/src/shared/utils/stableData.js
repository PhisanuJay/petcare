/** Avoid setState when poll payload is unchanged (reduces UI flicker). */

export function stableStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function sameData(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  return stableStringify(a) === stableStringify(b);
}

/** setState helper: keep previous reference when equal */
export function keepIfSame(prev, next) {
  return sameData(prev, next) ? prev : next;
}

export function whenVisible(callback) {
  if (typeof document !== 'undefined' && document.hidden) return;
  callback();
}
