const express = require('express');
const { z } = require('zod');
const { asyncHandler, HttpError } = require('../errors');
const { validateRtspUrl } = require('../security/rtsp');
const { listLocalCidrs } = require('../lan');
const { probeRtsp } = require('../security/probe');
const { publicCamera, publicUser, publicCare, publicGrant, sqlToIso } = require('../serialize');
const { readViewerHost, filterOfferSdp, choosePlaybackAddress, rewriteAnswerCandidates, listPlaybackAddresses, listPlaybackInterfaces } = require('../webrtc');
const { applyStreamWithRetry, rtspFingerprint, streamInfo } = require('../cameraConnect');
const { pathName } = require('../mediamtx');
const { requireRole } = require('../middleware');
const { PERMISSIONS, DEFAULT_STAFF_PERMISSIONS, hasPermission } = require('../permissions');
const {
  listCameras,
  getCamera,
  getCameraSecret,
  findCameraByFingerprint,
  insertCamera,
  updateCameraRow,
  setCameraStatus,
  deleteCamera,
  cameraSummary,
  listCustomers,
  createUser,
  updateCustomer,
  listStaff,
  createStaff,
  updateStaff,
  listGrants,
  createGrant,
  revokeGrant,
  listCareToday,
  listCareLogs,
  addCareLog,
  deleteCareLog,
  listAllCameras,
  renameRoomLabel,
  listAllGrants,
  listEnabledSecrets,
  sealUrl,
  openUrl,
} = require('../store');

const text = z.string().trim();

const cameraBody = z.object({
  name: text.min(1, 'ต้องใส่ชื่อกล้อง').max(120, 'ชื่อกล้องยาวเกินไป'),
  description: text.max(500, 'คำอธิบายยาวเกินไป').optional().default(''),
  roomLabel: text.max(120, 'ชื่อห้องยาวเกินไป').optional().default(''),
  catName: text.max(120, 'ชื่อแมวยาวเกินไป').optional().default(''),
  isEnabled: z.boolean().optional().default(true),
  rtspUrl: text.max(1000, 'RTSP URL ยาวเกินไป').optional(),
});

const cameraUpdate = z.object({
  name: text.min(1, 'ต้องใส่ชื่อกล้อง').max(120, 'ชื่อกล้องยาวเกินไป').optional(),
  description: text.max(500, 'คำอธิบายยาวเกินไป').optional(),
  roomLabel: text.max(120, 'ชื่อห้องยาวเกินไป').optional(),
  catName: text.max(120, 'ชื่อแมวยาวเกินไป').optional(),
  isEnabled: z.boolean().optional(),
  rtspUrl: text.max(1000, 'RTSP URL ยาวเกินไป').optional(),
});

function idParam(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'BAD_INPUT', 'รหัสไม่ถูกต้อง');
  return id;
}

function pageQuery(req) {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 12);
  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: Number.isInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : 12,
    q: String(req.query.q || '').trim().slice(0, 120),
    status: ['online', 'offline', 'connecting'].includes(req.query.status) ? req.query.status : '',
  };
}

function sdpParser(req, res, next) {
  express.text({ type: '*/*', limit: '64kb' })(req, res, next);
}

async function requireCamera(id) {
  const camera = await getCamera(id);
  if (!camera) throw new HttpError(404, 'NOT_FOUND', 'ไม่พบกล้อง');
  return camera;
}

