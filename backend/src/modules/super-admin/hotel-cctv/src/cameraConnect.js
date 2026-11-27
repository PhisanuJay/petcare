const { pathName } = require('./mediamtx');
const { probeRtsp } = require('./security/probe');
const { sha256 } = require('./security/crypto');
const { setCameraStatus, getCamera } = require('./store');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// สร้างลายนิ้วมือจากที่อยู่กล้อง เพื่อกันเพิ่มกล้องซ้ำ
function rtspFingerprint(rtspUrl) {
  return sha256(String(rtspUrl || '').trim().toLowerCase());
}

// เชื่อมกล้องเข้า MediaMTX แล้วตรวจสถานะจริง
async function applyStream(mtx, id, rtspUrl, enabled) {
  if (!enabled) {
    try {
      await mtx.deletePath(id);
    } catch (error) {
      console.error(`remove camera path failed: ${error.message}`);
    }
    await setCameraStatus(id, 'offline', 'กล้องถูกปิดใช้งาน');
    return getCamera(id);
  }

  await setCameraStatus(id, 'connecting', null);
  try {
    await mtx.upsertPath(id, rtspUrl);
  } catch (error) {
    await setCameraStatus(id, 'offline', error.message || 'ตั้งค่าตัวกลางภาพไม่สำเร็จ');
    return getCamera(id);
  }

  const probe = await probeRtsp(rtspUrl);
  const live = await mtx.pathState(id).catch(() => 'unknown');
  const online = probe.ok || live === 'online';
  await setCameraStatus(
    id,
    online ? 'online' : live === 'connecting' ? 'connecting' : 'offline',
    online ? null : probe.message,
  );
  return getCamera(id);
}

// ลองเชื่อมใหม่แบบถี่ขึ้นทีละรอบ (exponential backoff)
async function applyStreamWithRetry(mtx, id, rtspUrl, enabled, attempts = 3) {
  let waitMs = 1000;
  let camera = null;
  for (let round = 1; round <= attempts; round += 1) {
    camera = await applyStream(mtx, id, rtspUrl, enabled);
    if (!enabled || camera?.stream_status === 'online') return camera;
    if (round < attempts) {
      console.log(`camera ${id} retry ${round}/${attempts} in ${waitMs}ms`);
      await sleep(waitMs);
      waitMs *= 2;
    }
  }
  return camera;
}

function streamInfo(camera) {
  return {
    cameraId: camera.id,
    streamPath: pathName(camera.id),
    connectionStatus: camera.stream_status,
    isEnabled: Boolean(camera.is_enabled),
    whepPath: `/api/admin/cameras/${camera.id}/whep`,
    lastError: camera.last_error || '',
  };
}

module.exports = {
  rtspFingerprint,
  applyStream,
  applyStreamWithRetry,
  streamInfo,
  sleep,
};
