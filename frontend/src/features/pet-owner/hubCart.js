import { newId } from '../../shared/utils/storage.js';

export const HUB_CATEGORY_LABEL = {
  clinic: 'นัดคลินิก',
  hotel: 'โรงแรมสัตว์',
  transport: 'รับ–ส่ง',
};

/** @typedef {{ name: string, services: string[] }} ClinicPetSummary */
/** @typedef {{ id: string, category: 'clinic'|'hotel'|'transport', label: string, detail?: string, total: number, refId: string, clinicPets?: ClinicPetSummary[] }} HubCartLine */

export function clinicPetsFromPetLines(petLines) {
  if (!Array.isArray(petLines) || !petLines.length) return [];
  const byPet = new Map();
  for (const line of petLines) {
    const key = line.petName || line.petId || 'สัตว์เลี้ยง';
    if (!byPet.has(key)) byPet.set(key, []);
    const label = line.serviceLabel || line.service || '';
    if (label) byPet.get(key).push(label);
  }
  return [...byPet.entries()].map(([name, services]) => ({ name, services }));
}

/** Parse legacy cart labels: «ดีดี้: บริการ · ดาด้า: บริการ» */
export function parseClinicHubLabel(label) {
  const text = String(label || '').trim();
  if (!text) return [];
  return text.split(/\s*·\s*/).filter(Boolean).map((seg) => {
    const idx = seg.indexOf(': ');
    if (idx === -1) return { name: seg.trim(), services: [] };
    const name = seg.slice(0, idx).trim();
    const rest = seg.slice(idx + 2).trim();
    const services = rest.includes(',')
      ? rest.split(/,\s*/).map((s) => s.trim()).filter(Boolean)
      : (rest ? [rest] : []);
    return { name, services };
  });
}

export function createHubLine(input) {
  return {
    id: newId(),
    category: input.category,
    label: input.label,
    detail: input.detail || '',
    total: Number(input.total) || 0,
    refId: input.refId,
    clinicPets: Array.isArray(input.clinicPets) ? input.clinicPets : undefined,
  };
}

export function hubCartTotal(lines) {
  return lines.reduce((sum, line) => sum + (Number(line.total) || 0), 0);
}