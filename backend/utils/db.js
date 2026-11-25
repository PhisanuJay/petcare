import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

const ensureDataDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

export const readJSON = (filename, defaultValue = []) => {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
    return defaultValue;
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw || '[]');
};

export const writeJSON = (filename, data) => {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

export const findById = (filename, id) => {
  const items = readJSON(filename);
  return items.find((item) => item.id === id);
};

export const updateById = (filename, id, updates) => {
  const items = readJSON(filename);
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return null;
  items[index] = { ...items[index], ...updates, updatedAt: new Date().toISOString() };
  writeJSON(filename, items);
  return items[index];
};

export const deleteById = (filename, id) => {
  const items = readJSON(filename);
  const filtered = items.filter((item) => item.id !== id);
  if (filtered.length === items.length) return false;
  writeJSON(filename, filtered);
  return true;
};

export const addItem = (filename, item) => {
  const items = readJSON(filename);
  items.push(item);
  writeJSON(filename, items);
  return item;
};
