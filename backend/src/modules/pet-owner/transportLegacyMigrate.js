import { createJsonCollection } from './jsonCollection.js';

const requests = createJsonCollection('transport-requests.json');

/** Logs legacy transport JSON rows; booking migration must be done manually if needed. */
export async function reportTransportLegacyRequests() {
  const all = await requests.read();
  if (!all.length) return { count: 0 };
  const pending = all.filter((row) => row.status !== 'cancelled');
  if (pending.length) {
    console.warn(
      `[transport] ${pending.length} legacy JSON transport request(s) remain — use pet-transport bookings for new data`,
    );
  }
  return { count: all.length, pending: pending.length };
}