const os = require('os');
const net = require('net');
const { inCidr } = require('./security/rtsp');

function ipv4ToInt(ip) {
  const parts = String(ip).split('.');
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

function intToIpv4(value) {
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ].join('.');
}

function isPrivateIPv4(ip) {
  return ip.startsWith('10.')
    || ip.startsWith('192.168.')
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip);
}

// ช่วงของไวไฟหรือแลนที่เครื่องนี้ต่ออยู่ตอนนี้
function listLocalSubnets() {
  const subnets = [];
  for (const items of Object.values(os.networkInterfaces())) {
    for (const item of items || []) {
      const v4 = item.family === 'IPv4' || item.family === 4;
      if (!v4 || item.internal || !item.cidr) continue;
      if (!isPrivateIPv4(item.address)) continue;
      subnets.push({ cidr: item.cidr, own: item.address });
    }
  }
  return subnets;
}

function listLocalCidrs() {
  return [...new Set(listLocalSubnets().map((subnet) => subnet.cidr))];
}

function ipOnLocalSubnet(ip, cidrs) {
  return cidrs.some((cidr) => inCidr(ip, cidr));
}

// เฉพาะเครือข่ายไม่ใหญ่กว่า /24 เพื่อไม่กวาดทั้งวงใหญ่
function enumerateHosts(cidr, ownAddress = '') {
  const [range, bitsText] = String(cidr).split('/');
  const prefix = Number(bitsText);
  const base = ipv4ToInt(range);
  if (base === null || !Number.isInteger(prefix) || prefix < 24 || prefix > 30) return [];
  const mask = (~0 << (32 - prefix)) >>> 0;
  const network = (base & mask) >>> 0;
  const size = 2 ** (32 - prefix);
  const hosts = [];
  for (let offset = 1; offset < size - 1; offset += 1) {
    const ip = intToIpv4((network + offset) >>> 0);
    if (ip !== ownAddress) hosts.push(ip);
  }
  return hosts;
}

function replaceHostname(rtspUrl, host) {
  const url = new URL(rtspUrl);
  url.hostname = host;
  return url.href;
}

function tcpOpen(host, port, timeoutMs = 350) {
  return new Promise((resolve) => {
    let settled = false;
    const socket = net.connect({ host, port, family: 4 });
    const finish = (open) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function findHostsWithPort(port, subnets, timeoutMs = 350) {
  const hosts = subnets.flatMap((subnet) => enumerateHosts(subnet.cidr, subnet.own));
  const unique = [...new Set(hosts)];
  const found = [];
  let cursor = 0;

  async function worker() {
    while (cursor < unique.length) {
      const index = cursor;
      cursor += 1;
      const host = unique[index];
      if (await tcpOpen(host, port, timeoutMs)) found.push(host);
    }
  }

  const workers = Math.min(32, unique.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return found.sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

module.exports = {
  listLocalSubnets,
  listLocalCidrs,
  ipOnLocalSubnet,
  enumerateHosts,
  replaceHostname,
  tcpOpen,
  findHostsWithPort,
  isPrivateIPv4,
};
