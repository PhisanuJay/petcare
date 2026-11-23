const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

function required(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`ต้องตั้งค่า ${name} ในไฟล์ .env`);
  }
  return String(value).trim();
}

function loadConfig() {
  const cameraSecret = required('CAMERA_SECRET');
  if (!/^[0-9a-fA-F]{64}$/.test(cameraSecret)) {
    throw new Error('CAMERA_SECRET ต้องเป็นตัวอักษรฐานสิบหก 64 ตัว สร้างด้วย crypto.randomBytes(32)');
  }
  const jwtSecret = required('JWT_SECRET');
  if (jwtSecret.length < 24 || jwtSecret.includes('replace-with')) {
    throw new Error('JWT_SECRET ต้องเป็นข้อความสุ่มยาวอย่างน้อย 24 ตัว');
  }
  const adminPassword = required('ADMIN_PASSWORD');
  if (adminPassword.length < 4 || adminPassword.includes('replace-this')) {
    throw new Error('ADMIN_PASSWORD ต้องยาวอย่างน้อย 4 ตัว และห้ามใช้ค่ารางในตัวอย่าง');
  }

  return {
    port: Number(process.env.PORT || 3000),
    sqlitePath: process.env.SQLITE_PATH
      ? path.resolve(process.env.SQLITE_PATH)
      : path.resolve(__dirname, '../../data/cathotel.sqlite'),
    jwtSecret,
    cameraKey: Buffer.from(cameraSecret, 'hex'),
    adminEmail: required('ADMIN_EMAIL').toLowerCase(),
    adminPassword,
    hotelName: process.env.HOTEL_NAME || 'Pet Hotel',
    allowlist: (process.env.CAMERA_RTSP_ALLOWLIST || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    webrtcHost: process.env.WEBRTC_ADDITIONAL_HOST || '127.0.0.1',
    webrtcUdpPort: Number(process.env.WEBRTC_UDP_PORT || 8189),
    mediamtxApi: process.env.MEDIAMTX_API_URL || 'http://127.0.0.1:9997',
    mediamtxWhep: process.env.MEDIAMTX_WHEP_URL || 'http://127.0.0.1:8889',
    streamSessionSeconds: Number(process.env.STREAM_SESSION_SECONDS || 120),
    cookieSecure: process.env.COOKIE_SECURE === 'true',
    nodeEnv: process.env.NODE_ENV || 'development',
  };
}

module.exports = { loadConfig };
