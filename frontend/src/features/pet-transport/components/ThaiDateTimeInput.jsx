import { useMemo, useState } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { th } from 'date-fns/locale/th';
import { addDays, format, isValid, parse } from 'date-fns';
import 'react-datepicker/dist/react-datepicker.css';

registerLocale('th', th);

/** Pickup window: 09:00–21:00 (9 โมง – 3 ทุ่ม) */
export const PICKUP_TIME_MIN = '09:00';
export const PICKUP_TIME_MAX = '21:00';

const pad2 = (n) => String(n).padStart(2, '0');

/** One-hour slots for quick tap (09:00 … 21:00). */
export const PICKUP_TIME_SLOTS = (() => {
  const slots = [];
  for (let hour = 9; hour <= 21; hour += 1) {
    slots.push(`${pad2(hour)}:00`);
  }
  return slots;
})();

/** Grouped for schedule UI — morning / afternoon / evening. */
export const PICKUP_TIME_GROUPS = [
  { id: 'morning', label: 'เช้า', slots: ['09:00', '10:00', '11:00'] },
  { id: 'afternoon', label: 'บ่าย', slots: ['12:00', '13:00', '14:00', '15:00', '16:00'] },
  { id: 'evening', label: 'เย็น', slots: ['17:00', '18:00', '19:00', '20:00', '21:00'] },
];

function formatTimeLabel(slot) {
  const h = Number(slot.split(':')[0]);
  return Number.isFinite(h) ? `${h}:00` : slot;
}

function normalizeTimeStr(timeStr) {
  const cleaned = String(timeStr || '')
    .replace(/\s*น\.?\s*/g, '')
    .trim();
  const m = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${pad2(hour)}:${pad2(minute)}`;
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
  return `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}`;
}

function toDate(dateStr) {
  if (!dateStr) return null;
  const parsed = parse(dateStr, 'dd/MM/yyyy', new Date());
  return isValid(parsed) ? parsed : null;
}

function quickDateOptions() {
  const today = new Date();
  return [
    { key: 'today', label: 'วันนี้', value: format(today, 'dd/MM/yyyy') },
    { key: 'tomorrow', label: 'พรุ่งนี้', value: format(addDays(today, 1), 'dd/MM/yyyy') },
  ];
}

export default function ThaiDateTimeInput({
  id,
  date,
  time,
  onDateChange,
  onTimeChange,
  dateLabel = 'วันที่รับ',
  timeLabel = 'เวลารับ',
  summaryLabel = 'นัดรับ',
  variant = 'default',
}) {
  const picked = normalizeTimeStr(time);
  const comfortable = variant === 'comfortable';
  const scheduleReady = Boolean(date && picked);
  const quickDates = useMemo(() => quickDateOptions(), []);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const quickValues = useMemo(() => new Set(quickDates.map((item) => item.value)), [quickDates]);
  const customDateActive = Boolean(date && !quickValues.has(date));

  return (
    <div
      className={`tp-datetime-pick tp-schedule${comfortable ? ' tp-schedule--comfortable' : ''}`}
    >
      {scheduleReady ? (
        <div className="tp-schedule-summary" aria-live="polite">
          <span className="tp-schedule-summary__label">{summaryLabel}</span>
          <strong className="tp-schedule-summary__value">
            {date} · {picked} น.
          </strong>
        </div>
      ) : (
        <p className="tp-schedule-lead tp-muted small mb-0">
          เลือกวันที่ แล้วแตะช่วงเวลา — รับได้ 09:00–21:00 น.
        </p>
      )}

      <section className="tp-schedule-block tp-schedule-block--date">
        <label className="tp-schedule-block__title" htmlFor={`${id}-date`}>
          {dateLabel}
        </label>
        <div className="tp-schedule-date-row">
          <DatePicker
            id={`${id}-date`}
            selected={toDate(date)}
            open={calendarOpen}
            onCalendarOpen={() => setCalendarOpen(true)}
            onCalendarClose={() => setCalendarOpen(false)}
            onInputClick={() => setCalendarOpen(true)}
            onChange={(value) => {
              onDateChange(value && isValid(value) ? format(value, 'dd/MM/yyyy') : '');
              if (value && isValid(value)) setCalendarOpen(false);
            }}
            dateFormat="dd/MM/yyyy"
            locale="th"
            placeholderText="เลือกจากปฏิทิน"
            className="tp-datepicker-input tp-schedule-date-input"
            calendarClassName="tp-datepicker-calendar"
            showPopperArrow={false}
            isClearable
            shouldCloseOnSelect
            minDate={new Date()}
          />
          <div className="tp-schedule-quick" role="group" aria-label="เลือกวันเร็ว">
            {quickDates.map((item) => {
              const active = date === item.value;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`tp-schedule-quick__btn${active ? ' is-active' : ''}`}
                  aria-pressed={active}
                  onClick={() => {
                    onDateChange(item.value);
                    setCalendarOpen(false);
                  }}
                >
                  {item.label}
                </button>
              );
            })}
            <button
              type="button"
              className={`tp-schedule-quick__btn tp-schedule-quick__btn--calendar${customDateActive ? ' is-active' : ''}`}
              aria-pressed={customDateActive}
              onClick={() => setCalendarOpen(true)}
            >
              เลือกวันเอง
            </button>
          </div>
        </div>
      </section>

      <section className="tp-schedule-block tp-schedule-block--time" aria-labelledby={`${id}-time-label`}>
        <span className="tp-schedule-block__title" id={`${id}-time-label`}>
          {timeLabel}
        </span>
        <div className="tp-schedule-time-sheet" role="group">
          {PICKUP_TIME_GROUPS.map((group) => (
            <div key={group.id} className="tp-schedule-time-row">
              <span className="tp-schedule-time-row__period">{group.label}</span>
              <div
                className="tp-schedule-time-row__slots"
                role="listbox"
                aria-label={`${group.label} ${timeLabel}`}
              >
                {group.slots.map((slot) => {
                  const active = picked === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`tp-time-slot${active ? ' is-active' : ''}`}
                      onClick={() => onTimeChange(slot)}
                    >
                      {formatTimeLabel(slot)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {picked ? (
          <button
            type="button"
            className="tp-schedule-time-clear"
            onClick={() => onTimeChange('')}
          >
            เปลี่ยนเวลา
          </button>
        ) : null}
      </section>
    </div>
  );
}
