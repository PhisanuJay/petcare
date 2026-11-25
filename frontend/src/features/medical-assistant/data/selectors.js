import { apptVetId, apptVetName, closureFor, hoursForMeta } from './clinicMeta.js';
import {
  TRIAGE_LEVELS,
  offsetDateKey,
  timeToMinutes,
  toDateKey,
} from './constants.js';
import { findConflict } from './schedule.js';
import { isTriaged, vitalFlags } from './useVisits.js';

function visitOf(appt, getVisit) {
  return appt?.visit ?? (getVisit ? getVisit(appt?.id) : null);
}

function sortByTriageAndCheckIn(list, getVisit) {
  return [...list].sort((a, b) => {
    const va = visitOf(a, getVisit);
    const vb = visitOf(b, getVisit);
    const pa = TRIAGE_LEVELS[va?.triage]?.priority ?? 99;
    const pb = TRIAGE_LEVELS[vb?.triage]?.priority ?? 99;
    if (pa !== pb) return pa - pb;
    const ca = va?.checkedInAt ?? '';
    const cb = vb?.checkedInAt ?? '';
    if (ca !== cb) {
      if (!ca) return 1;
      if (!cb) return -1;
      return ca.localeCompare(cb);
    }
    return (a.time || '').localeCompare(b.time || '');
  });
}

export function inClinicToday(appts, getVisit, todayKey = offsetDateKey(0)) {
  const list = appts.filter(
    (a) => a.date === todayKey && (a.stage === 'checked_in' || a.stage === 'in_treatment'),
  );
  return sortByTriageAndCheckIn(list, getVisit);
}

export function todayAppointments(appts, todayKey = offsetDateKey(0)) {
  return appts
    .filter((a) => a.date === todayKey)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
}

export function pendingBookings(appts) {
  return appts
    .filter((a) => a.stage === 'pending')
    .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
}

export function overdueBookings(appts, todayKey = offsetDateKey(0)) {
  return pendingBookings(appts).filter((a) => a.date < todayKey);
}

export function bookingConflicts(appts) {
  const results = [];
  for (const a of pendingBookings(appts)) {
    const id = apptVetId(a);
    const name = apptVetName(a);
    if (!id && !name) continue;
    const conflict = findConflict(
      appts,
      {
        vet: { id, name },
        date: a.date,
        time: a.time,
        durationMin: a.visit?.durationMin,
      },
      a.id,
    );
    if (conflict) results.push({ appt: a, conflict });
  }
  return results;
}

export function needsContact(appts) {
  return appts
    .filter((a) => a.stage === 'no_show' && !a.visit?.contactedAt)
    .sort((a, b) => `${b.date || ''}${b.time || ''}`.localeCompare(`${a.date || ''}${a.time || ''}`));
}

export function awaitingTriage(appts, getVisit, todayKey = offsetDateKey(0)) {
  const list = appts.filter(
    (a) => a.date === todayKey && a.stage === 'checked_in' && !isTriaged(visitOf(a, getVisit)),
  );
  return sortByTriageAndCheckIn(list, getVisit);
}

export function readyForVet(appts, getVisit, todayKey = offsetDateKey(0)) {
  const list = appts.filter(
    (a) => a.date === todayKey && a.stage === 'checked_in' && isTriaged(visitOf(a, getVisit)),
  );
  return sortByTriageAndCheckIn(list, getVisit);
}

export function inTreatment(appts, getVisit, todayKey = offsetDateKey(0)) {
  const list = appts.filter((a) => a.date === todayKey && a.stage === 'in_treatment');
  return sortByTriageAndCheckIn(list, getVisit);
}

export function completedToday(appts, getVisit, todayKey = offsetDateKey(0)) {
  const list = appts.filter((a) => a.date === todayKey && a.stage === 'completed');
  return sortByTriageAndCheckIn(list, getVisit);
}

export function lateArrivals(appts, now = new Date(), meta = null) {
  const nowDate = now instanceof Date ? now : new Date(now);
  const todayKey = toDateKey(nowDate);
  if (closureFor(meta, todayKey)) return [];
  const hours = hoursForMeta(meta, todayKey);
  if (!hours) return [];
  const nowMin = nowDate.getHours() * 60 + nowDate.getMinutes();
  const openMin = timeToMinutes(hours.open);
  const closeMin = timeToMinutes(hours.close);
  if (nowMin < openMin || nowMin > closeMin) return [];

  return todayAppointments(appts, todayKey).filter((a) => {
    if (a.stage !== 'confirmed') return false;
    const apptMin = timeToMinutes(a.time);
    return !Number.isNaN(apptMin) && nowMin - apptMin >= 15;
  });
}

export function abnormalVitalCases(appts, getVisit, todayKey = offsetDateKey(0)) {
  const results = [];
  for (const a of todayAppointments(appts, todayKey)) {
    if (a.stage !== 'checked_in' && a.stage !== 'in_treatment') continue;
    const visit = visitOf(a, getVisit);
    const flags = vitalFlags(a.petSpecies, visit?.vitals);
    if (flags.length > 0) {
      results.push({
        appt: a,
        visit,
        flags,
      });
    }
  }
  return results;
}

export function waitMinutes(appt, now = new Date()) {
  const ref = appt?.visit?.checkedInAt ?? appt?.updatedAt ?? appt?.createdAt;
  if (!ref) return 0;
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  return Math.max(0, Math.floor((nowMs - new Date(ref).getTime()) / 60000));
}

export function formatWaitText(mins) {
  if (mins < 1) return 'เพิ่งเช็คอิน';
  if (mins < 60) return `รอแล้ว ${mins} นาที`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `รอแล้ว ${hrs} ชม. ${rem} นาที` : `รอแล้ว ${hrs} ชม.`;
}

export function relativeTimeLabel(iso, now = new Date(), prefix = '') {
  if (!iso) return 'ไม่ระบุเวลา';
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  const diffMin = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 60000));
  if (diffMin < 1) return prefix ? `${prefix}สักครู่` : 'เมื่อสักครู่';
  if (diffMin < 60) return `${prefix}${diffMin} นาทีที่แล้ว`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${prefix}${diffHr} ชั่วโมงที่แล้ว`;
  const diffDay = Math.floor(diffHr / 24);
  return `${prefix}${diffDay} วันที่แล้ว`;
}
