const crypto = require('crypto');
const net = require('net');
const { sanitizeUpstream } = require('./rtsp');

function md5(value) {
  return crypto.createHash('md5').update(value).digest('hex');
}

function digestResponse({ user, pass, realm, nonce, method, uri, qop, nc, cnonce }) {
  const ha1 = md5(`${user}:${realm}:${pass}`);
  const ha2 = md5(`${method}:${uri}`);
  if (!qop) return md5(`${ha1}:${nonce}:${ha2}`);
  return md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
}

function parseAuthParams(value) {
  const out = {};
  const pattern = /(\w+)=("([^"]*)"|([^,\s]*))/g;
  let match = pattern.exec(value);
  while (match) {
    out[match[1]] = match[3] ?? match[4];
    match = pattern.exec(value);
  }
  return out;
}

function authorizationHeader({ user, pass, method, uri, challenge }) {
  if (challenge === 'basic' || challenge?.scheme === 'basic') {
    return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
  }
  const qop = String(challenge.qop || 'auth').split(',')[0].trim();
  const nc = '00000001';
  const cnonce = crypto.randomBytes(8).toString('hex');
  const response = digestResponse({
    user,
    pass,
    realm: challenge.realm,
    nonce: challenge.nonce,
    method,
    uri,
    qop,
    nc,
    cnonce,
  });
  return `Digest username="${user}", realm="${challenge.realm}", nonce="${challenge.nonce}", uri="${uri}", response="${response}", qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
}

function requestText(method, uri, cseq, extra) {
  let text = `${method} ${uri} RTSP/1.0\r\nCSeq: ${cseq}\r\nUser-Agent: CatHotel\r\n`;
  for (const [key, value] of Object.entries(extra)) text += `${key}: ${value}\r\n`;
  return `${text}\r\n`;
}

function probeRtsp(rtspUrl, timeoutMs = 6000) {
  const url = new URL(rtspUrl);
  const port = Number(url.port || 554);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const pathName = `${url.pathname || '/'}${url.search || ''}`;
  const uri = `rtsp://${net.isIPv6(host) ? `[${host}]` : host}:${port}${pathName.startsWith('/') ? pathName : `/${pathName}`}`;
  const user = decodeURIComponent(url.username || '');
  const pass = decodeURIComponent(url.password || '');

  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    let buffer = '';
    let stage = 'options';
    let cseq = 1;
    let triedAuth = false;
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve({
        ok: Boolean(result.ok),
        message: sanitizeUpstream(result.message || ''),
      });
    };

    const timer = setTimeout(() => finish({ ok: false, message: 'กล้องไม่ตอบสนองภายในเวลาที่กำหนด' }), timeoutMs);
    socket.setTimeout(timeoutMs, () => finish({ ok: false, message: 'กล้องไม่ตอบสนองภายในเวลาที่กำหนด' }));
    socket.on('error', () => finish({ ok: false, message: 'เชื่อมต่อกล้องไม่ได้' }));

    const sendDescribe = (challenge) => {
      cseq += 1;
      const headers = { Accept: 'application/sdp' };
      if (challenge && user) headers.Authorization = authorizationHeader({ user, pass, method: 'DESCRIBE', uri, challenge });
      socket.write(requestText('DESCRIBE', uri, cseq, headers));
    };

    socket.on('connect', () => {
      socket.write(requestText('OPTIONS', uri, cseq, {}));
    });

    socket.on('data', (chunk) => {
      buffer += chunk.toString('latin1');
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;
      const header = buffer.slice(0, headerEnd);
      const body = buffer.slice(headerEnd + 4);
      const status = Number((header.match(/RTSP\/1\.0 (\d+)/) || [])[1]);
      const contentLength = Number((header.match(/Content-Length:\s*(\d+)/i) || [])[1] || 0);
      if (contentLength > body.length) return;

      const www = header.match(/WWW-Authenticate:\s*(Digest|Basic)\s*([^\r\n]*)/i);
      if (status === 401 && user && !triedAuth && www) {
        triedAuth = true;
        buffer = '';
        stage = 'describe';
        const scheme = www[1].toLowerCase();
        sendDescribe(scheme === 'basic' ? 'basic' : { scheme, ...parseAuthParams(www[2]) });
        return;
      }
      if (stage === 'options' && status >= 200 && status < 300) {
        stage = 'describe';
        buffer = '';
        sendDescribe(null);
        return;
      }
      if (status >= 200 && status < 300) {
        const hasVideo = /m=video/i.test(body);
        finish({ ok: hasVideo, message: hasVideo ? '' : 'กล้องตอบกลับแล้วแต่ไม่พบสัญญาณภาพ' });
        return;
      }
      finish({
        ok: false,
        message: status === 401 ? 'กล้องต้องการบัญชี RTSP จากแอป Tapo ใส่ในที่อยู่กล้อง' : `กล้องตอบกลับรหัส ${status || 'ไม่ทราบ'}`,
      });
    });
  });
}

module.exports = { digestResponse, probeRtsp };
