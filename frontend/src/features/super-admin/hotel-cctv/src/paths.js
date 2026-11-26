/**
 * Resolve CCTV paths for standalone (/) and monorepo (/super-admin/cctv).
 */
export function cctvBase(pathname = window.location.pathname) {
  if (pathname.startsWith('/super-admin/cctv')) return '/super-admin/cctv';
  if (pathname.startsWith('/super-admin')) return '/super-admin/cctv';
  return '';
}

export function cctvPath(to, pathname = window.location.pathname) {
  if (!to.startsWith('/')) return to;
  return `${cctvBase(pathname)}${to}`;
}
