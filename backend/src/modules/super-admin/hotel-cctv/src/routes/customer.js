const express = require('express');
const rateLimit = require('express-rate-limit');
const { asyncHandler, HttpError } = require('../errors');
const { publicCamera, publicCare, publicGrant, sqlToIso } = require('../serialize');
const { readViewerHost, filterOfferSdp, choosePlaybackAddress, rewriteAnswerCandidates, listPlaybackAddresses } = require('../webrtc');
const {
  listCustomerCameras,
  listCustomerGrants,
  getCamera,
  activeGrantFor,
  listCareToday,
  createStreamSession,
  consumeStreamToken,
  setCameraStatus,
} = require('../store');

function idParam(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'BAD_INPUT', 'รหัสไม่ถูกต้อง');
  return id;
}

function customerRoutes(config, mtx) {
  const router = express.Router();
  const streamLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.user && req.user.id),
    message: { error: { code: 'RATE_LIMITED', message: 'ขอภาพบ่อยเกินไป รอสักครู่แล้วลองใหม่' } },
  });

  router.get('/cameras', asyncHandler(async (req, res) => {
    const rows = await listCustomerCameras(req.user.id);
    res.json({
      items: rows.map((row) => {
        const camera = publicCamera(row);
        camera.catName = row.grant_pet_name || camera.catName;
        camera.roomLabel = row.grant_room_label || camera.roomLabel;
        camera.accessStartsAt = sqlToIso(row.grant_starts_at);
        camera.accessEndsAt = sqlToIso(row.ends_at);
        if (!row.is_enabled) {
          camera.streamStatus = 'offline';
          camera.lastError = 'กล้องถูกปิดใช้งาน';
        }
        return camera;
      }),
    });
  }));

  router.get('/rooms', asyncHandler(async (req, res) => {
    const rows = await listCustomerCameras(req.user.id);
    const map = new Map();
    for (const row of rows) {
      const camera = publicCamera(row);
      camera.catName = row.grant_pet_name || camera.catName;
      camera.roomLabel = row.grant_room_label || camera.roomLabel;
      camera.accessStartsAt = sqlToIso(row.grant_starts_at);
      camera.accessEndsAt = sqlToIso(row.ends_at);
      const label = String(camera.roomLabel || '').trim() || 'ไม่ได้ระบุห้อง';
      if (!map.has(label)) map.set(label, { roomLabel: label, cameras: [] });
      map.get(label).cameras.push(camera);
    }
    res.json({
      items: [...map.values()].map((room) => ({ ...room, cameraCount: room.cameras.length })),
    });
  }));

  router.get('/grants', asyncHandler(async (req, res) => {
    const rows = await listCustomerGrants(req.user.id);
    res.json({ items: rows.map(publicGrant) });
  }));

  router.get('/cameras/:id/care', asyncHandler(async (req, res) => {
    const id = idParam(req.params.id);
    const grant = await activeGrantFor(req.user.id, id);
    if (!grant) throw new HttpError(403, 'FORBIDDEN', 'คุณไม่มีสิทธิ์ดูกล้องนี้');
    const rows = await listCareToday(id);
    res.json({ items: rows.map(publicCare) });
  }));

  router.post('/cameras/:id/session', streamLimit, asyncHandler(async (req, res) => {
    const id = idParam(req.params.id);
    const camera = await getCamera(id);
    if (!camera || !camera.is_enabled) throw new HttpError(403, 'FORBIDDEN', 'กล้องนี้ยังเปิดใช้ไม่ได้');
    const grant = await activeGrantFor(req.user.id, id);
    if (!grant) throw new HttpError(403, 'FORBIDDEN', 'คุณไม่มีสิทธิ์ดูกล้องนี้');
    const token = await createStreamSession({
      userId: req.user.id,
      cameraId: id,
      grantId: grant.id,
      seconds: config.streamSessionSeconds,
    });
    res.json({ token, expiresIn: config.streamSessionSeconds });
  }));

  router.post('/cameras/:id/whep', streamLimit, express.text({ type: '*/*', limit: '64kb' }), asyncHandler(async (req, res) => {
    const id = idParam(req.params.id);
    const sdp = String(req.body || '');
    if (!sdp.includes('v=0')) throw new HttpError(400, 'BAD_INPUT', 'ข้อมูลภาพไม่ถูกต้อง');
    const token = req.get('x-stream-token') || '';
    const session = await consumeStreamToken({ token, userId: req.user.id, cameraId: id });
    if (!session) throw new HttpError(403, 'FORBIDDEN', 'สิทธิ์ดูภาพหมดอายุหรือไม่ถูกต้อง');
    const camera = await getCamera(id);
    if (!camera || !camera.is_enabled) throw new HttpError(403, 'FORBIDDEN', 'กล้องนี้ยังเปิดใช้ไม่ได้');
    const viewer = readViewerHost(req.get('x-viewer-host')) || req.hostname;
    try {
      const address = choosePlaybackAddress(viewer, listPlaybackAddresses());
      const answer = await mtx.proxyWhep(id, filterOfferSdp(sdp), address);
      await setCameraStatus(id, 'online', null);
      const shaped = rewriteAnswerCandidates(answer, address, config.webrtcUdpPort);
      res.type('application/sdp').send(shaped);
    } catch (error) {
      await setCameraStatus(id, 'offline', error.message || 'เชื่อมต่อภาพสดไม่สำเร็จ');
      throw error;
    }
  }));

  return router;
}

module.exports = { customerRoutes };
