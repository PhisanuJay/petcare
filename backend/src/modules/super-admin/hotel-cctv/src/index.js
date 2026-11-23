const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { loadConfig } = require('./config');
const { openDatabase, query } = require('./db');
const { migrate } = require('./migrate');
const { errorMiddleware, asyncHandler } = require('./errors');
const { createAuth, requireRole } = require('./middleware');
const { authRoutes } = require('./routes/auth');
const { adminRoutes } = require('./routes/admin');
const { customerRoutes } = require('./routes/customer');
const { createMediaMtx, pathName } = require('./mediamtx');
const { listPlaybackAddresses, listPlaybackInterfaces } = require('./webrtc');
const { startCameraHealth } = require('./health');
const {
  createUser,
  findAdminUser,
  listEnabledSecrets,
  openUrl,
  setCameraStatus,
} = require('./store');

async function ensureAdmin(config) {
  let admin = await findAdminUser();
  if (!admin) {
    await createUser({
      email: config.adminEmail,
      password: config.adminPassword,
      role: 'admin',
      displayName: 'Admin',
    });
    console.log('สร้างบัญชีแอดมิน Admin');
    return;
  }
  // ไม่ทับรหัส/ชื่อที่แก้ในหน้าเว็บแล้ว ใช้ค่าใน .env เฉพาะตอนสร้างแอดมินครั้งแรก
}

// ให้ข้อมูลในฐานข้อมูลกับ MediaMTX ตรงกันหลังรีสตาร์ท
async function syncMedia(config, mtx) {
  try {
    const lan = listPlaybackAddresses();
    const hosts = lan.length ? [...lan] : ['127.0.0.1'];
    if (config.webrtcHost && config.webrtcHost !== '127.0.0.1') hosts.push(config.webrtcHost);
    await mtx.patchGlobal(hosts, listPlaybackInterfaces());
  } catch (error) {
    console.error(`WebRTC host was not applied: ${error.message}`);
  }

  const enabled = await listEnabledSecrets();
  const keep = new Set(enabled.map((row) => pathName(row.id)));
  let existing = [];
  try {
    existing = await mtx.listConfigNames();
  } catch (error) {
    console.error(`MediaMTX path list failed: ${error.message}`);
  }

  for (const name of existing) {
    if (!name.startsWith('cam') || keep.has(name)) continue;
    const id = name.slice(3);
    if (/^\d+$/.test(id)) await mtx.deletePath(id);
  }

  for (const row of enabled) {
    try {
      await mtx.upsertPath(row.id, openUrl(row.rtsp_url_enc, config.cameraKey));
    } catch (error) {
      await setCameraStatus(row.id, 'offline', error.message || 'ตั้งค่าตัวกลางภาพไม่สำเร็จ');
    }
  }
}

async function main() {
  const config = loadConfig();
  openDatabase(config.sqlitePath);
  migrate();
  await ensureAdmin(config);
  const mtx = createMediaMtx({ apiUrl: config.mediamtxApi, whepUrl: config.mediamtxWhep });
  const requireAuth = createAuth(config);

  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cookieParser());
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', asyncHandler(async (req, res) => {
    let db = 'down';
    try {
      query('SELECT 1');
      db = 'up';
    } catch {
      db = 'down';
    }
    let mediamtx = 'down';
    try {
      const response = await fetch(`${config.mediamtxApi}/v3/config/global/get`);
      mediamtx = response.ok ? 'up' : 'down';
    } catch {
      mediamtx = 'down';
    }
    res.status(db === 'up' ? 200 : 503).json({ ok: db === 'up', db, mediamtx });
  }));

  app.use('/api/auth', authRoutes(config, requireAuth));
  app.use('/api/admin', requireAuth, requireRole('admin', 'staff'), adminRoutes(config, mtx));
  app.use('/api', requireAuth, requireRole('customer'), customerRoutes(config, mtx));

  app.use(errorMiddleware);

  app.listen(config.port, () => {
    console.log(`API listening on ${config.port}`);
    syncMedia(config, mtx).catch((error) => {
      console.error(`MediaMTX sync failed: ${error.message}`);
    });
    startCameraHealth({ config, mtx, everyMs: 20000 });
  });
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
