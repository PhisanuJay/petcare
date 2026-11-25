import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function loadEnvFile() {
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key || process.env[key] != null) continue;
    const raw = trimmed.slice(eq + 1).trim();
    process.env[key] = raw.replace(/^(['"])(.*)\1$/, '$2');
  }
}

loadEnvFile();

/** Shared backend config */
export const config = {
  port: Number(process.env.PORT) || 3001,
  mssql: {
    server: process.env.MSSQL_SERVER || 'localhost\\SQLEXPRESS',
    database: process.env.MSSQL_DATABASE || 'PetCare',
    user: process.env.MSSQL_USER || 'petcare_app',
    password: process.env.MSSQL_PASSWORD || '',
    encrypt: String(process.env.MSSQL_ENCRYPT || 'false').toLowerCase() === 'true',
    trustServerCertificate:
      String(process.env.MSSQL_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() !== 'false',
  },
};
