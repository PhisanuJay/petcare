export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
export const AUTH_API_URL = `${API_BASE_URL}/api/auth`;
