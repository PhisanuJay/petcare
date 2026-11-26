/** Dog → dog rooms; everything else → cat rooms (same as backend). */
export function petHotelSpecies(species) {
  return species === 'dog' ? 'dog' : 'cat';
}

export function selectedSpeciesGroups(pets, petIds) {
  const selected = pets.filter((pet) => petIds.includes(pet.id));
  const hasDog = selected.some((pet) => petHotelSpecies(pet.species) === 'dog');
  const hasCat = selected.some((pet) => petHotelSpecies(pet.species) === 'cat');
  return { hasDog, hasCat, selected };
}

export function filterCatalogBySpecies(catalog, { hasDog, hasCat }) {
  return catalog.filter((room) => {
    if (room.species === 'dog') return hasDog;
    if (room.species === 'cat') return hasCat;
    return false;
  });
}

export function newRoomLineKey() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function validateRoomSpeciesCoverage(lines, catalogById, speciesGroups) {
  if (!speciesGroups?.hasDog && !speciesGroups?.hasCat) return '';
  const speciesInLines = new Set();
  for (const line of lines) {
    const type = catalogById.get(line.roomTypeId);
    if (type?.species) speciesInLines.add(type.species);
  }
  if (speciesGroups.hasDog && !speciesInLines.has('dog')) {
    return 'มีสุนัขในบริการ — เลือกห้องสุนัขอย่างน้อย 1 รายการ';
  }
  if (speciesGroups.hasCat && !speciesInLines.has('cat')) {
    return 'มีแมวในบริการ — เลือกห้องแมวอย่างน้อย 1 รายการ';
  }
  return '';
}

export function validateRoomLines(lines, catalogById, availabilityMap) {
  if (!lines.length) return 'เลือกห้องพักอย่างน้อย 1 รายการ';
  for (const line of lines) {
    const type = catalogById.get(line.roomTypeId);
    if (!type) return 'ประเภทห้องไม่ถูกต้อง';
    const units = Math.max(1, Number(line.units) || 1);
    if (availabilityMap) {
      const left = availabilityMap.get(line.roomTypeId);
      if (left != null && units > left) return `${type.titleTh} เหลือว่าง ${left} ห้อง`;
    }
  }
  return '';
}

export function validateAssignment(lines, petIds, pets, catalogById) {
  const assigned = new Set();
  const petMap = new Map(pets.map((p) => [p.id, p]));
  for (const line of lines) {
    const type = catalogById.get(line.roomTypeId);
    if (!type) return 'ประเภทห้องไม่ถูกต้อง';
    const units = Math.max(1, Number(line.units) || 1);
    const max = type.maxPetsPerUnit * units;
    const ids = Array.isArray(line.petIds) ? line.petIds : [];
    if (!ids.length) return `ระบุสัตว์ในห้อง ${type.titleTh}`;
    if (ids.length > max) return `${type.titleTh} รองรับได้ไม่เกิน ${max} ตัว`;
    for (const id of ids) {
      if (assigned.has(id)) return 'สัตว์เลี้ยงถูกจัดซ้ำ';
      assigned.add(id);
      const pet = petMap.get(id);
      if (!pet) return 'ไม่พบสัตว์เลี้ยง';
      if (type.species !== petHotelSpecies(pet.species)) {
        return `${pet.name} ต้องอยู่ห้อง${type.species === 'dog' ? 'สุนัข' : 'แมว'}`;
      }
    }
  }
  const missing = petIds.filter((id) => !assigned.has(id));
  if (missing.length) return 'จัดสัตว์ทุกตัวเข้าห้องให้ครบ';
  return '';
}

/**
 * Greedy auto-assign: fill each room line with pets of matching species up to capacity.
 */
export function autoAssignRoomPets(roomLines, petIds, pets, catalogById) {
  const petMap = new Map(pets.map((p) => [p.id, p]));
  const pools = { dog: [], cat: [] };
  for (const id of petIds) {
    const pet = petMap.get(id);
    if (!pet) return { lines: roomLines, error: 'ไม่พบสัตว์เลี้ยง' };
    pools[petHotelSpecies(pet.species)].push(id);
  }

  const lines = roomLines.map((line) => ({ ...line, petIds: [] }));
  for (const line of lines) {
    const type = catalogById.get(line.roomTypeId);
    if (!type) return { lines: roomLines, error: 'ประเภทห้องไม่ถูกต้อง' };
    const units = Math.max(1, Number(line.units) || 1);
    const cap = type.maxPetsPerUnit * units;
    const pool = pools[type.species];
    if (!pool) {
      return { lines, error: `ห้อง ${type.titleTh} ไม่ตรงชนิดสัตว์ที่เลือก` };
    }
    const take = Math.min(cap, pool.length);
    line.petIds = pool.splice(0, take);
  }

  const unassigned = [...pools.dog, ...pools.cat];
  if (unassigned.length) {
    return {
      lines,
      error: 'สัตว์เกินความจุห้องที่เลือก — เพิ่มจำนวนห้องหรือลดตัวที่ฝาก',
    };
  }

  const assignErr = validateAssignment(lines, petIds, pets, catalogById);
  if (assignErr) return { lines, error: assignErr };
  return { lines, error: '' };
}