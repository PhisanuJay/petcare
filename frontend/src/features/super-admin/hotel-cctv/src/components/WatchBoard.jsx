import { useEffect, useState } from 'react';
import Player from './Player';
import { CatMark } from './Marks';
import { api, formatWhen } from '../api';

const CARE = [
  { kind: 'feed', short: 'อาหาร', done: 'ให้อาหารแล้ว', tone: 'feed' },
  { kind: 'water', short: 'น้ำ', done: 'เปลี่ยนน้ำแล้ว', tone: 'water' },
  { kind: 'play', short: 'เล่น', done: 'เล่นกับน้องแล้ว', tone: 'play' },
  { kind: 'health', short: 'สุขภาพ', done: 'สุขภาพปกติ', tone: 'health' },
];

const SLOTS = [
  { id: 'morning', label: 'เช้า', from: 0, to: 11 },
  { id: 'noon', label: 'เที่ยง', from: 11, to: 16 },
  { id: 'evening', label: 'เย็น', from: 16, to: 24 },
];

function clockText(date) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

function shortTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
    hourCycle: 'h23',
  }).format(date);
}

function latestOf(items, kind) {
  return [...items].reverse().find((item) => item.kind === kind) || null;
}

function bangkokHour(value) {
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
  return Number(hour);
}

function slotLogs(items, slot) {
  const found = new Map();
  items.forEach((item) => {
    const hour = bangkokHour(item.loggedAt);
    if (hour >= slot.from && hour < slot.to) found.set(item.kind, item);
  });
  return CARE.map((entry) => found.get(entry.kind)).filter(Boolean);
}

export default function WatchBoard({ camera, mode, onClose, canLog: canLogProp }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [busyKind, setBusyKind] = useState('');
  const [clock, setClock] = useState(() => clockText(new Date()));
  const [picture, setPicture] = useState('loading');
  const canLog = canLogProp !== undefined ? canLogProp : mode === 'admin';
  const cat = camera.catName || camera.name;
  const room = camera.roomLabel || 'ไม่ได้ระบุห้อง';

  async function load() {
    const path = mode === 'admin'
      ? `/api/admin/cameras/${camera.id}/care`
      : `/api/cameras/${camera.id}/care`;
    const data = await api(path);
    setItems(data.items);
  }

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

  async function mark(kind) {
    setBusyKind(kind);
    setError('');
    try {
      const data = await api(`/api/admin/cameras/${camera.id}/care`, { method: 'POST', body: { kind } });
      setItems(data.items);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKind('');
    }
  }

  async function undo(log) {
    setBusyKind(log.kind);
    setError('');
    try {
      const data = await api(`/api/admin/cameras/${camera.id}/care/${log.id}`, { method: 'DELETE' });
      setItems(data.items);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKind('');
    }
  }

  const author = [...items].reverse().find((item) => item.author)?.author || '';

  return (
    <div className="watch-board">
      <div className="watch-top">
        {onClose ? <button className="button ghost" type="button" onClick={onClose}>กลับ</button> : <span />}
        <div className="watch-title">
          <span className="pet-face small"><CatMark /></span>
          <div>
            <h1>{room} · {cat}</h1>
            <div className="watch-meta">
              {camera.accessStartsAt || camera.accessEndsAt ? (
                <span>เข้าพัก {camera.accessStartsAt ? formatWhen(camera.accessStartsAt) : ''}{camera.accessEndsAt ? ` ถึง ${formatWhen(camera.accessEndsAt)}` : ''}</span>
              ) : null}
              {author ? <span>บันทึกล่าสุดโดย {author}</span> : null}
            </div>
          </div>
        </div>
        <span className={`pill ${picture === 'live' ? 'online' : picture === 'error' ? 'offline' : 'connecting'}`}>
          {picture === 'live' ? 'LIVE' : picture === 'error' ? 'ภาพหลุด' : 'กำลังเชื่อม'}
        </span>
      </div>
      {error ? <p className="banner error">{error}</p> : null}
      <article className="panel watch-player">
        <div className="watch-stage">
          {camera.isEnabled ? (
            <Player key={camera.id} cameraId={camera.id} mode={mode} onPhase={setPicture} />
          ) : <div className="empty">กล้องนี้ถูกปิดใช้งาน</div>}
          <span className="watch-clock">{clock}</span>
          {picture === 'live' ? <span className="watch-online">กล้องออนไลน์</span> : null}
        </div>
        <div className="care-row">
          {CARE.map((item) => {
            const log = latestOf(items, item.kind);
            const time = busyKind === item.kind ? 'กำลังบันทึก' : (log ? `${shortTime(log.loggedAt)} น.` : 'ยังไม่มี');
            const body = (
              <>
                <CareIcon kind={item.kind} />
                <span className="care-copy">
                  <span>{log ? item.done : item.short}</span>
                  <small>{time}</small>
                </span>
              </>
            );
            if (!canLog) return <div className={`care-chip ${item.tone} ${log ? 'done' : ''}`} key={item.kind}>{body}</div>;
            return (
              <button className={`care-chip ${item.tone} ${log ? 'done' : ''}`} type="button" key={item.kind} disabled={busyKind === item.kind} onClick={() => mark(item.kind)} aria-label={log ? item.done : `บันทึก${item.short}`}>
                {body}
              </button>
            );
          })}
        </div>
        <div className="day-slots">
          {SLOTS.map((slot) => {
            const logs = slotLogs(items, slot);
            return (
              <section className="day-slot" key={slot.id}>
                <h2>{slot.label}</h2>
                {logs.length === 0 ? <p>ยังไม่มี</p> : logs.map((log) => {
                  const meta = CARE.find((entry) => entry.kind === log.kind);
                  return (
                    <div className={`slot-line ${log.kind}`} key={log.kind}>
                      <CareIcon kind={log.kind} />
                      <span>{meta ? meta.done : log.kind}</span>
                      <small>{shortTime(log.loggedAt)}</small>
                      {canLog ? (
                        <button type="button" className="undo" disabled={busyKind === log.kind} onClick={() => undo(log)}>
                          {busyKind === log.kind ? '...' : 'ยกเลิก'}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      </article>
    </div>
  );
}

function CareIcon({ kind }) {
  if (kind === 'water') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3s6 6.2 6 10.2A6 6 0 0 1 6 13.2C6 9.2 12 3 12 3Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (kind === 'play') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M10 9.5v5l4.5-2.5L10 9.5Z" fill="currentColor" />
      </svg>
    );
  }
  if (kind === 'health') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 19s-7-4.2-7-8.2A3.6 3.6 0 0 1 12 8a3.6 3.6 0 0 1 7 2.8C19 14.8 12 19 12 19Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 11h16c-.4 5-3.6 8-8 8s-7.6-3-8-8Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 11c.4-2.4 1.8-4 4-4s3.6 1.6 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
