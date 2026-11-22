/**
 * Resolve CCTV paths for both standalone (/) and monorepo (/super-admin).
 */
export function cctvBase(pathname = window.location.pathname) {
  return pathname.startsWith('/super-admin') ? '/super-admin' : '';
}

export function cctvPath(to, pathname = window.location.pathname) {
  if (!to.startsWith('/')) return to;
  return `${cctvBase(pathname)}${to}`;
}
