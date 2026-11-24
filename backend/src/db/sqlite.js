import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../../data');

let db;

export function getDb() {
  if (db) return db;
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.resolve(dataDir, config.sqliteFile || 'petcare-transport.sqlite');
  db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');
  return db;
}

export function dbPath() {
  return path.resolve(dataDir, config.sqliteFile || 'petcare-transport.sqlite');
}
