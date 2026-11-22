import {
  CLINIC_HOURS,
  TRIAGE_LEVELS,
  offsetDateKey,
  timeToMinutes,
  toDateKey,
} from './constants.js';
import { findConflict } from './schedule.js';
import { isTriaged, vitalFlags } from './useVisits.js';

function sortByTriageAndTime(list, getVisit) {
  return [...list].sort((a, b) => {
    const va = getVisit ? getVisit(a.id) : null;
    const vb = getVisit ? getVisit(b.id) : null;
    const pa = TRIAGE_LEVELS[va?.triage]?.priority ?? 99;
    const pb = TRIAGE_LEVELS[vb?.triage]?.priority ?? 99;
    if (pa !== pb) return pa - pb;
    return (a.time || '').localeCompare(b.time || '');
  });
}

export function todayAppointments(appts, todayKey = offsetDateKey(0)) {
  return appts
    .filter((a) => a.date === todayKey)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
}

export function pendingBookings(appts) {
  return appts
    .filter((a) => a.status === 'pending')
    .sort((a, b) =>
      (a.requestedAt ?? a.createdAt ?? '').localeCompare(b.requestedAt ?? b.createdAt ?? ''),
    );
}

export function overdueBookings(appts, todayKey = offsetDateKey(0)) {
  return pendingBookings(appts).filter((a) => a.date < todayKey);
}

export function bookingConflicts(appts) {
  const results = [];
  for (const a of pendingBookings(appts)) {
    const conflict = findConflict(
      appts,
      {
        vet: a.vet,
        date: a.date,
        time: a.time,
        durationMin: a.durationMin,
      },
      a.id,
    );
    if (conflict) results.push({ appt: a, conflict });
  }
  return results;
}

export function awaitingReschedule(appts) {
  return appts
    .filter((a) => a.status === 'no_show' && !a.rescheduledTo)
    .sort((a, b) => `${b.date || ''}${b.time || ''}`.localeCompare(`${a.date || ''}${a.time || ''}`));
}

export function awaitingTriage(appts, getVisit, todayKey = offsetDateKey(0)) {
  const list = appts.filter(
    (a) => a.date === todayKey && a.status === 'checked_in' && !isTriaged(getVisit(a.id)),
  );
  return sortByTriageAndTime(list, getVisit);
}

export function readyForVet(appts, getVisit, todayKey = offsetDateKey(0)) {
  const list = appts.filter(
    (a) => a.date === todayKey && a.status === 'checked_in' && isTriaged(getVisit(a.id)),
  );
  return sortByTriageAndTime(list, getVisit);
}

export function inTreatment(appts, getVisit, todayKey = offsetDateKey(0)) {
  const list = appts.filter((a) => a.date === todayKey && a.status === 'in_treatment');
  return sortByTriageAndTime(list, getVisit);
}

export function completedToday(appts, getVisit, todayKey = offsetDateKey(0)) {
  const list = appts.filter((a) => a.date === todayKey && a.status === 'completed');
  return sortByTriageAndTime(list, getVisit);
}

export function lateArrivals(appts, now = new Date()) {
  const nowDate = now instanceof Date ? now : new Date(now);
  const nowMin = nowDate.getHours() * 60 + nowDate.getMinutes();
  const openMin = timeToMinutes(CLINIC_HOURS.open);
  const closeMin = timeToMinutes(CLINIC_HOURS.close);
  if (nowMin < openMin || nowMin > closeMin) return [];

  const todayKey = toDateKey(nowDate);
  return todayAppointments(appts, todayKey).filter((a) => {
    if (a.status !== 'confirmed') return false;
    const apptMin = timeToMinutes(a.time);
    return !Number.isNaN(apptMin) && nowMin - apptMin >= 15;
  });
}

export function abnormalVitalCases(
  appts,
  getVisit,
  getPatient,
  todayKey = offsetDateKey(0),
) {
  const results = [];
  for (const a of todayAppointments(appts, todayKey)) {
    if (a.status !== 'checked_in' && a.status !== 'in_treatment') continue;
    const visit = getVisit(a.id);
    const flags = vitalFlags(a.species, visit?.vitals);
    if (flags.length > 0) {
      results.push({
        appt: a,
        visit,
        flags,
        patient: getPatient ? getPatient(a) : null,
      });
    }
  }
  return results;
}

export function waitMinutes(appt, now = new Date()) {
  const ref = appt?.checkedInAt ?? appt?.updatedAt ?? appt?.createdAt;
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
