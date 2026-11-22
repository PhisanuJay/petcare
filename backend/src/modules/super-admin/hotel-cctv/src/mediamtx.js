const { HttpError } = require('./errors');
const { sanitizeUpstream } = require('./security/rtsp');
const { interpretPath } = require('./security/access');

function pathName(id) {
  if (!/^\d+$/.test(String(id))) throw new HttpError(400, 'BAD_INPUT', 'รหัสกล้องไม่ถูกต้อง');
  return `cam${id}`;
}

function mtxError(text) {
  let message = text;
  try {
    const parsed = JSON.parse(text);
    message = parsed.error || parsed.message || text;
  } catch {
    message = text;
  }
  return sanitizeUpstream(message || 'MediaMTX ตอบกลับไม่สำเร็จ');
}

function createMediaMtx({ apiUrl, whepUrl }) {
  async function request(url, options = {}) {
    let response;
    try {
      response = await fetch(url, options);
    } catch {
      throw new HttpError(502, 'UPSTREAM', 'เชื่อมต่อ MediaMTX ไม่ได้');
    }
    const text = await response.text();
    if (!response.ok) {
      throw new HttpError(response.status === 404 ? 404 : 502, 'UPSTREAM', mtxError(text));
    }
    return text ? JSON.parse(text) : {};
  }

  async function patchGlobal(hosts, ifaces) {
    const list = [...new Set((hosts || []).filter(Boolean))];
    const names = [...new Set((ifaces || []).filter(Boolean))];
    const actions = ['api', 'metrics', 'pprof', 'publish', 'read', 'playback'];
    await request(`${apiUrl}/v3/config/global/patch`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webrtcAdditionalHosts: list,
        webrtcIPsFromInterfaces: names.length > 0,
        webrtcIPsFromInterfacesList: names,
        authInternalUsers: [{
          user: 'any',
          pass: '',
          ips: ['127.0.0.1/32', '::1/128', '192.168.0.0/16'],
          permissions: actions.map((action) => ({ action, path: '' })),
        }],
      }),
    });
  }

  async function upsertPath(id, rtspUrl) {
    const name = pathName(id);
    const body = JSON.stringify({
      source: rtspUrl,
      sourceOnDemand: true,
      sourceOnDemandStartTimeout: '20s',
      sourceOnDemandCloseAfter: '15s',
      rtspTransport: 'tcp',
      maxReaders: 8,
    });
    let response;
    try {
      response = await fetch(`${apiUrl}/v3/config/paths/add/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
    } catch {
      throw new HttpError(502, 'UPSTREAM', 'เชื่อมต่อ MediaMTX ไม่ได้');
    }
    if (response.ok) return;
    const text = await response.text();
    if (response.status === 400) {
      await request(`${apiUrl}/v3/config/paths/patch/${name}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      return;
    }
    throw new HttpError(502, 'UPSTREAM', mtxError(text));
  }

  async function deletePath(id) {
    const name = pathName(id);
    try {
      await request(`${apiUrl}/v3/config/paths/delete/${name}`, { method: 'DELETE' });
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) return;
      throw error;
    }
  }

  async function listConfigNames() {
    const data = await request(`${apiUrl}/v3/config/paths/list?itemsPerPage=1000`);
    return (data.items || []).map((item) => item.name).filter(Boolean);
  }

  async function pathState(id) {
    const name = pathName(id);
    try {
      const info = await request(`${apiUrl}/v3/paths/get/${name}`);
      return interpretPath(info);
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) return 'unknown';
      throw error;
    }
  }

  async function proxyWhep(id, sdp, viaHost) {
    const name = pathName(id);
    const root = whepRoot(whepUrl, viaHost);
    let response;
    try {
      response = await fetch(`${root}/${name}/whep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: sdp,
      });
    } catch {
      throw new HttpError(502, 'UPSTREAM', 'เชื่อมต่อภาพสดไม่สำเร็จ');
    }
    const text = await response.text();
    if (response.status !== 200 && response.status !== 201) {
      throw new HttpError(502, 'UPSTREAM', mapWhep(text));
    }
    if (!text.includes('v=0')) throw new HttpError(502, 'UPSTREAM', 'ตัวกลางภาพตอบกลับไม่ถูกต้อง');
    return text;
  }

  return { patchGlobal, upsertPath, deletePath, listConfigNames, pathState, proxyWhep };
}

function mapWhep(text) {
  const clean = sanitizeUpstream(text);
  if (/timeout|timed out/i.test(clean)) return 'กล้องไม่ตอบภายในเวลาที่กำหนด';
  if (/not ready|unavailable|no one is publishing|cannot|failed/i.test(clean)) return 'กล้องยังไม่พร้อมส่งภาพ';
  return 'เชื่อมต่อภาพสดไม่สำเร็จ';
}

function whepRoot(whepUrl, viaHost) {
  const url = new URL(whepUrl);
  const host = String(viaHost || '').trim().replace(/^\[|\]$/g, '');
  if (host && host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') url.hostname = host;
  return url.toString().replace(/\/$/, '');
}

module.exports = { createMediaMtx, pathName, whepRoot };
 