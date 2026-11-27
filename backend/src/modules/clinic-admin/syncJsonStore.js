import { mkdirSync, readFileSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Synchronous-read / queued-write JSON store for modules whose readers (auth, schedule, roster)
 * are called synchronously while updates serialize cleanly through a write queue.
 */
export function createSyncJsonStore(
  filePath,
  { defaults, normalize = (v) => v, label = 'syncJsonStore' },
) {
  let loaded = false;
  let cache;
  let queue = Promise.resolve();

  function enqueueWrite(snapshot) {
    const payload = JSON.stringify(snapshot, null, 2);
    const run = queue.then(async () => {
      const dir = path.dirname(filePath);
      await mkdir(dir, { recursive: true });
      const tmp = `${filePath}.${process.pid}.tmp`;
      await writeFile(tmp, payload, 'utf8');
      await rename(tmp, filePath);
    });
    queue = run.then(
      () => {},
      () => {},
    );
    return run;
  }

  function ensureLoaded() {
    if (loaded) return;
    loaded = true;
    try {
      const raw = readFileSync(filePath, 'utf8');
      cache = normalize(JSON.parse(raw));
    } catch (err) {
      cache = normalize(defaults());
      if (err?.code === 'ENOENT') {
        try {
          mkdirSync(path.dirname(filePath), { recursive: true });
        } catch {
          // enqueueWrite will also attempt mkdir
        }
        enqueueWrite(structuredClone(cache)).catch((writeErr) => {
          console.warn(`[${label}] Failed to write initial seed file:`, writeErr.message);
        });
      } else {
        console.warn(
          `[${label}] Failed to read ${path.basename(filePath)}; using defaults in memory without overwriting:`,
          err.message,
        );
      }
    }
  }

  function get() {
    ensureLoaded();
    return structuredClone(cache);
  }

  function update(mutator) {
    ensureLoaded();
    const run = queue.then(async () => {
      const next = mutator(structuredClone(cache));
      const normalized = normalize(next.value);
      const snapshot = structuredClone(normalized);
      const dir = path.dirname(filePath);
      await mkdir(dir, { recursive: true });
      const tmp = `${filePath}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(snapshot, null, 2), 'utf8');
      await rename(tmp, filePath);
      cache = snapshot;
      return next.result;
    });
    queue = run.then(
      () => {},
      () => {},
    );
    return run;
  }

  return { get, update };
}
