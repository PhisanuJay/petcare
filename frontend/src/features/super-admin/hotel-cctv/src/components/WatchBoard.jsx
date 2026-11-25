import { useEffect, useMemo, useRef, useState } from 'react';
import Player from './Player';
import PetOverlay from './PetOverlay';
import { api, formatWhen } from '../api';

const CARE_BY_KIND = {
  feed: { kind: 'feed', short: 'ให้อาหาร', done: 'ให้อาหารแล้ว', emoji: '🍗', tone: 'feed' },
  water: { kind: 'water', short: 'เติมน้ำ', done: 'เติมน้ำแล้ว', emoji: '💧', tone: 'water' },
  play: { kind: 'play', short: 'เล่นกับแมว', done: 'เล่นกับน้องแล้ว', emoji: '🧸', tone: 'play' },
  walk: { kind: 'walk', short: 'พาเดินเล่น', done: 'พาเดินเล่นแล้ว', emoji: '🐾', tone: 'walk' },
  clean: { kind: 'clean', short: 'ทำความสะอาด', done: 'ทำความสะอาดแล้ว', emoji: '🧹', tone: 'clean' },
  health: { kind: 'health', short: 'ตรวจสุขภาพ', done: 'สุขภาพปกติ', emoji: '💗', tone: 'health' },
};

const SLOTS = [
  {
    id: 'morning',
    label: 'เช้า',
    short: 'รอบเช้า',
    from: 0,
    to: 11,
    icon: 'sun',
    kinds: ['feed', 'water', 'clean'],
    blurb: 'เน้นมื้อเช้าและเก็บกวาดห้องรับวันใหม่',
  },
  {
    id: 'noon',
    label: 'เที่ยง',
    short: 'รอบเที่ยง',
    from: 11,
    to: 16,
    icon: 'cloud',
    kinds: ['water', 'play', 'walk'],
    blurb: 'ไม่ให้อาหารมื้อหลักซ้ำซ้อน เน้นเติมน้ำและทำกิจกรรมคลายเครียดระหว่างวัน',
  },
  {
    id: 'evening',
    label: 'เย็น',
    short: 'รอบเย็น',
    from: 16,
    to: 24,
    icon: 'moon',
    kinds: ['feed', 'water', 'clean'],
    blurb: 'เน้นมื้อเย็นและทำความสะอาดกระบะทรายก่อนเข้านอน',
  },
];

function activitiesFor(slot) {
  return (slot?.kinds || []).map((kind) => CARE_BY_KIND[kind]).filter(Boolean);
}

const CUSTOM_SEP = '|||';

function encodeCustomNote(title, note) {
  const name = String(title || '').trim() || 'กิจกรรมเพิ่มเติม';
  const text = String(note || '').trim();
  return text ? `${name}${CUSTOM_SEP}${text}` : name;
}

function parseCustomNote(raw) {
  const text = String(raw || '');
  if (!text.includes(CUSTOM_SEP)) {
    return { title: text || 'กิจกรรมเพิ่มเติม', note: '' };
  }
  const [title, ...rest] = text.split(CUSTOM_SEP);
  return { title: title || 'กิจกรรมเพิ่มเติม', note: rest.join(CUSTOM_SEP) };
}

function entryFromLog(log) {
  if (!log) return null;
  if (log.kind === 'custom') {
    const parsed = parseCustomNote(log.note);
    return {
      kind: 'custom',
      short: parsed.title,
      done: parsed.title,
      emoji: '✨',
      tone: 'custom',
      customKey: `custom-${log.id}`,
      noteText: parsed.note,
    };
  }
  return CARE_BY_KIND[log.kind] || {
    kind: log.kind,
    short: log.kind,
    done: log.kind,
    emoji: '📌',
    tone: 'custom',
  };
}

