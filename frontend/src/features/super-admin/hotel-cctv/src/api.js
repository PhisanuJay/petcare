export async function api(path, options = {}) {
  let requestPath = path;
  const pathname = path.split('?')[0];
  if (path.startsWith('/api/auth/')) {
    requestPath = path.replace('/api/auth/', '/api/cctv-auth/');
  } else if (
    pathname === '/api/admin/rooms'
    || pathname === '/api/admin/rooms/rename'
    || pathname === '/api/admin/customers'
    || pathname === '/api/admin/grants'
    || /^\/api\/admin\/grants\/\d+$/.test(pathname)
    || /^\/api\/admin\/cameras(?:\/\d+(?:\/(?:toggle|recheck|grants))?)?$/.test(pathname)
  ) {
    requestPath = path.replace('/api/admin/', '/api/cctv-admin/');
  }
  const response = await fetch(requestPath, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    method: options.method || 'GET',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error?.message || 'เกิดข้อผิดพลาด');
    error.status = response.status;
    error.code = data.error?.code;
    throw error;
  }
  return data;
}

export function formatWhen(value) {
  if (!value) return 'ยังไม่เคยตรวจพบ';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'ยังไม่เคยตรวจพบ';
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(date);
}

export function statusLabel(status) {
  if (status === 'online') return 'ออนไลน์';
  if (status === 'connecting') return 'กำลังเชื่อมต่อ';
  return 'ออฟไลน์';
}

export function bangkokInput(date) {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return parts.replace(' ', 'T');
}
