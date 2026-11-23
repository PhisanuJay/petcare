const dns = require('dns').promises;
const net = require('net');

const ALWAYS_BLOCKED = new Set([
  '169.254.169.254',
  '100.100.100.200',
  'fd00:ec2::254',
  '::ffff:169.254.169.254',
]);

const BLOCKED_HOSTS = new Set([
  'metadata.google.internal',
  'metadata.google',
  'metadata',
  'instance-data',
]);

function ipv4ToInt(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const number = Number(part);
    if (number > 255) return null;
    value = (value * 256) + number;
  }
  return value >>> 0;
}

function inCidr(ip, cidr) {
  const [range, bitsText] = cidr.split('/');
  const ipInt = ipv4ToInt(ip);
  const rangeInt = ipv4ToInt(range);
  const bits = Number(bitsText);
  if (ipInt === null || rangeInt === null || !Number.isInteger(bits) || bits < 0 || bits > 32) {
    return false;
  }
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

function isAlwaysBlocked(ip) {
  const normalized = String(ip).toLowerCase();
  if (ALWAYS_BLOCKED.has(normalized)) return true;
  if (normalized.startsWith('::ffff:169.254.169.254')) return true;
  return false;
}

function allowlistAllows(host, ip, allowlist) {
  const hostName = host.toLowerCase();
  return allowlist.some((entry) => {
    const item = entry.toLowerCase();
    if (item.includes('/')) return inCidr(ip, item);
    if (net.isIP(item)) return item === ip.toLowerCase();
    return item === hostName;
  });
}

function fail(message) {
  return { ok: false, message };
}

async function validateRtspUrl(raw, allowlist, lookup = defaultLookup, localCidrs = []) {
  if (!Array.isArray(allowlist) || allowlist.length === 0) {
    return fail('ยังไม่ได้ตั้งค่า CAMERA_RTSP_ALLOWLIST');
  }
  let url;
  try {
    url = new URL(String(raw).trim());
  } catch {
    return fail('RTSP URL ไม่ถูกต้อง');
  }
  if (url.protocol !== 'rtsp:' && url.protocol !== 'rtsps:') {
    return fail('ใช้ได้เฉพาะที่อยู่ rtsp หรือ rtsps');
  }
  if (!url.hostname || /[\s%]/.test(url.hostname) || /^\d+$/.test(url.hostname)) {
    return fail('โฮสต์ของกล้องไม่ถูกต้อง');
  }
  const port = Number(url.port || 554);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return fail('พอร์ตของกล้องไม่ถูกต้อง');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (BLOCKED_HOSTS.has(host.toLowerCase())) {
    return fail('โฮสต์นี้ถูกปิดกั้น');
  }

  let ips = [];
  try {
    ips = net.isIP(host) ? [host] : await lookup(host);
  } catch {
    return fail('หาที่อยู่ของกล้องไม่เจอ');
  }
  if (!ips.length) return fail('หาที่อยู่ของกล้องไม่เจอ');
  if (ips.some((ip) => isAlwaysBlocked(ip))) return fail('ที่อยู่ปลายทางถูกปิดกั้น');

  const onLocalNetwork = (ip) => localCidrs.some((cidr) => inCidr(ip, cidr));
  const hostListed = allowlist.some((entry) => !entry.includes('/') && !net.isIP(entry) && entry.toLowerCase() === host.toLowerCase());
  const ipsAllowed = ips.every((ip) => allowlistAllows(host, ip, allowlist) || onLocalNetwork(ip) || (hostListed && !isAlwaysBlocked(ip)));
  if (!hostListed && !ips.every((ip) => allowlistAllows(host, ip, allowlist) || onLocalNetwork(ip))) {
    return fail('โฮสต์ของกล้องไม่อยู่ในรายการที่อนุญาต');
  }
  if (!ipsAllowed) return fail('ที่อยู่ปลายทางของกล้องไม่ปลอดภัย');

  return {
    ok: true,
    host,
    port,
    ips,
  };
}

async function defaultLookup(host) {
  const records = await dns.lookup(host, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

function sanitizeUpstream(message) {
  return String(message || 'เชื่อมต่อไม่สำเร็จ')
    .replace(/rtsps?:\/\/\S+/gi, '[rtsp]')
    .replace(/\/\/[^@\s/]+@/g, '//')
    .slice(0, 300);
}

module.exports = {
  validateRtspUrl,
  sanitizeUpstream,
  inCidr,
  isAlwaysBlocked,
};
