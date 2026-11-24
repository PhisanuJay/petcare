import { DEFAULT_SERVICES } from './clinicSettings.js';

function round1(val) {
  return Math.round(val * 10) / 10;
}

function median(sorted) {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function parseRejectReason(clinicNote, visit) {
  if (typeof clinicNote === 'string' && clinicNote.trim()) {
    const firstPart = clinicNote.split(' — ')[0].trim();
    if (firstPart) return firstPart;
  }
  if (visit?.rejectReason) return visit.rejectReason;
  return 'ไม่ระบุเหตุผล';
}

/**
 * Pure report builder for clinic_admin analytics over bookings whose `date` falls within `[from, to]`.
 * Never reads or exposes `ownerId`, `salt`, or `passwordHash`.
 */
export function buildReport({ bookings = [], visits = [], staff = [], from, to, now = new Date() }) {
  const visitsMap = new Map(visits.map((v) => [v.bookingId, v]));
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const staffByName = new Map(staff.map((s) => [s.name, s]));

  const rangeBookings = bookings.filter(
    (b) => typeof b.date === 'string' && b.date >= from && b.date <= to,
  );

  const byStatus = {
    pending: 0,
    confirmed: 0,
    completed: 0,
    no_show: 0,
    rejected: 0,
    cancelled: 0,
  };
  for (const b of rangeBookings) {
    byStatus[b.status] = (byStatus[b.status] ?? 0) + 1;
  }

  const outcomeDenom = byStatus.completed + byStatus.no_show;
  const noShowRate = outcomeDenom > 0 ? Number((byStatus.no_show / outcomeDenom).toFixed(3)) : 0;

  // Reject reasons
  const rejectCounts = new Map();
  for (const b of rangeBookings) {
    if (b.status !== 'rejected') continue;
    const reason = parseRejectReason(b.clinicNote, visitsMap.get(b.id));
    rejectCounts.set(reason, (rejectCounts.get(reason) ?? 0) + 1);
  }
  const rejectReasons = [...rejectCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  // Pending > 24h at the current moment across all dates
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const cutoffMs = nowMs - 24 * 3600 * 1000;
  const pendingOver24h = bookings.filter((b) => {
    if (b.status !== 'pending' || !b.createdAt) return false;
    const createdMs = new Date(b.createdAt).getTime();
    return Number.isFinite(createdMs) && createdMs < cutoffMs;
  }).length;

  // MA response time (handledAt - createdAt in minutes)
  const responseMinutes = [];
  for (const b of rangeBookings) {
    const v = visitsMap.get(b.id);
    if (!v?.handledAt || !b.createdAt) continue;
    const diffMin = (new Date(v.handledAt).getTime() - new Date(b.createdAt).getTime()) / 60000;
    if (Number.isFinite(diffMin) && diffMin >= 0) {
      responseMinutes.push(diffMin);
    }
  }
  responseMinutes.sort((a, b) => a - b);
  const maResponse = {
    count: responseMinutes.length,
    avgMinutes: responseMinutes.length
      ? round1(responseMinutes.reduce((sum, n) => sum + n, 0) / responseMinutes.length)
      : 0,
    medianMinutes: responseMinutes.length ? round1(median(responseMinutes)) : 0,
  };

  // Vet workload (by vetId, falling back to vet name for legacy entries)
  const vetMap = new Map();
  for (const s of staff) {
    if (s.role === 'veterinarian') {
      vetMap.set(s.id, { vetId: s.id, name: s.name, confirmed: 0, completed: 0, no_show: 0 });
    }
  }
  for (const b of rangeBookings) {
    if (!['confirmed', 'completed', 'no_show'].includes(b.status)) continue;
    const v = visitsMap.get(b.id);
    if (!v || (!v.vetId && !v.vet)) continue;
    const resolvedId = v.vetId ?? staffByName.get(v.vet)?.id ?? `legacy:${v.vet}`;
    const resolvedName = (v.vetId ? staffById.get(v.vetId)?.name : null) ?? v.vet ?? 'ไม่ระบุ';
    if (!vetMap.has(resolvedId)) {
      vetMap.set(resolvedId, {
        vetId: resolvedId.startsWith('legacy:') ? null : resolvedId,
        name: resolvedName,
        confirmed: 0,
        completed: 0,
        no_show: 0,
      });
    }
    vetMap.get(resolvedId)[b.status] += 1;
  }
  const vetWorkload = [...vetMap.values()].sort(
    (a, b) =>
      b.completed + b.confirmed + b.no_show - (a.completed + a.confirmed + a.no_show),
  );

  // MA activity (handled, checkedIn, contacted)
  const maMap = new Map();
  for (const s of staff) {
    if (s.role === 'medical_assistant') {
      maMap.set(s.id, { staffId: s.id, name: s.name, handled: 0, checkedIn: 0, contacted: 0 });
    }
  }
  function addMaStat(idVal, nameVal, field) {
    if (!idVal && !nameVal) return;
    const key = idVal ?? staffByName.get(nameVal)?.id ?? `legacy:${nameVal}`;
    const displayName = (idVal ? staffById.get(idVal)?.name : null) ?? nameVal ?? 'ไม่ระบุ';
    if (!maMap.has(key)) {
      maMap.set(key, {
        staffId: key.startsWith('legacy:') ? null : key,
        name: displayName,
        handled: 0,
        checkedIn: 0,
        contacted: 0,
      });
    }
    maMap.get(key)[field] += 1;
  }
  for (const b of rangeBookings) {
    const v = visitsMap.get(b.id);
    if (!v) continue;
    if (v.handledAt) addMaStat(v.handledById, v.handledBy, 'handled');
    if (v.checkedInAt) addMaStat(v.checkedInById, v.checkedInBy, 'checkedIn');
    if (v.contactedAt) addMaStat(v.contactedById, v.contactedBy, 'contacted');
  }
  const maActivity = [...maMap.values()].sort(
    (a, b) =>
      b.handled + b.checkedIn + b.contacted - (a.handled + a.checkedIn + a.contacted),
  );

  // Services breakdown
  const svcMap = new Map();
  for (const [code, label] of Object.entries(DEFAULT_SERVICES)) {
    svcMap.set(code, { code, label, count: 0 });
  }
  for (const b of rangeBookings) {
    const code = b.service || 'other';
    if (!svcMap.has(code)) {
      svcMap.set(code, {
        code,
        label: b.serviceLabel || DEFAULT_SERVICES[code] || code,
        count: 0,
      });
    }
    svcMap.get(code).count += 1;
  }
  const services = [...svcMap.values()].sort((a, b) => b.count - a.count);

  // Peak hours (HH) & Peak weekdays (0..6)
  const peakHours = {};
  const peakWeekdays = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const b of rangeBookings) {
    if (typeof b.time === 'string' && /^\d{2}:/.test(b.time)) {
      const hh = b.time.slice(0, 2);
      peakHours[hh] = (peakHours[hh] ?? 0) + 1;
    }
    if (typeof b.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date)) {
      const [y, m, d] = b.date.split('-').map(Number);
      const wd = new Date(y, m - 1, d).getDay();
      peakWeekdays[wd] = (peakWeekdays[wd] ?? 0) + 1;
    }
  }

  return {
    range: { from, to },
    generatedAt: new Date(nowMs).toISOString(),
    byStatus,
    noShowRate,
    rejectReasons,
    pendingOver24h,
    maResponse,
    vetWorkload,
    maActivity,
    services,
    peakHours,
    peakWeekdays,
  };
}