function buildPeriodRows(slot, dayItems) {
  const slotItems = dayItems.filter((item) => {
    const hour = bangkokHour(item.loggedAt);
    return hour >= slot.from && hour < slot.to;
  });
  const byKind = new Map();
  const customs = [];
  slotItems.forEach((item) => {
    if (item.kind === 'custom') customs.push(item);
    else byKind.set(item.kind, item);
  });
  const fixed = activitiesFor(slot).map((entry) => ({
    entry,
    log: byKind.get(entry.kind) || null,
    key: entry.kind,
  }));
  const customRows = customs.map((log) => ({
    entry: entryFromLog(log),
    log,
    key: `custom-${log.id}`,
  }));
  return [...fixed, ...customRows];
}

function clockText(date, withSeconds = true) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
    hourCycle: 'h23',
  }).format(date);
}

function shortTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${clockText(date, false)} น.`;
}

function bangkokHour(value) {
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
  return Number(hour);
}

function bangkokDayKey(value = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

function thaiDateLabel(dayKey) {
  const [year, month, day] = dayKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function currentSlotId() {
  const hour = bangkokHour(new Date());
  return SLOTS.find((slot) => hour >= slot.from && hour < slot.to)?.id || 'morning';
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0'));

function nowTimeValue() {
  const raw = clockText(new Date(), false);
  return snapTimeValue(raw);
}

function snapTimeValue(value) {
  const [hourPart = '08', minutePart = '00'] = String(value || '').split(':');
  const hour = HOUR_OPTIONS.includes(hourPart) ? hourPart : '08';
  const minuteNum = Number(minutePart);
  const snapped = Number.isFinite(minuteNum)
    ? String(Math.min(55, Math.round(minuteNum / 5) * 5)).padStart(2, '0')
    : '00';
  const minute = MINUTE_OPTIONS.includes(snapped) ? snapped : '00';
  return `${hour}:${minute}`;
}

function splitTimeValue(value) {
  const snapped = snapTimeValue(value);
  const [hour, minute] = snapped.split(':');
  return { hour, minute };
}

function defaultTimeForSlot(slotId) {
  const slot = SLOTS.find((item) => item.id === slotId);
  const hour = bangkokHour(new Date());
  if (slot && hour >= slot.from && hour < slot.to) return nowTimeValue();
  const fallback = { morning: '08:30', noon: '13:00', evening: '18:30' };
  return snapTimeValue(fallback[slotId] || nowTimeValue());
}

function dayOptionsFrom(items) {
  const today = bangkokDayKey();
  const keys = new Set([today]);
  items.forEach((item) => keys.add(bangkokDayKey(item.loggedAt)));
  const list = [...keys].sort((a, b) => b.localeCompare(a)).slice(0, 7);
  return list.map((key) => ({ key, label: thaiDateLabel(key) }));
}

export default function WatchBoard({ camera, mode, onClose, canLog: canLogProp }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [busyKind, setBusyKind] = useState('');
  const [clock, setClock] = useState(() => clockText(new Date()));
  const [picture, setPicture] = useState(() => (camera.isEnabled ? 'loading' : 'error'));
  const [reload, setReload] = useState(0);
  const [reconnecting, setReconnecting] = useState(false);
  const [period, setPeriod] = useState(currentSlotId);
  const [dayKey, setDayKey] = useState(() => bangkokDayKey());
  const [meta, setMeta] = useState({
    roomLabel: camera.roomLabel || 'ไม่ได้ระบุห้อง',
    catName: camera.catName || camera.name || 'ไม่ระบุแมว',
  });
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [editForm, setEditForm] = useState({ roomLabel: '', catName: '' });
  const [addForm, setAddForm] = useState({
    period: currentSlotId(),
    kind: 'feed',
    customTitle: '',
    note: '',
    time: defaultTimeForSlot(currentSlotId()),
  });
  const [extraActivities, setExtraActivities] = useState({ morning: [], noon: [], evening: [] });
  const [toast, setToast] = useState('');
  const cameraBoxRef = useRef(null);
  const canLog = canLogProp !== undefined ? canLogProp : mode === 'admin';
  const canEdit = mode === 'admin';

  async function load() {
    const path = mode === 'admin'
      ? `/api/admin/cameras/${camera.id}/care`
      : `/api/cameras/${camera.id}/care`;
    const data = await api(path);
    setItems(data.items || []);
  }

  useEffect(() => {
    setMeta({
      roomLabel: camera.roomLabel || 'ไม่ได้ระบุห้อง',
      catName: camera.catName || camera.name || 'ไม่ระบุแมว',
    });
  }, [camera.id, camera.roomLabel, camera.catName, camera.name]);

  useEffect(() => {
    let cancelled = false;
    load()
      .then(() => { if (!cancelled) setError(''); })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [camera.id, mode]);

  useEffect(() => {
    const timer = setInterval(() => setClock(clockText(new Date())), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (picture === 'live' || picture === 'error') setReconnecting(false);
  }, [picture]);

  const dayItems = useMemo(
    () => items.filter((item) => bangkokDayKey(item.loggedAt) === dayKey),
    [items, dayKey],
  );
  const dates = useMemo(() => dayOptionsFrom(items), [items]);
  const activeSlot = SLOTS.find((slot) => slot.id === period) || SLOTS[0];
  const periodRows = buildPeriodRows(activeSlot, dayItems);
  const pendingExtras = (extraActivities[period] || [])
    .filter((extra) => !periodRows.some((row) => row.entry.kind === 'custom' && row.entry.short === extra.title))
    .map((extra) => ({
      entry: {
        kind: 'custom',
        short: extra.title,
        done: extra.title,
        emoji: '✨',
        tone: 'custom',
        customKey: extra.id,
        noteText: '',
        pendingExtra: true,
      },
      log: null,
      key: extra.id,
    }));
  const displayRows = [...periodRows, ...pendingExtras];
  const completedCount = displayRows.filter((row) => Boolean(row.log)).length;
  const slotItems = dayItems.filter((item) => {
    const hour = bangkokHour(item.loggedAt);
    return hour >= activeSlot.from && hour < activeSlot.to;
  });
  const latestNote = [...slotItems].reverse().find((item) => item.note || item.author);
  const noteText = (() => {
    if (!latestNote) return activeSlot.blurb;
    if (latestNote.kind === 'custom') {
      const parsed = parseCustomNote(latestNote.note);
      return parsed.note || parsed.title;
    }
    if (latestNote.note) return latestNote.note;
    if (latestNote.author) return `บันทึกล่าสุดโดย ${latestNote.author}`;
    return activeSlot.blurb;
  })();
  const roomTitle = meta.roomLabel.startsWith('ห้อง') ? meta.roomLabel : `ห้องพักแมว ${meta.roomLabel}`;
  const online = picture === 'live';
  const isCustomKind = addForm.kind === '__custom__';

  async function mark(kind, targetPeriod = period, note = '', customTitle = '', time = '') {
    const useCustom = kind === '__custom__' || kind === 'custom';
    const title = String(customTitle || '').trim();
    if (useCustom && !title) {
      setError('กรุณาใส่ชื่อกิจกรรมที่ต้องการเพิ่ม');
      return;
    }
    const loggedAt = String(time || '').trim();
    if (loggedAt && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(loggedAt)) {
      setError('รูปแบบเวลาไม่ถูกต้อง ใช้ เช่น 08:30');
      return;
    }
    const payloadKind = useCustom ? 'custom' : kind;
    const payloadNote = useCustom ? encodeCustomNote(title, note) : String(note || '').trim();
    setBusyKind(payloadKind === 'custom' ? `custom:${title}` : payloadKind);
    setError('');
    try {
      const data = await api(`/api/admin/cameras/${camera.id}/care`, {
        method: 'POST',
        body: {
          kind: payloadKind,
          slot: targetPeriod,
          note: payloadNote,
          ...(loggedAt ? { loggedAt } : {}),
        },
      });
      setItems(data.items || []);
      setPeriod(targetPeriod);
      setDayKey(bangkokDayKey());
      if (useCustom && title) {
        setExtraActivities((prev) => ({
          ...prev,
          [targetPeriod]: (prev[targetPeriod] || []).filter((item) => item.title !== title),
        }));
      }
      setToast(`บันทึก${useCustom ? title : (CARE_BY_KIND[kind]?.short || '')} เรียบร้อย`);
      setAddOpen(false);
      setDetail(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKind('');
    }
  }

  function addCustomToPeriod(title, targetPeriod = period) {
    const name = String(title || '').trim();
    if (!name) {
      setError('กรุณาใส่ชื่อกิจกรรม');
      return false;
    }
    setExtraActivities((prev) => {
      const list = prev[targetPeriod] || [];
      if (list.some((item) => item.title === name)) return prev;
      return {
        ...prev,
        [targetPeriod]: [...list, { id: `extra-${Date.now()}`, title: name }],
      };
    });
    setPeriod(targetPeriod);
    setToast(`เพิ่มกิจกรรม “${name}” ใน${SLOTS.find((s) => s.id === targetPeriod)?.short || 'รอบนี้'} แล้ว`);
    return true;
  }

  async function undo(log) {
    setBusyKind(log.kind);
    setError('');
    try {
      const data = await api(`/api/admin/cameras/${camera.id}/care/${log.id}`, { method: 'DELETE' });
      setItems(data.items || []);
      setDetail(null);
      setToast('ยกเลิกรายการแล้ว');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKind('');
    }
  }

  async function saveRoom(event) {
    event.preventDefault();
    setError('');
    try {
      await api(`/api/admin/cameras/${camera.id}`, {
        method: 'PATCH',
        body: {
          roomLabel: editForm.roomLabel.trim(),
          catName: editForm.catName.trim(),
        },
      });
      setMeta({
        roomLabel: editForm.roomLabel.trim() || 'ไม่ได้ระบุห้อง',
        catName: editForm.catName.trim() || 'ไม่ระบุแมว',
      });
      setEditOpen(false);
      setToast('บันทึกข้อมูลห้องพักเรียบร้อยแล้ว');
    } catch (err) {
      setError(err.message);
    }
  }

  function reconnect() {
    setReconnecting(true);
    setPicture('loading');
    setReload((value) => value + 1);
  }

  async function toggleFullscreen() {
    const node = cameraBoxRef.current;
    if (!node) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await node.requestFullscreen();
    } catch {
      setToast('เบราว์เซอร์ไม่รองรับโหมดเต็มจอ');
    }
  }

  function openEdit() {
    setEditForm({ roomLabel: meta.roomLabel, catName: meta.catName });
    setEditOpen(true);
  }

  function openAdd(kind, options = {}) {
    const slot = SLOTS.find((item) => item.id === period) || SLOTS[0];
    const wantCustom = options.custom || kind === 'custom' || kind === '__custom__';
    const nextKind = wantCustom
      ? '__custom__'
      : (kind && slot.kinds.includes(kind) ? kind : slot.kinds[0]);
    setAddForm({
      period,
      kind: nextKind,
      customTitle: options.title || '',
      note: '',
      time: defaultTimeForSlot(period),
    });
    setAddOpen(true);
  }

  return (
    <div className={`watch-board watch-room${error ? ' has-error' : ''}`}>
      <header className="watch-room-header">
        <div className="watch-room-heading">
          {onClose ? (
            <button className="watch-back" type="button" onClick={onClose} aria-label="กลับ">
              <BackIcon />
            </button>
          ) : null}
          <div className="watch-room-titles">
            <div className="watch-room-title-row">
              <h1>{roomTitle}</h1>
              <span className={`watch-online-pill ${online ? 'on' : picture === 'error' ? 'off' : 'wait'}`}>
                <span className="dot" />
                {online ? 'กล้องออนไลน์' : picture === 'error' ? 'กล้องออฟไลน์' : 'กำลังเชื่อมต่อ'}
              </span>
            </div>
            <p>
              แมวที่เข้าพัก : <strong>{meta.catName}</strong>
              {camera.accessStartsAt || camera.accessEndsAt ? (
                <span className="watch-stay">
                  {' '}· เข้าพัก {camera.accessStartsAt ? formatWhen(camera.accessStartsAt) : ''}
                  {camera.accessEndsAt ? ` ถึง ${formatWhen(camera.accessEndsAt)}` : ''}
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <label className="watch-date">
          <CalendarIcon />
          <select value={dayKey} onChange={(event) => setDayKey(event.target.value)}>
            {dates.map((item) => (
              <option key={item.key} value={item.key}>{item.label}</option>
            ))}
          </select>
        </label>
      </header>

      {error ? <p className="banner error watch-room-error">{error}</p> : null}

      <div className="watch-room-grid">
        <section className="watch-room-main">
          <div className="watch-camera" ref={cameraBoxRef}>
            {camera.isEnabled ? (
              <Player key={`${camera.id}-${reload}`} cameraId={camera.id} mode={mode} minimal onPhase={setPicture} />
            ) : (
              <div className="watch-camera-empty">กล้องนี้ถูกปิดใช้งาน</div>
            )}
            {(reconnecting || picture === 'loading') && picture !== 'live' ? (
              <div className="watch-camera-overlay soft">
                <span className="spin" />
                <strong>กำลังเชื่อมต่อกล้อง...</strong>
                <p>กรุณารอสักครู่ ระบบกำลังซิงค์สัญญาณภาพ</p>
              </div>
            ) : null}
            {picture === 'error' && !reconnecting ? (
              <div className="watch-camera-overlay">
                <strong>{camera.streamStatus === 'offline' ? 'กล้องออฟไลน์' : 'ภาพสดหลุดชั่วคราว'}</strong>
                <p>กด Reconnect เพื่อเชื่อมต่อกล้องอีกครั้ง</p>
                <button type="button" className="watch-btn primary" onClick={reconnect}>Reconnect กล้อง</button>
              </div>
            ) : null}
            <div className="watch-osd top-left">
              <span className={`watch-live-badge ${online ? 'on' : ''}`}>
                <span className="dot" />
                LIVE
        </span>
      </div>
            <div className="watch-osd top-right">
              <button type="button" className="watch-icon-btn" onClick={toggleFullscreen} aria-label="ขยายเต็มจอ">
                <ExpandIcon />
              </button>
            </div>
            <div className="watch-osd bottom-left">
              <span className="watch-pill">1080p · 30 FPS</span>
            </div>
            <div className="watch-osd bottom-right">
              <span className="watch-pill mono">{clock}</span>
            </div>
            {mode === 'admin' ? (
              <PetOverlay containerRef={cameraBoxRef} videoLive={picture === 'live'} />
            ) : null}
        </div>

          <div className="watch-actions">
            {canLog ? (
              <button type="button" className="watch-btn primary" onClick={() => openAdd()}>
                <span className="plus">+</span>
                บันทึกกิจกรรม
              </button>
            ) : null}
            {canEdit ? (
              <button type="button" className="watch-btn" onClick={openEdit}>
                <PenIcon />
                แก้ไขข้อมูลห้อง
              </button>
            ) : null}
            <button type="button" className="watch-btn" onClick={reconnect} disabled={reconnecting}>
              <RefreshIcon spinning={reconnecting} />
              Reconnect กล้อง
            </button>
          </div>
        </section>

        <aside className="watch-room-side">
          <div className="watch-pet-card">
            <div className="watch-pet-left">
              <div className="watch-pet-avatar" aria-hidden="true">{meta.catName.slice(0, 1)}</div>
              <div>
                <h2>{meta.catName}</h2>
                <p>{roomTitle}</p>
              </div>
            </div>
            <div className="watch-pet-right">
              <span className="watch-stay-pill">กำลังเข้าพัก</span>
              <span className="watch-room-tag">{meta.roomLabel}</span>
            </div>
          </div>

          <div className="watch-care-card">
            <div className="watch-care-head">
              <h2>กิจกรรมดูแลประจำวัน</h2>
              <span>{activeSlot.label} {completedCount}/{displayRows.length}</span>
            </div>
            <div className="watch-period-tabs">
              {SLOTS.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  className={period === slot.id ? 'active' : ''}
                  onClick={() => setPeriod(slot.id)}
                >
                  <PeriodIcon type={slot.icon} />
                  {slot.label}
                </button>
              ))}
            </div>
            <div className="watch-care-list">
              {displayRows.map((row) => {
                const done = Boolean(row.log);
                return (
                  <button
                    key={row.key}
                    type="button"
                    className={`watch-care-item ${done ? 'done' : ''}`}
                    onClick={() => setDetail({ entry: row.entry, log: row.log, slot: activeSlot })}
                  >
                    <span className="watch-care-emoji">
                      {row.entry.emoji}
                      {done ? <span className="check">✓</span> : null}
                    </span>
                    <span className="watch-care-copy">
                      <strong>{row.entry.short}</strong>
                      <small>{done ? shortTime(row.log.loggedAt) : 'รอดำเนินการ'}</small>
                    </span>
                    <span className={`watch-care-status ${done ? 'ok' : 'wait'}`}>
                      {done ? 'เรียบร้อยแล้ว' : 'รอดำเนินการ'}
                    </span>
              </button>
            );
          })}
        </div>
                      {canLog ? (
              <button type="button" className="watch-add-care" onClick={() => openAdd('__custom__', { custom: true })}>
                + เพิ่มกิจกรรมดูแล
                        </button>
                      ) : null}
                    </div>

          <div className="watch-note-card">
            <div className="watch-note-head">
              <h3>หมายเหตุเพิ่มเติม</h3>
              <span>{activeSlot.short}</span>
            </div>
            <div className="watch-note-box">{noteText}</div>
          </div>
        </aside>
      </div>

      {detail ? (
        <div className="watch-modal-backdrop" onClick={() => setDetail(null)}>
          <div className="watch-modal" onClick={(event) => event.stopPropagation()}>
            <div className="watch-modal-head">
              <div className="watch-modal-title">
                <span className="watch-care-emoji big">{detail.entry.emoji}</span>
                <div>
                  <h3>{detail.entry.short}</h3>
                  <p className={detail.log ? 'ok' : 'wait'}>{detail.log ? '● เรียบร้อยแล้ว' : '● รอดำเนินการ'}</p>
                </div>
              </div>
              <button type="button" className="watch-icon-btn ghost" onClick={() => setDetail(null)} aria-label="ปิด">×</button>
            </div>
            <div className="watch-modal-body">
              <div className="watch-kv"><span>ช่วงเวลา</span><strong>{detail.slot.short}</strong></div>
              <div className="watch-kv"><span>เวลาที่บันทึก</span><strong>{detail.log ? shortTime(detail.log.loggedAt) : 'ยังไม่ได้บันทึก'}</strong></div>
              <div className="watch-kv"><span>ผู้บันทึก</span><strong>{detail.log?.author || '—'}</strong></div>
              <div>
                <p className="watch-note-label">หมายเหตุจากพี่เลี้ยง</p>
                <div className="watch-note-box">
                  {detail.entry.kind === 'custom'
                    ? (detail.log ? (parseCustomNote(detail.log.note).note || 'ไม่มีหมายเหตุเพิ่มเติม') : 'ยังไม่ได้บันทึก')
                    : (detail.log?.note || 'ไม่มีหมายเหตุเพิ่มเติม')}
                </div>
              </div>
            </div>
            <div className="watch-modal-actions">
              {canLog && !detail.log ? (
                <button
                  type="button"
                  className="watch-btn primary"
                  onClick={() => {
                    setDetail(null);
                    openAdd(detail.entry.kind, {
                      custom: detail.entry.kind === 'custom',
                      title: detail.entry.kind === 'custom' ? detail.entry.short : '',
                    });
                  }}
                >
                  บันทึกกิจกรรมนี้
                </button>
              ) : null}
              {canLog && detail.log ? (
                <button type="button" className="watch-btn danger" disabled={busyKind === detail.entry.kind} onClick={() => undo(detail.log)}>
                  ยกเลิกรายการ
                </button>
              ) : null}
              <button type="button" className="watch-btn" onClick={() => setDetail(null)}>ปิด</button>
            </div>
          </div>
        </div>
      ) : null}

      {addOpen ? (
        <div className="watch-modal-backdrop" onClick={() => setAddOpen(false)}>
          <form
            className="watch-modal"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              if (String(addForm.kind).startsWith('__extra__:')) {
                mark('__custom__', addForm.period, addForm.note, addForm.kind.replace(/^__extra__:/, ''), addForm.time);
                return;
              }
              mark(addForm.kind, addForm.period, addForm.note, addForm.customTitle, addForm.time);
            }}
          >
            <div className="watch-modal-head">
              <h3>บันทึกกิจกรรมการดูแลแมว</h3>
              <button type="button" className="watch-icon-btn ghost" onClick={() => setAddOpen(false)} aria-label="ปิด">×</button>
            </div>
            <div className="watch-modal-body form">
              <div className="watch-form-row">
                <label>
                  <span>ช่วงเวลา</span>
                  <select
                    value={addForm.period}
                    onChange={(event) => {
                      const nextPeriod = event.target.value;
                      const slot = SLOTS.find((item) => item.id === nextPeriod) || SLOTS[0];
                      const nextKind = addForm.kind === '__custom__' || slot.kinds.includes(addForm.kind)
                        ? addForm.kind
                        : slot.kinds[0];
                      setAddForm({
                        ...addForm,
                        period: nextPeriod,
                        kind: nextKind,
                        time: defaultTimeForSlot(nextPeriod),
                      });
                    }}
                  >
                    {SLOTS.map((slot) => <option key={slot.id} value={slot.id}>{slot.short}</option>)}
                  </select>
                </label>
                <div className="watch-time-fields">
                  <span className="watch-time-label">เวลาบันทึกจริง</span>
                  <div className="watch-time-selects">
                    <label className="watch-time-part">
                      <span className="sr-only">ชั่วโมง</span>
                      <select
                        value={splitTimeValue(addForm.time).hour}
                        onChange={(event) => {
                          const { minute } = splitTimeValue(addForm.time);
                          setAddForm({ ...addForm, time: `${event.target.value}:${minute}` });
                        }}
                      >
                        {HOUR_OPTIONS.map((hour) => (
                          <option key={hour} value={hour}>{hour}</option>
                        ))}
                      </select>
                    </label>
                    <span className="watch-time-colon" aria-hidden="true">:</span>
                    <label className="watch-time-part">
                      <span className="sr-only">นาที</span>
                      <select
                        value={splitTimeValue(addForm.time).minute}
                        onChange={(event) => {
                          const { hour } = splitTimeValue(addForm.time);
                          setAddForm({ ...addForm, time: `${hour}:${event.target.value}` });
                        }}
                      >
                        {MINUTE_OPTIONS.map((minute) => (
                          <option key={minute} value={minute}>{minute}</option>
                        ))}
                      </select>
                    </label>
                    <span className="watch-time-suffix">น.</span>
                  </div>
                </div>
              </div>
              <label>
                <span>กิจกรรมดูแล</span>
                <select value={addForm.kind} onChange={(event) => setAddForm({ ...addForm, kind: event.target.value })}>
                  {activitiesFor(SLOTS.find((slot) => slot.id === addForm.period) || SLOTS[0]).map((entry) => (
                    <option key={entry.kind} value={entry.kind}>{entry.emoji} {entry.short}</option>
                  ))}
                  {(extraActivities[addForm.period] || []).map((extra) => (
                    <option key={extra.id} value={`__extra__:${extra.title}`}>✨ {extra.title}</option>
                  ))}
                  <option value="__custom__">➕ เพิ่มกิจกรรมใหม่...</option>
                </select>
              </label>
              {isCustomKind || String(addForm.kind).startsWith('__extra__:') ? (
                <label>
                  <span>ชื่อกิจกรรม</span>
                  <input
                    value={isCustomKind ? addForm.customTitle : addForm.kind.replace(/^__extra__:/, '')}
                    onChange={(event) => {
                      if (isCustomKind) setAddForm({ ...addForm, customTitle: event.target.value });
                    }}
                    readOnly={!isCustomKind}
                    placeholder="เช่น ให้ยา, ตัดเล็บ, แปรงขน"
                    maxLength={80}
                    required={isCustomKind}
                  />
                </label>
              ) : null}
              <label>
                <span>หมายเหตุเพิ่มเติม</span>
                <textarea
                  rows={3}
                  value={addForm.note}
                  onChange={(event) => setAddForm({ ...addForm, note: event.target.value })}
                  placeholder={`เช่น ${meta.catName} วันนี้กินเก่ง ร่าเริงดีครับ`}
                  maxLength={200}
                />
              </label>
            </div>
            <div className="watch-modal-actions">
              <button type="button" className="watch-btn" onClick={() => setAddOpen(false)}>ยกเลิก</button>
              {isCustomKind ? (
                <button
                  type="button"
                  className="watch-btn"
                  disabled={Boolean(busyKind)}
                  onClick={() => {
                    if (addCustomToPeriod(addForm.customTitle, addForm.period)) setAddOpen(false);
                  }}
                >
                  เพิ่มเข้ารายการ
                </button>
              ) : null}
              <button type="submit" className="watch-btn primary" disabled={Boolean(busyKind)}>
                บันทึกข้อมูล
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {editOpen ? (
        <div className="watch-modal-backdrop" onClick={() => setEditOpen(false)}>
          <form className="watch-modal" onClick={(event) => event.stopPropagation()} onSubmit={saveRoom}>
            <div className="watch-modal-head">
              <h3>แก้ไขข้อมูลห้องพักและแมว</h3>
              <button type="button" className="watch-icon-btn ghost" onClick={() => setEditOpen(false)} aria-label="ปิด">×</button>
            </div>
            <div className="watch-modal-body form">
              <label>
                <span>ชื่อห้อง / ป้ายห้อง</span>
                <input value={editForm.roomLabel} onChange={(event) => setEditForm({ ...editForm, roomLabel: event.target.value })} placeholder="เช่น A" required />
              </label>
              <label>
                <span>ชื่อแมวที่เข้าพัก</span>
                <input value={editForm.catName} onChange={(event) => setEditForm({ ...editForm, catName: event.target.value })} placeholder="เช่น น้องโมจิ" required />
              </label>
            </div>
            <div className="watch-modal-actions">
              <button type="button" className="watch-btn" onClick={() => setEditOpen(false)}>ยกเลิก</button>
              <button type="submit" className="watch-btn primary">บันทึกการเปลี่ยนแปลง</button>
            </div>
          </form>
        </div>
      ) : null}

      {toast ? <div className="watch-toast">{toast}</div> : null}
    </div>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 6 9 12l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3.5V7M16 3.5V7M3.5 10h17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PenIcon() {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 16.5V20h3.5L18 9.5 14.5 6 4 16.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function RefreshIcon({ spinning }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={spinning ? 'spin-icon' : undefined}>
      <path d="M20 12a8 8 0 1 1-2.3-5.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M20 4v5h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

function PeriodIcon({ type }) {
  if (type === 'cloud') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 17h10a4 4 0 0 0 .3-8 5.5 5.5 0 0 0-10.5 1.5A3.5 3.5 0 0 0 7 17Z" fill="none" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    );
  }
  if (type === 'moon') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 3.5A7.5 7.5 0 1 0 20.5 14 6 6 0 0 1 15 3.5Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
