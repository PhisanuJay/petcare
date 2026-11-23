const net = require('net');
const { listEnabledSecrets, openUrl, setCameraStatus, updateCameraRow, findCameraByFingerprint, sealUrl } = require('./store');
const { applyStream, rtspFingerprint } = require('./cameraConnect');
const { validateRtspUrl } = require('./security/rtsp');
const { listPlaybackAddresses, listPlaybackInterfaces } = require('./webrtc');
const {
  listLocalSubnets,
  ipOnLocalSubnet,
  tcpOpen,
  findHostsWithPort,
  replaceHostname,
} = require('./lan');

// ตรวจกล้องที่เปิดใช้เป็นระยะ แล้วซ่อม path ใน MediaMTX ถ้าหลุด
function startCameraHealth({ config, mtx, everyMs = 20000 }) {
  let running = false;
  let playbackKey = '';

  async function refreshPlayback() {
    const lan = listPlaybackAddresses();
    const hosts = lan.length ? [...lan] : ['127.0.0.1'];
    if (config.webrtcHost && config.webrtcHost !== '127.0.0.1') hosts.push(config.webrtcHost);
    const unique = [...new Set(hosts)];
    const ifaces = listPlaybackInterfaces();
    const key = `${unique.join(',')}|${ifaces.join(',')}`;
    if (key === playbackKey) return;
    await mtx.patchGlobal(unique, ifaces);
    playbackKey = key;
  }

  // ที่อยู่เก่าไม่ตอบ และในเครือข่ายปัจจุบันมีเครื่องเดียวที่เปิดพอร์ตเดิม ให้ย้ายไปเครื่องนั้น
  async function followNetwork(rows) {
    const subnets = listLocalSubnets();
    const cidrs = subnets.map((subnet) => subnet.cidr);
    const chosen = new Map();
    const groups = new Map();

    for (const row of rows) {
      let rtspUrl;
      try {
        rtspUrl = openUrl(row.rtsp_url_enc, config.cameraKey);
      } catch {
        continue;
      }
      chosen.set(row.id, rtspUrl);
      let parsed;
      try {
        parsed = new URL(rtspUrl);
      } catch {
        continue;
      }
      const host = parsed.hostname.replace(/^\[|\]$/g, '');
      if (net.isIP(host) !== 4) continue;
      const port = Number(parsed.port || 554);
      const stillHere = ipOnLocalSubnet(host, cidrs) && await tcpOpen(host, port, 800);
      if (stillHere) continue;
      if (!groups.has(port)) groups.set(port, []);
      groups.get(port).push({ row, rtspUrl, host, port });
    }

    for (const [port, items] of groups) {
      const found = await findHostsWithPort(port, subnets);
      if (found.length !== 1) continue;
      const nextHost = found[0];
      const target = [...items].sort((left, right) => String(right.row.updated_at || '').localeCompare(String(left.row.updated_at || '')))[0];
      if (target.host === nextHost) continue;
      const nextUrl = replaceHostname(target.rtspUrl, nextHost);
      const checked = await validateRtspUrl(nextUrl, config.allowlist, undefined, cidrs);
      if (!checked.ok) continue;
      const fingerprint = rtspFingerprint(nextUrl);
      const duplicate = await findCameraByFingerprint(fingerprint);
      if (duplicate && Number(duplicate.id) !== Number(target.row.id)) continue;
      await updateCameraRow(target.row.id, {
        rtsp_url_enc: sealUrl(nextUrl, config.cameraKey),
        rtsp_fingerprint: fingerprint,
      });
      chosen.set(target.row.id, nextUrl);
      console.log(`กล้อง ${target.row.id} เปลี่ยนตามเครือข่ายไปที่ ${nextHost}:${port}`);
    }

    return chosen;
  }

  async function tick() {
    if (running) return;
    running = true;
    try {
      try {
        await refreshPlayback();
      } catch (error) {
        console.error(`network refresh failed: ${error.message}`);
      }
      const enabled = await listEnabledSecrets();
      const urls = await followNetwork(enabled);
      for (const row of enabled) {
        try {
          const state = await mtx.pathState(row.id);
          if (state === 'online') {
            await setCameraStatus(row.id, 'online', null);
            continue;
          }
          const rtspUrl = urls.get(row.id) || openUrl(row.rtsp_url_enc, config.cameraKey);
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
  setTimeout(tick, 5000).unref?.();
  return () => clearInterval(timer);
}

module.exports = { startCameraHealth };
