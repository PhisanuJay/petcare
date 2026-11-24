import { useEffect, useMemo, useState } from 'react';
import Shell from '../components/Shell';
import CameraCard from '../components/CameraCard';
import WatchBoard from '../components/WatchBoard';
import { IconSearch } from '../components/Marks';
import { api, formatWhen } from '../api';

export default function CustomerLive() {
  return (
    <Shell role="customer">
      {(session, nav) => {
        if (nav.section === 'rooms') return <RoomsDesk />;
        if (nav.section === 'history') return <HistoryDesk />;
        if (nav.section === 'profile') return <ProfileDesk session={session} />;
        if (nav.section === 'contact') return <ContactDesk hotelName={session.hotelName} />;
        return <LiveDesk session={session} />;
      }}
    </Shell>
  );
}

function LiveDesk({ session }) {
  const [cameras, setCameras] = useState(null);
  const [watching, setWatching] = useState(null);
  const [room, setRoom] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  async function load() {
    try {
      const data = await api('/api/cameras');
      setCameras(data.items);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);

  const rooms = useMemo(() => {
    const names = new Set((cameras || []).map((item) => item.roomLabel || 'ไม่ได้ระบุห้อง'));
    return [...names];
  }, [cameras]);

  const visible = (cameras || []).filter((item) => {
    const label = item.roomLabel || 'ไม่ได้ระบุห้อง';
    if (room && label !== room) return false;
    const haystack = `${item.name} ${item.roomLabel} ${item.catName} ${item.description}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>กล้องสด <span className="pill live">LIVE</span></h1>
          <p className="muted">สวัสดี {session.user.displayName} · ดูเฉพาะกล้องที่ได้รับสิทธิ์</p>
        </div>
      </div>
      {error ? <p className="banner error">{error}</p> : null}
      {!cameras ? <p className="muted">กำลังโหลด</p> : null}
      {cameras && cameras.length === 0 ? <div className="empty">ยังไม่มีกล้องที่คุณได้รับสิทธิ์</div> : null}
      {cameras && cameras.length > 0 ? (
        <section className="panel">
          <div className="gallery-tools">
            <div className="room-filters">
              <button className={room === '' ? 'active' : ''} type="button" onClick={() => setRoom('')}>ทั้งหมด ({cameras.length})</button>
              {rooms.map((name) => (
                <button className={room === name ? 'active' : ''} type="button" key={name} onClick={() => setRoom(name)}>
                  {name}
                </button>
              ))}
            </div>
            <label className="search">
              <IconSearch />
              <input placeholder="ค้นหาห้องหรือชื่อแมว" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
          </div>
          {visible.length === 0 ? <div className="empty">ไม่พบกล้องตามที่ค้นหา</div> : null}
          <section className="thumb-grid">
            {visible.map((camera) => (
              <CameraCard
                key={camera.id}
                camera={{ ...camera, mode: 'customer' }}
                showLive={!watching}
                onOpen={() => setWatching(camera)}
                onPicture={load}
              />
            ))}
          </section>
        </section>
      ) : null}
      {watching ? (
        <div className="watch-overlay">
          <WatchBoard camera={watching} mode="customer" onClose={() => setWatching(null)} />
        </div>
      ) : null}
    </div>
  );
}

function RoomsDesk() {
  const [rooms, setRooms] = useState(null);
  const [watching, setWatching] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/rooms')
      .then((data) => setRooms(data.items))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>ห้องของฉัน</h1>
          <p className="muted">ห้องและกล้องที่คุณได้รับสิทธิ์ดูอยู่ตอนนี้</p>
        </div>
      </div>
      {error ? <p className="banner error">{error}</p> : null}
      {!rooms ? <p className="muted">กำลังโหลด</p> : null}
      {rooms && rooms.length === 0 ? <div className="empty">ยังไม่มีห้องที่ได้รับสิทธิ์</div> : null}
      <div className="room-grid">
        {(rooms || []).map((room) => (
          <section className="panel" key={room.roomLabel}>
            <div className="section-head">
              <div>
                <h2>{room.roomLabel}</h2>
                <p className="muted tiny">{room.cameraCount} กล้อง</p>
              </div>
            </div>
            <section className="thumb-grid compact">
              {room.cameras.map((camera) => (
                <CameraCard
                  key={camera.id}
                  camera={{ ...camera, mode: 'customer' }}
                  showLive={!watching}
                  onOpen={() => setWatching(camera)}
                />
              ))}
            </section>
          </section>
        ))}
      </div>
      {watching ? (
        <div className="watch-overlay">
          <WatchBoard camera={watching} mode="customer" onClose={() => setWatching(null)} />
        </div>
      ) : null}
    </div>
  );
}

function HistoryDesk() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/grants')
      .then((data) => setItems(data.items))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>ประวัติการเข้าพัก</h1>
          <p className="muted">สิทธิ์ดูกล้องทั้งหมดที่เคยได้รับ</p>
        </div>
      </div>
      {error ? <p className="banner error">{error}</p> : null}
      {!items ? <p className="muted">กำลังโหลด</p> : null}
      {items && items.length === 0 ? <div className="empty">ยังไม่มีประวัติสิทธิ์</div> : null}
      {items && items.length > 0 ? (
        <section className="panel">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ห้อง / แมว</th>
                  <th>กล้อง</th>
                  <th>เริ่ม</th>
                  <th>สิ้นสุด</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.roomLabel || item.cameraRoom || '—'}</strong>
                      <span className="cell-sub">{item.petName || item.cameraCat || '—'}</span>
                    </td>
                    <td>{item.cameraName}</td>
                    <td>{formatWhen(item.startsAt)}</td>
                    <td>{formatWhen(item.endsAt)}</td>
                    <td>
                      <span className={`pill ${item.isActive ? 'online' : 'offline'}`}>
                        {item.revokedAt ? 'เพิกถอนแล้ว' : item.isActive ? 'กำลังเข้าพัก' : 'สิ้นสุดแล้ว'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ProfileDesk({ session }) {
  const [profile, setProfile] = useState({
    displayName: session.user.displayName || '',
    currentPassword: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const body = { displayName: profile.displayName };
      if (profile.password) {
        body.password = profile.password;
        body.currentPassword = profile.currentPassword;
      }
      const result = await api('/api/auth/me', { method: 'PATCH', body });
      setMessage('บันทึกข้อมูลแล้ว');
      setProfile({
        displayName: result.user.displayName,
        currentPassword: '',
        password: '',
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>ข้อมูลส่วนตัว</h1>
          <p className="muted">แก้ชื่อที่แสดงและรหัสผ่านบัญชีลูกค้า</p>
        </div>
      </div>
      {error ? <p className="banner error">{error}</p> : null}
      {message ? <p className="banner ok">{message}</p> : null}
      <section className="panel narrow-panel">
        <form onSubmit={save}>
          <label>อีเมล<input value={session.user.email} disabled /></label>
          <label>ชื่อที่แสดง<input value={profile.displayName} onChange={(event) => setProfile({ ...profile, displayName: event.target.value })} required /></label>
          <label>รหัสผ่านปัจจุบัน<input type="password" value={profile.currentPassword} onChange={(event) => setProfile({ ...profile, currentPassword: event.target.value })} placeholder="ใส่เมื่อต้องการเปลี่ยนรหัส" /></label>
          <label>รหัสผ่านใหม่<input type="password" value={profile.password} onChange={(event) => setProfile({ ...profile, password: event.target.value })} minLength={8} placeholder="เว้นว่างถ้าไม่เปลี่ยน" /></label>
          <button className="button" type="submit" disabled={busy}>บันทึก</button>
        </form>
      </section>
    </div>
  );
}

function ContactDesk({ hotelName }) {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>ติดต่อเรา</h1>
          <p className="muted">ช่องทางติดต่อ Pet Hotel ของคุณ</p>
        </div>
      </div>
      <section className="panel narrow-panel">
        <h2>{hotelName || 'Pet Hotel'}</h2>
        <p className="muted">หากภาพกล้องมีปัญหา หรือต้องการขยายเวลาเข้าพัก ให้ติดต่อพนักงานที่เคาน์เตอร์หรือแอดมินของโรงแรม</p>
        <ul className="plain-list">
          <li>แจ้งชื่อห้องและชื่อแมวตอนติดต่อ</li>
          <li>สิทธิ์ดูกล้องถูกตั้งโดยแอดมินของโรงแรม</li>
          <li>ดูสถานะสิทธิ์ได้ที่เมนูประวัติการเข้าพัก</li>
        </ul>
      </section>
    </div>
  );
}
