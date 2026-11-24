import DatePicker, { registerLocale } from 'react-datepicker';
import { th } from 'date-fns/locale/th';
import { format, isValid, parse, setHours, setMinutes, setSeconds } from 'date-fns';
import 'react-datepicker/dist/react-datepicker.css';

registerLocale('th', th);

/** Pickup window: 09:00–21:00 (9 โมง – 3 ทุ่ม) */
export const PICKUP_TIME_MIN = '09:00';
export const PICKUP_TIME_MAX = '21:00';

/**
 * Date วว/ดด/ปปปป + time 24h as HH:mm น. via react-datepicker.
 */

function normalizeTimeStr(timeStr) {
  const cleaned = String(timeStr || '')
    .replace(/\s*น\.?\s*/g, '')
    .trim();
  const m = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hour)}:${pad(minute)}`;
}

export function isAllowedPickupTime(timeStr) {
  const time = normalizeTimeStr(timeStr);
  if (!time) return false;
  return time >= PICKUP_TIME_MIN && time <= PICKUP_TIME_MAX;
}

export function parseThaiDateTime(dateStr, timeStr) {
  const m = String(dateStr || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const time = normalizeTimeStr(timeStr);
  if (!m || !time || !isAllowedPickupTime(time)) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const [hour, minute] = time.split(':').map(Number);
  if (
    !Number.isFinite(day) ||
    !Number.isFinite(month) ||
    !Number.isFinite(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  const dt = new Date(year, month - 1, day, hour, minute);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
    return null;
  }
  const pad = (n) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}

function toDate(dateStr) {
  if (!dateStr) return null;
  const parsed = parse(dateStr, 'dd/MM/yyyy', new Date());
  return isValid(parsed) ? parsed : null;
}

function toTimeDate(timeStr) {
  const time = normalizeTimeStr(timeStr);
  if (!time) return null;
  const parsed = parse(time, 'HH:mm', new Date());
  return isValid(parsed) ? parsed : null;
}

function pickupTimeBound(hours, minutes = 0) {
  return setSeconds(setMinutes(setHours(new Date(), hours), minutes), 0);
}

export default function ThaiDateTimeInput({
  id,
  date,
  time,
  onDateChange,
  onTimeChange,
  dateLabel = 'วันที่ (วว/ดด/ปปปป)',
  timeLabel = 'เวลา (09:00–21:00 น.)',
}) {
  return (
    <div className="row-2">
      <div className="field">
        <label htmlFor={`${id}-date`}>{dateLabel}</label>
        <DatePicker
          id={`${id}-date`}
          selected={toDate(date)}
          onChange={(value) => onDateChange(value && isValid(value) ? format(value, 'dd/MM/yyyy') : '')}
          dateFormat="dd/MM/yyyy"
          locale="th"
          placeholderText="18/11/2026"
          className="tp-datepicker-input"
          calendarClassName="tp-datepicker-calendar"
          showPopperArrow={false}
          isClearable
          shouldCloseOnSelect
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-time`}>{timeLabel}</label>
        <DatePicker
          id={`${id}-time`}
          selected={toTimeDate(time)}
          onChange={(value) => {
            if (!value || !isValid(value)) {
              onTimeChange('');
              return;
            }
            const next = format(value, 'HH:mm');
            onTimeChange(isAllowedPickupTime(next) ? next : '');
          }}
          showTimeSelect
          showTimeSelectOnly
          timeIntervals={15}
          timeCaption="เวลา"
          timeFormat="HH:mm"
          dateFormat="HH:mm 'น.'"
          locale="th"
          placeholderText="09:00–21:00 น."
          className="tp-datepicker-input"
          calendarClassName="tp-datepicker-calendar"
          showPopperArrow={false}
          isClearable
          minTime={pickupTimeBound(9, 0)}
          maxTime={pickupTimeBound(21, 0)}
        />
        <p className="tp-muted" style={{ marginTop: '0.35rem', marginBottom: 0 }}>
          เลือกรับได้ตั้งแต่ 09:00–21:00 น. (9 โมง – 3 ทุ่ม)
        </p>
      </div>
    </div>
  );
}
