const os = require('os');

function listPlaybackAddresses() {
  const found = [];
  const nets = os.networkInterfaces();
  for (const items of Object.values(nets)) {
    for (const item of items || []) {
      const v4 = item.family === 'IPv4' || item.family === 4;
      if (!v4 || item.internal) continue;
      if (item.address.startsWith('169.254.')) continue;
      found.push(item.address);
    }
  }
  return [...new Set(found)].sort((left, right) => rank(left) - rank(right) || left.localeCompare(right));
}

function rank(ip) {
  if (ip.startsWith('192.168.')) return 0;
  if (ip.startsWith('10.')) return 1;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return 2;
  return 3;
}

function readViewerHost(value) {
  const host = String(value || '').trim().replace(/^\[|\]$/g, '').slice(0, 253);
  if (!host || !/^[A-Za-z0-9.:-]+$/.test(host)) return '';
  return host;
}

function choosePlaybackAddress(viewerHost, localIps) {
  const host = readViewerHost(viewerHost).toLowerCase();
  const locals = [...new Set((localIps || []).filter((ip) => ip && ip !== '127.0.0.1'))]
    .sort((left, right) => rank(left) - rank(right) || left.localeCompare(right));
  const exact = locals.find((ip) => ip.toLowerCase() === host);
  if (exact) return exact;
  return locals[0] || '127.0.0.1';
}

function candidateAddress(line) {
  const parts = line.trim().split(/\s+/);
  return parts[4] || '';
}

function isLinkLocal(address) {
  const value = address.toLowerCase();
  return value.startsWith('169.254.') || value.startsWith('fe80:');
}

function listPlaybackInterfaces() {
  const wanted = new Set(listPlaybackAddresses());
  const names = [];
  for (const [name, items] of Object.entries(os.networkInterfaces())) {
    if ((items || []).some((item) => wanted.has(item.address))) names.push(name);
  }
  return names;
}

function filterOfferSdp(sdp) {
  const lines = String(sdp || '').split(/\r\n|\n/);
  const kept = lines.filter((line) => {
    if (!line.startsWith('a=candidate:')) return line !== '';
    const parts = line.trim().split(/\s+/);
    const address = parts[4] || '';
    if ((parts[2] || '').toLowerCase() !== 'udp') return false;
    if (!address || isLinkLocal(address) || address.includes(':')) return false;
    return true;
  });
  return joinSdp(kept.length ? kept : lines.filter(Boolean));
}

function rewriteAnswerCandidates(sdp, ip, port) {
  const target = readViewerHost(ip) || '127.0.0.1';
  const udp = Number(port) > 0 && Number(port) < 65536 ? Number(port) : 8189;
  const lines = String(sdp || '').split(/\r\n|\n/).filter(Boolean);
  const kept = lines.filter((line) => {
    if (!line.startsWith('a=candidate:')) return true;
    const address = candidateAddress(line);
    return address === target;
  });
  if (kept.some((line) => line.startsWith('a=candidate:'))) return joinSdp(kept);
  const candidate = `a=candidate:1 1 UDP 2130706431 ${target} ${udp} typ host`;
  const at = kept.findIndex((line) => line.startsWith('a=end-of-candidates'));
  if (at === -1) kept.push(candidate);
  else kept.splice(at, 0, candidate);
  return joinSdp(kept);
}

function joinSdp(lines) {
  return `${lines.join('\r\n')}\r\n`;
}

module.exports = {
  listPlaybackAddresses,
  listPlaybackInterfaces,
  readViewerHost,
  choosePlaybackAddress,
  filterOfferSdp,
  rewriteAnswerCandidates,
};
