const { listEnabledSecrets, openUrl, setCameraStatus } = require('./store');
const { applyStream } = require('./cameraConnect');

// ตรวจกล้องที่เปิดใช้เป็นระยะ แล้วซ่อม path ใน MediaMTX ถ้าหลุด
function startCameraHealth({ config, mtx, everyMs = 60000 }) {
  let running = false;

  async function tick() {
    if (running) return;
    running = true;
    try {
      const enabled = await listEnabledSecrets();
      for (const row of enabled) {
        try {
          const state = await mtx.pathState(row.id);
          if (state === 'online') {
            await setCameraStatus(row.id, 'online', null);
            continue;
          }
          const rtspUrl = openUrl(row.rtsp_url_enc, config.cameraKey);
          await applyStream(mtx, row.id, rtspUrl, true);
        } catch (error) {
          console.error(`health check camera ${row.id}: ${error.message}`);
        }
      }
    } catch (error) {
      console.error(`health check failed: ${error.message}`);
    } finally {
      running = false;
    }
  }

  const timer = setInterval(tick, everyMs);
  if (typeof timer.unref === 'function') timer.unref();
  setTimeout(tick, 15000).unref?.();
  return () => clearInterval(timer);
}

module.exports = { startCameraHealth };
