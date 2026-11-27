import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { httpError } from '../pet-owner/jsonCollection.js';

// copy of pet-owner/jsonCollection.js — move to backend/src/shared later
const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');

/**
 * A list of records kept in `data/<fileName>`.
 * Writes go through a queue (read → change → write) so concurrent requests cannot overwrite each other.
 */
export function createJsonCollection(fileName) {
  const dataFile = path.join(dataDir, fileName);
  let queue = Promise.resolve();

  async function read() {
    try {
      const parsed = JSON.parse(await readFile(dataFile, 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      if (err?.code === 'ENOENT') return [];
      throw err;
    }
  }

  async function write(records) {
    await mkdir(dataDir, { recursive: true });
    const tmp = path.join(dataDir, `${fileName}.${process.pid}.tmp`);
    await writeFile(tmp, JSON.stringify(records, null, 2), 'utf8');
    await rename(tmp, dataFile);
  }

  /** `mutator(records)` returns `{ records, result }`; throw inside it to abort without writing. */
  function update(mutator) {
    const run = queue.then(async () => {
      const next = mutator(await read());
      await write(next.records);
      return next.result;
    });
    queue = run.then(
      () => {},
      () => {},
    );
    return run;
  }

  return { read, update };
}

export { httpError };
