/** dev: ว่างให้ยิง /api ผ่าน Vite proxy · prod: ชี้ backend */
export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? '' : 'http://localhost:3001')
).replace(/\/$/, '');
export const AUTH_API_URL = `${API_BASE_URL}/api/auth`;
