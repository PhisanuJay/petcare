import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
const dataFile = path.join(dataDir, 'bookings.json');

let queue = Promise.resolve();

async function readBookings() {
  try {
    const parsed = JSON.parse(await readFile(dataFile, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err?.code === 'ENOENT') return [];
    throw err;
  }
}

async function writeBookings(bookings) {
  await mkdir(dataDir, { recursive: true });
  const tmp = path.join(dataDir, `bookings.${process.pid}.tmp`);
  await writeFile(tmp, JSON.stringify(bookings, null, 2), 'utf8');
  await rename(tmp, dataFile);
}

/** Serialises read-modify-write so concurrent requests cannot overwrite each other. */
function updateBookings(mutator) {
  const run = queue.then(async () => {
    const next = mutator(await readBookings());
    await writeBookings(next.bookings);
    return next.result;
  });
  queue = run.then(
    () => {},
    () => {},
  );
  return run;
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function listBookings(ownerId) {
  return readBookings().then((bookings) =>
    bookings
      .filter((b) => b.ownerId === ownerId)
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)),
  );
}

export function createBooking(ownerId, data) {
  return updateBookings((bookings) => {
    const clash = bookings.some(
      (b) =>
        b.ownerId === ownerId &&
        b.petId === data.petId &&
        b.status !== 'cancelled' &&
        b.date === data.date &&
        b.time === data.time,
    );
    if (clash) throw httpError(409, 'สัตว์เลี้ยงตัวนี้มีนัดในวันและเวลานี้แล้ว');
    const now = new Date().toISOString();
    const booking = { ...data, id: randomUUID(), ownerId, status: 'pending', createdAt: now, updatedAt: now };
    return { bookings: [...bookings, booking], result: booking };
  });
}

export function cancelBooking(ownerId, id) {
  return updateBookings((bookings) => {
    const index = bookings.findIndex((b) => b.id === id && b.ownerId === ownerId);
    if (index === -1) throw httpError(404, 'ไม่พบนัดหมายนี้');
    if (bookings[index].status === 'cancelled') return { bookings, result: bookings[index] };
    const booking = { ...bookings[index], status: 'cancelled', updatedAt: new Date().toISOString() };
    const next = bookings.slice();
    next[index] = booking;
    return { bookings: next, result: booking };
  });
}
