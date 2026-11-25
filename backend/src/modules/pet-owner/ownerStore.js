import { createJsonCollection } from './jsonCollection.js';

/**
 * Contact details of pet owners, as the clinic needs them to reach the owner.
 * Shape: { ownerId, name, phone, email, address, emergencyName, emergencyPhone, updatedAt }
 *
 * Customer accounts live in the browser (localStorage), so the backend only learns these details when
 * the owner's pages send them (PUT /api/pet-owner/profile). Bookings also carry the owner's name and phone.
 */
const owners = createJsonCollection('owners.json');

export const OWNER_FIELDS = ['name', 'phone', 'email', 'address', 'emergencyName', 'emergencyPhone'];

export function listOwnerProfiles() {
  return owners.read();
}

/** Create or replace the contact details of one owner. */
export function saveOwnerProfile(ownerId, profile) {
  return owners.update((all) => {
    const row = { ...profile, ownerId, updatedAt: new Date().toISOString() };
    const index = all.findIndex((o) => o.ownerId === ownerId);
    const next = index === -1 ? [...all, row] : all.map((o, i) => (i === index ? row : o));
    return { records: next, result: row };
  });
}