function staffPermissionGate(req, res, next) {
  if (!req.user) {
    next(new HttpError(401, 'UNAUTHORIZED', 'กรุณาเข้าสู่ระบบ'));
    return;
  }
  if (req.user.role === 'admin') {
    next();
    return;
  }
  if (req.user.role !== 'staff') {
    next(new HttpError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์ทำรายการนี้'));
    return;
  }

  const path = req.path;
  const method = req.method;
  let needed = 'view_cameras';

  if (path.startsWith('/staff') || path === '/permissions') {
    next(new HttpError(403, 'FORBIDDEN', 'เฉพาะแอดมินจัดการพนักงานได้'));
    return;
  }
  if (path.startsWith('/customers')) needed = 'manage_customers';
  else if (path.includes('/grants') || path.startsWith('/grants')) needed = 'manage_grants';
  else if (path === '/care') needed = 'view_logs';
  else if (path.startsWith('/system')) needed = 'view_settings';
  else if (path === '/rooms/rename') needed = 'manage_rooms';
  else if (path === '/rooms') needed = method === 'GET' ? 'view_cameras' : 'manage_rooms';
  else if (path.includes('/care')) needed = method === 'GET' ? 'view_cameras' : 'care_logs';
  else if (path.startsWith('/cameras') || path === '/summary') {
    if (method === 'GET') needed = 'view_cameras';
    else if (path.endsWith('/whep') || path.endsWith('/session')) needed = 'view_cameras';
    else needed = 'manage_cameras';
  }

  if (!hasPermission(req.user, needed)) {
    next(new HttpError(403, 'FORBIDDEN', 'บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้'));
    return;
  }
  next();
}

function adminRoutes(config, mtx) {
  const router = express.Router();
  const adminOnly = requireRole('admin');

  router.get('/permissions', adminOnly, (req, res) => {
    res.json({ items: PERMISSIONS, defaults: DEFAULT_STAFF_PERMISSIONS });
  });

  router.get('/staff', adminOnly, asyncHandler(async (req, res) => {
    const rows = await listStaff();
    res.json({
      items: rows.map((row) => publicUser({
        id: row.id,
        email: row.email,
        display_name: row.display_name,
        role: row.role,
        is_active: row.is_active,
        permissions: row.permissions,
      })),
      permissions: PERMISSIONS,
    });
  }));

  router.post('/staff', adminOnly, asyncHandler(async (req, res) => {
    const body = z.object({
      email: z.string().trim().email('อีเมลไม่ถูกต้อง').max(255),
      displayName: text.min(1, 'ต้องใส่ชื่อพนักงาน').max(120),
      password: z.string().min(4, 'รหัสผ่านต้องมีอย่างน้อย 4 ตัว').max(200),
      permissions: z.record(z.boolean()).optional(),
    }).parse(req.body);
    const user = await createStaff({
      email: body.email.toLowerCase(),
      password: body.password,
      displayName: body.displayName,
      permissions: body.permissions,
    });
    res.status(201).json({
      user: publicUser({
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
        is_active: user.is_active,
        permissions: user.permissions,
      }),
      password: body.password,
    });
  }));

  router.patch('/staff/:id', adminOnly, asyncHandler(async (req, res) => {
    const body = z.object({
      displayName: text.min(1).max(120).optional(),
      isActive: z.boolean().optional(),
      password: z.string().min(4).max(200).optional(),
      permissions: z.record(z.boolean()).optional(),
    }).parse(req.body);
    const user = await updateStaff(idParam(req.params.id), body);
    res.json({
      user: publicUser({
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
        is_active: user.is_active,
        permissions: user.permissions,
      }),
      password: body.password || undefined,
    });
  }));

  router.use(staffPermissionGate);

  router.get('/summary', asyncHandler(async (req, res) => {
    res.json(await cameraSummary());
  }));

  router.get('/cameras', asyncHandler(async (req, res) => {
    const query = pageQuery(req);
    const { rows, total } = await listCameras(query);
    res.json({
      items: rows.map(publicCamera),
      total,
      page: query.page,
      pageSize: query.pageSize,
      summary: await cameraSummary(),
    });
  }));

  router.get('/cameras/:id', asyncHandler(async (req, res) => {
    const camera = await requireCamera(idParam(req.params.id));
    res.json({ camera: publicCamera(camera), stream: streamInfo(camera) });
  }));

  router.post('/cameras', asyncHandler(async (req, res) => {
    const body = cameraBody.parse(req.body);
    if (!body.rtspUrl) throw new HttpError(400, 'BAD_INPUT', 'ต้องใส่ RTSP URL');
    const checked = await validateRtspUrl(body.rtspUrl, config.allowlist, undefined, listLocalCidrs());
    if (!checked.ok) throw new HttpError(400, 'BAD_INPUT', checked.message);

    const fingerprint = rtspFingerprint(body.rtspUrl);
    const duplicate = await findCameraByFingerprint(fingerprint);
    if (duplicate) throw new HttpError(409, 'CONFLICT', 'กล้องที่อยู่นี้มีในระบบแล้ว');

    const id = await insertCamera({
      name: body.name,
      description: body.description,
      roomLabel: body.roomLabel,
      catName: body.catName,
      isEnabled: body.isEnabled,
      encryptedUrl: sealUrl(body.rtspUrl, config.cameraKey),
      fingerprint,
    });
    const camera = await applyStreamWithRetry(mtx, id, body.rtspUrl, body.isEnabled);
    res.status(201).json({
      camera: publicCamera(camera),
      stream: streamInfo(camera),
    });
  }));

  router.patch('/cameras/:id', asyncHandler(async (req, res) => {
    const id = idParam(req.params.id);
    const current = await getCameraSecret(id);
    if (!current) throw new HttpError(404, 'NOT_FOUND', 'ไม่พบกล้อง');
    const body = cameraUpdate.parse(req.body);
    const fields = {};
    if (body.name !== undefined) fields.name = body.name;
    if (body.description !== undefined) fields.description = body.description;
    if (body.roomLabel !== undefined) fields.room_label = body.roomLabel;
    if (body.catName !== undefined) fields.cat_name = body.catName;
    if (body.isEnabled !== undefined) fields.is_enabled = body.isEnabled ? 1 : 0;
    let rtspUrl = null;
    if (body.rtspUrl) {
      const checked = await validateRtspUrl(body.rtspUrl, config.allowlist, undefined, listLocalCidrs());
      if (!checked.ok) throw new HttpError(400, 'BAD_INPUT', checked.message);
      const fingerprint = rtspFingerprint(body.rtspUrl);
      const duplicate = await findCameraByFingerprint(fingerprint);
      if (duplicate && Number(duplicate.id) !== id) {
        throw new HttpError(409, 'CONFLICT', 'กล้องที่อยู่นี้มีในระบบแล้ว');
      }
      fields.rtsp_url_enc = sealUrl(body.rtspUrl, config.cameraKey);
      fields.rtsp_fingerprint = fingerprint;
      rtspUrl = body.rtspUrl;
    }
    await updateCameraRow(id, fields);
    const secret = await getCameraSecret(id);
    const enabledChanged = body.isEnabled !== undefined && Boolean(body.isEnabled) !== Boolean(current.is_enabled);
    let camera = await getCamera(id);
    if (rtspUrl || enabledChanged) {
      const nextUrl = rtspUrl || openUrl(secret.rtsp_url_enc, config.cameraKey);
      camera = await applyStreamWithRetry(mtx, id, nextUrl, Boolean(secret.is_enabled));
    }
    res.json({ camera: publicCamera(camera), stream: streamInfo(camera) });
  }));

  // เปิดหรือปิดกล้อง
  router.patch('/cameras/:id/toggle', asyncHandler(async (req, res) => {
    const id = idParam(req.params.id);
    const secret = await getCameraSecret(id);
    if (!secret) throw new HttpError(404, 'NOT_FOUND', 'ไม่พบกล้อง');
    const nextEnabled = !Boolean(secret.is_enabled);
    await updateCameraRow(id, { is_enabled: nextEnabled ? 1 : 0 });
    const rtspUrl = openUrl(secret.rtsp_url_enc, config.cameraKey);
    const camera = await applyStreamWithRetry(mtx, id, rtspUrl, nextEnabled);
    res.json({ camera: publicCamera(camera), stream: streamInfo(camera) });
  }));

  router.delete('/cameras/:id', asyncHandler(async (req, res) => {
    const id = idParam(req.params.id);
    const removed = await deleteCamera(id);
    if (!removed) throw new HttpError(404, 'NOT_FOUND', 'ไม่พบกล้อง');
    try {
      await mtx.deletePath(id);
    } catch (error) {
      console.error(`delete camera path failed: ${error.message}`);
    }
    res.json({ ok: true });
  }));

  // ทดสอบเชื่อมต่อ RTSP ของกล้องที่มีอยู่แล้ว
  router.post('/cameras/:id/test', asyncHandler(async (req, res) => {
    const id = idParam(req.params.id);
    const secret = await getCameraSecret(id);
    if (!secret) throw new HttpError(404, 'NOT_FOUND', 'ไม่พบกล้อง');
    const rtspUrl = openUrl(secret.rtsp_url_enc, config.cameraKey);
    const probe = await probeRtsp(rtspUrl);
    res.json({
      ok: probe.ok,
      message: probe.ok ? 'เชื่อมต่อกล้องได้' : (probe.message || 'เชื่อมต่อกล้องไม่ได้'),
    });
  }));

  // ตรวจสถานะจากฐานข้อมูลและ MediaMTX
  router.get('/cameras/:id/status', asyncHandler(async (req, res) => {
    const id = idParam(req.params.id);
    const camera = await requireCamera(id);
    const live = camera.is_enabled
      ? await mtx.pathState(id).catch(() => 'unknown')
      : 'offline';
    res.json({
      cameraId: camera.id,
      streamStatus: camera.stream_status,
      mediaPathState: live,
      isEnabled: Boolean(camera.is_enabled),
      lastError: camera.last_error || '',
      lastSeenAt: sqlToIso(camera.last_seen_at),
      streamPath: `cam${camera.id}`,
    });
  }));

  // ข้อมูลสำหรับเปิดภาพสด ไม่ส่ง RTSP กลับ
  router.get('/cameras/:id/stream', asyncHandler(async (req, res) => {
    const camera = await requireCamera(idParam(req.params.id));
    if (!camera.is_enabled) throw new HttpError(403, 'FORBIDDEN', 'กล้องถูกปิดใช้งาน');
    res.json({ stream: streamInfo(camera), camera: publicCamera(camera) });
  }));

  router.post('/cameras/:id/recheck', asyncHandler(async (req, res) => {
    const id = idParam(req.params.id);
    const secret = await getCameraSecret(id);
    if (!secret) throw new HttpError(404, 'NOT_FOUND', 'ไม่พบกล้อง');
    const rtspUrl = openUrl(secret.rtsp_url_enc, config.cameraKey);
    const camera = await applyStreamWithRetry(mtx, id, rtspUrl, Boolean(secret.is_enabled));
    res.json({ camera: publicCamera(camera), stream: streamInfo(camera) });
  }));

  router.post('/cameras/:id/whep', sdpParser, asyncHandler(async (req, res) => {
    const id = idParam(req.params.id);
    const camera = await getCamera(id);
    if (!camera) throw new HttpError(404, 'NOT_FOUND', 'ไม่พบกล้อง');
    if (!camera.is_enabled) throw new HttpError(403, 'FORBIDDEN', 'กล้องถูกปิดใช้งาน');
    const sdp = String(req.body || '');
    if (!sdp.includes('v=0')) throw new HttpError(400, 'BAD_INPUT', 'ข้อมูลภาพไม่ถูกต้อง');
    const viewer = readViewerHost(req.get('x-viewer-host')) || req.hostname;
    const preview = req.get('x-stream-preview') === '1';
    try {
      const address = choosePlaybackAddress(viewer, listPlaybackAddresses());
      const answer = await mtx.proxyWhep(id, filterOfferSdp(sdp), address);
      if (!preview) await setCameraStatus(id, 'online', null);
      const shaped = rewriteAnswerCandidates(answer, address, config.webrtcUdpPort);
      res.type('application/sdp').send(shaped);
    } catch (error) {
      if (!preview) await setCameraStatus(id, 'offline', error.message || 'เชื่อมต่อภาพสดไม่สำเร็จ');
      throw error;
    }
  }));

  router.get('/customers', asyncHandler(async (req, res) => {
    const rows = await listCustomers();
    res.json({ items: rows.map(publicUser) });
  }));

  router.post('/customers', asyncHandler(async (req, res) => {
    const body = z.object({
      email: z.string().trim().email('อีเมลไม่ถูกต้อง').max(255),
      displayName: text.min(1, 'ต้องใส่ชื่อลูกค้า').max(120, 'ชื่อยาวเกินไป'),
      password: z.string().min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัว').max(200),
    }).parse(req.body);
    const user = await createUser({
      email: body.email.toLowerCase(),
      password: body.password,
      role: 'customer',
      displayName: body.displayName,
    });
    res.status(201).json({ user: publicUser(user), password: body.password });
  }));

  router.patch('/customers/:id', asyncHandler(async (req, res) => {
    const body = z.object({
      displayName: text.min(1, 'ต้องใส่ชื่อลูกค้า').max(120).optional(),
      isActive: z.boolean().optional(),
      password: z.string().min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัว').max(200).optional(),
    }).parse(req.body);
    const user = await updateCustomer(idParam(req.params.id), body);
    res.json({ user: publicUser(user), password: body.password || undefined });
  }));

  router.get('/cameras/:id/care', asyncHandler(async (req, res) => {
    const id = idParam(req.params.id);
    await requireCamera(id);
    const rows = await listCareToday(id);
    res.json({ items: rows.map(publicCare) });
  }));

  router.post('/cameras/:id/care', asyncHandler(async (req, res) => {
    const id = idParam(req.params.id);
    await requireCamera(id);
    const body = z.object({
      kind: z.enum(['feed', 'water', 'play', 'health']),
      note: text.max(200, 'บันทึกยาวเกินไป').optional().default(''),
    }).parse(req.body);
    await addCareLog({ cameraId: id, kind: body.kind, note: body.note, userId: req.user.id });
    const rows = await listCareToday(id);
    res.status(201).json({ items: rows.map(publicCare) });
  }));

  router.delete('/cameras/:id/care/:logId', asyncHandler(async (req, res) => {
    const id = idParam(req.params.id);
    const logId = idParam(req.params.logId);
    await requireCamera(id);
    const removed = await deleteCareLog(id, logId);
    if (!removed) throw new HttpError(404, 'NOT_FOUND', 'ไม่พบรายการวันนี้ที่จะยกเลิก');
    const rows = await listCareToday(id);
    res.json({ items: rows.map(publicCare) });
  }));

  router.get('/cameras/:id/grants', asyncHandler(async (req, res) => {
    const camera = await requireCamera(idParam(req.params.id));
    const rows = await listGrants(camera.id);
    res.json({
      items: rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        email: row.email,
        displayName: row.display_name,
        petName: row.pet_name || '',
        roomLabel: row.room_label || '',
        startsAt: sqlToIso(row.starts_at),
        endsAt: sqlToIso(row.ends_at),
        revokedAt: sqlToIso(row.revoked_at),
        isActive: Boolean(row.is_active) && !row.revoked_at && new Date(sqlToIso(row.ends_at)) > new Date() && new Date(sqlToIso(row.starts_at)) <= new Date(),
      })),
    });
  }));

  router.post('/cameras/:id/grants', asyncHandler(async (req, res) => {
    const body = z.object({
      userId: z.number().int().positive('ต้องเลือกลูกค้า'),
      petName: text.max(120).optional().default(''),
      roomLabel: text.max(120).optional().default(''),
      startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'วันเริ่มไม่ถูกต้อง'),
      endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'วันสิ้นสุดไม่ถูกต้อง'),
    }).parse(req.body);
    const id = await createGrant({
      cameraId: idParam(req.params.id),
      userId: body.userId,
      petName: body.petName,
      roomLabel: body.roomLabel,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
    });
    res.status(201).json({ id });
  }));

  router.delete('/grants/:id', asyncHandler(async (req, res) => {
    await revokeGrant(idParam(req.params.id));
    res.json({ ok: true });
  }));

  router.get('/rooms', asyncHandler(async (req, res) => {
    const rows = await listAllCameras();
    const map = new Map();
    for (const row of rows) {
      const label = String(row.room_label || '').trim() || 'ไม่ได้ระบุห้อง';
      if (!map.has(label)) {
        map.set(label, {
          roomLabel: label,
          cameras: [],
          online: 0,
          offline: 0,
          connecting: 0,
        });
      }
      const room = map.get(label);
      const camera = publicCamera(row);
      room.cameras.push(camera);
      if (camera.streamStatus === 'online') room.online += 1;
      else if (camera.streamStatus === 'connecting') room.connecting += 1;
      else room.offline += 1;
    }
    const items = [...map.values()].map((room) => ({
      ...room,
      cameraCount: room.cameras.length,
    }));
    res.json({ items, summary: await cameraSummary() });
  }));

  router.patch('/rooms/rename', asyncHandler(async (req, res) => {
    const body = z.object({
      fromLabel: text.min(1, 'ต้องระบุชื่อห้องเดิม').max(120),
      toLabel: text.min(1, 'ต้องระบุชื่อห้องใหม่').max(120),
    }).parse(req.body);
    const updated = await renameRoomLabel(body.fromLabel, body.toLabel);
    if (!updated) throw new HttpError(404, 'NOT_FOUND', 'ไม่พบห้องที่ต้องการเปลี่ยนชื่อ');
    res.json({ ok: true, updated });
  }));

  router.get('/grants', asyncHandler(async (req, res) => {
    const activeOnly = String(req.query.active || '') === '1';
    const rows = await listAllGrants({ activeOnly });
    res.json({ items: rows.map(publicGrant) });
  }));

  router.get('/care', asyncHandler(async (req, res) => {
    const cameraId = req.query.cameraId ? idParam(req.query.cameraId) : null;
    const kind = ['feed', 'water', 'play', 'health'].includes(req.query.kind) ? req.query.kind : '';
    const days = Number(req.query.days || 7);
    const rows = await listCareLogs({ cameraId, kind, days });
    res.json({ items: rows.map(publicCare) });
  }));

  router.get('/system', asyncHandler(async (req, res) => {
    let mediamtx = 'down';
    try {
      const response = await fetch(`${config.mediamtxApi}/v3/config/global/get`);
      mediamtx = response.ok ? 'up' : 'down';
    } catch {
      mediamtx = 'down';
    }
    res.json({
      hotelName: config.hotelName,
      adminEmail: config.adminEmail,
      mediamtx,
      mediamtxApi: config.mediamtxApi,
      mediamtxWhep: config.mediamtxWhep,
      allowlist: config.allowlist,
      streamSessionSeconds: config.streamSessionSeconds,
      webrtcHost: config.webrtcHost,
      webrtcUdpPort: config.webrtcUdpPort,
      playbackAddresses: listPlaybackAddresses(),
      cookieSecure: config.cookieSecure,
      nodeEnv: config.nodeEnv,
      apiPort: config.port,
      summary: await cameraSummary(),
      checkedAt: new Date().toISOString(),
    });
  }));

  router.post('/system/sync', asyncHandler(async (req, res) => {
    try {
      const lan = listPlaybackAddresses();
      const hosts = lan.length ? [...lan] : ['127.0.0.1'];
      if (config.webrtcHost && config.webrtcHost !== '127.0.0.1') hosts.push(config.webrtcHost);
      await mtx.patchGlobal(hosts, listPlaybackInterfaces());
    } catch (error) {
      throw new HttpError(502, 'UPSTREAM', error.message || 'ตั้งค่า MediaMTX ไม่สำเร็จ');
    }

    const enabled = await listEnabledSecrets();
    const keep = new Set(enabled.map((row) => pathName(row.id)));
    let existing = [];
    try {
      existing = await mtx.listConfigNames();
    } catch (error) {
      throw new HttpError(502, 'UPSTREAM', error.message || 'อ่าน path จาก MediaMTX ไม่สำเร็จ');
    }

    for (const name of existing) {
      if (!name.startsWith('cam') || keep.has(name)) continue;
      const id = name.slice(3);
      if (/^\d+$/.test(id)) await mtx.deletePath(id);
    }

    let synced = 0;
    const errors = [];
    for (const row of enabled) {
      try {
        await mtx.upsertPath(row.id, openUrl(row.rtsp_url_enc, config.cameraKey));
        synced += 1;
      } catch (error) {
        await setCameraStatus(row.id, 'offline', error.message || 'ตั้งค่าตัวกลางภาพไม่สำเร็จ');
        errors.push({ cameraId: row.id, message: error.message || 'ล้มเหลว' });
      }
    }

    res.json({
      ok: errors.length === 0,
      synced,
      errors,
      summary: await cameraSummary(),
    });
  }));

  return router;
}

module.exports = { adminRoutes };
