const crypto = require('crypto');

function encryptString(plain, key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) {
    throw new Error('encryption key must be 32 bytes');
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decryptString(payload, key) {
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function randomToken() {
  return crypto.randomBytes(32).toString('base64url');
}

module.exports = { encryptString, decryptString, sha256, randomToken };
