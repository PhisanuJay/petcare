import { useEffect, useState } from 'react';
import { IconSearch } from '../components/Marks';
import { api, bangkokInput, formatWhen, statusLabel } from '../api';

const CARE_LABEL = {
  feed: 'อาหาร',
  water: 'น้ำ',
  play: 'เล่น',
  health: 'สุขภาพ',
};

export function RoomsPanel() {
  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [rename, setRename] = useState({ fromLabel: '', toLabel: '' });

  async function load() {
    const data = await api('/api/admin/rooms');
    setRooms(data.items);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function saveCamera(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/api/admin/cameras/${editing.id}`, {
        method: 'PATCH',
        body: {
          roomLabel: editing.roomLabel,
          catName: editing.catName,
          name: editing.name,
        },
      });
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function renameRoom(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/admin/rooms/rename', { method: 'PATCH', body: rename });
      setRename({ fromLabel: '', toLabel: '' });
      await load();
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
          <h1>จัดการห้อง</h1>
          <p className="muted">จัดกลุ่มกล้องตามชื่อห้อง และแก้ชื่อห้องหรือชื่อแมวได้</p>
        </div>
        <button className="button ghost" type="button" onClick={() => load().catch((err) => setError(err.message))}>รีเฟรช</button>
      </div>
      {error ? <p className="banner error">{error}</p> : null}

      <section className="panel">
        <form className="toolbar compact" onSubmit={renameRoom}>
          <label>ชื่อห้องเดิม
            <select value={rename.fromLabel} onChange={(event) => setRename({ ...rename, fromLabel: event.target.value })} required>
              <option value="">เลือกห้อง</option>
              {rooms.filter((room) => room.roomLabel !== 'ไม่ได้ระบุห้อง').map((room) => (
                <option key={room.roomLabel} value={room.roomLabel}>{room.roomLabel} ({room.cameraCount})</option>
              ))}
            </select>
          </label>
          <label>ชื่อห้องใหม่
            <input value={rename.toLabel} onChange={(event) => setRename({ ...rename, toLabel: event.target.value })} required maxLength={120} />
          </label>
          <button className="button" type="submit" disabled={busy}>เปลี่ยนชื่อห้อง</button>
        </form>
      </section>

      {rooms.length === 0 ? <div className="empty">ยังไม่มีกล้องให้จัดห้อง</div> : null}
      <div className="room-grid">
        {rooms.map((room) => (
          <section className="panel" key={room.roomLabel}>
            <div className="section-head">
              <div>
                <h2>{room.roomLabel}</h2>
                <p className="muted tiny">กล้อง {room.cameraCount} · ออนไลน์ {room.online} · ออฟไลน์ {room.offline}</p>
              </div>
            </div>
            <ul className="grant-list">
              {room.cameras.map((camera) => (
                <li key={camera.id}>
                  <div>
                    <strong>{camera.name}</strong>
                    <p className="muted">{camera.catName || 'ยังไม่ระบุชื่อแมว'}</p>
                    <span className={`status-dot ${camera.streamStatus}`}>{statusLabel(camera.streamStatus)}</span>
                  </div>
                  <button
                    className="button ghost tiny"
                    type="button"
                    onClick={() => setEditing({
                      id: camera.id,
                      name: camera.name,
                      roomLabel: camera.roomLabel || '',
                      catName: camera.catName || '',
                    })}
                  >
                    แก้ไข
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {editing ? (
        <div className="overlay"><div className="modal">
          <form onSubmit={saveCamera}>
            <h2>แก้ไขห้อง / แมว</h2>
            <label>ชื่อกล้อง<input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} required /></label>
            <label>ห้อง<input value={editing.roomLabel} onChange={(event) => setEditing({ ...editing, roomLabel: event.target.value })} placeholder="เช่น A" /></label>
            <label>ชื่อแมว<input value={editing.catName} onChange={(event) => setEditing({ ...editing, catName: event.target.value })} placeholder="เช่น มะลิ" /></label>
            <div className="card-actions">
              <button className="button ghost" type="button" onClick={() => setEditing(null)}>ยกเลิก</button>
              <button className="button" type="submit" disabled={busy}>บันทึก</button>
            </div>
          </form>
        </div></div>
      ) : null}
    </div>
  );
}

export function RolesPanel() {
  const [grants, setGrants] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [filter, setFilter] = useState('active');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    cameraId: '',
    userId: '',
    petName: '',
    roomLabel: '',
    startsAt: bangkokInput(new Date()),
    endsAt: bangkokInput(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
  });

  async function load() {
    const active = filter === 'active' ? '1' : '0';
    const [access, people, cams] = await Promise.all([
      api(`/api/admin/grants?active=${active}`),
      api('/api/admin/customers'),
      api('/api/admin/cameras?pageSize=100'),
    ]);
    setGrants(access.items);
    setCustomers(people.items);
    setCameras(cams.items);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [filter]);

  async function createAccess(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/api/admin/cameras/${form.cameraId}/grants`, {
        method: 'POST',
        body: {
          userId: Number(form.userId),
          petName: form.petName,
          roomLabel: form.roomLabel,
          startsAt: form.startsAt,
          endsAt: form.endsAt,
        },
      });
      setForm({
        ...form,
        petName: '',
        roomLabel: '',
        startsAt: bangkokInput(new Date()),
        endsAt: bangkokInput(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id) {
    setBusy(true);
    setError('');
    try {
      await api(`/api/admin/grants/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function pickCamera(cameraId) {
    const camera = cameras.find((item) => String(item.id) === String(cameraId));
    setForm({
      ...form,
      cameraId,
      petName: camera?.catName || form.petName,
      roomLabel: camera?.roomLabel || form.roomLabel,
    });
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>สิทธิ์การเข้าถึง</h1>
          <p className="muted">ให้หรือเพิกถอนสิทธิ์ลูกค้าในการดูกล้อง</p>
        </div>
        <div className="page-tools">
          <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="กรองสิทธิ์">
            <option value="active">กำลังใช้ได้</option>
            <option value="all">ทั้งหมด</option>
          </select>
          <button className="button ghost" type="button" onClick={() => load().catch((err) => setError(err.message))}>รีเฟรช</button>
        </div>
      </div>
      {error ? <p className="banner error">{error}</p> : null}

      <div className="dash-bottom">
        <section className="panel grow">
          <h2>รายการสิทธิ์</h2>
          {grants.length === 0 ? <div className="empty">ยังไม่มีสิทธิ์ตามตัวกรองนี้</div> : null}
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ลูกค้า</th>
                  <th>กล้อง</th>
                  <th>ช่วงเวลา</th>
                  <th>สถานะ</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {grants.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.displayName}</strong>
                      <span className="cell-sub">{item.email}</span>
                    </td>
                    <td>
                      <strong>{item.cameraName}</strong>
                      <span className="cell-sub">{item.petName || item.cameraCat || '—'} · {item.roomLabel || '—'}</span>
                    </td>
                    <td>
                      <span className="cell-sub">{formatWhen(item.startsAt)}</span>
                      <span className="cell-sub">ถึง {formatWhen(item.endsAt)}</span>
                    </td>
                    <td>
                      <span className={`pill ${item.isActive ? 'online' : 'offline'}`}>
                        {item.revokedAt ? 'เพิกถอนแล้ว' : item.isActive ? 'ใช้ได้' : 'หมดอายุ/ยังไม่ถึง'}
                      </span>
                    </td>
                    <td>
                      {!item.revokedAt && item.isActive ? (
                        <button className="button danger tiny" type="button" disabled={busy} onClick={() => revoke(item.id)}>เพิกถอน</button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <form onSubmit={createAccess}>
            <h2>ให้สิทธิ์ใหม่</h2>
            <label>กล้อง
              <select value={form.cameraId} onChange={(event) => pickCamera(event.target.value)} required>
                <option value="">เลือกกล้อง</option>
                {cameras.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} · {item.roomLabel || 'ไม่มีห้อง'}</option>
                ))}
              </select>
            </label>
            <label>ลูกค้า
              <select value={form.userId} onChange={(event) => setForm({ ...form, userId: event.target.value })} required>
                <option value="">เลือกลูกค้า</option>
                {customers.filter((item) => item.isActive).map((item) => (
                  <option key={item.id} value={item.id}>{item.displayName} · {item.email}</option>
                ))}
              </select>
            </label>
            <label>ชื่อแมวที่แสดง<input value={form.petName} onChange={(event) => setForm({ ...form, petName: event.target.value })} /></label>
            <label>ชื่อห้องที่แสดง<input value={form.roomLabel} onChange={(event) => setForm({ ...form, roomLabel: event.target.value })} /></label>
            <label>เริ่ม<input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} required /></label>
            <label>สิ้นสุด<input type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} required /></label>
            <button className="button" type="submit" disabled={busy}>ให้สิทธิ์</button>
          </form>
        </section>
      </div>
    </div>
  );
}

export function LogsPanel() {
  const [items, setItems] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({ cameraId: '', kind: '', days: '7' });

  async function load(next = draft) {
    const params = new URLSearchParams();
    if (next.cameraId) params.set('cameraId', next.cameraId);
    if (next.kind) params.set('kind', next.kind);
    params.set('days', next.days || '7');
    const [logs, cams] = await Promise.all([
      api(`/api/admin/care?${params}`),
      api('/api/admin/cameras?pageSize=100'),
    ]);
    setItems(logs.items);
    setCameras(cams.items);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>บันทึกกิจกรรม</h1>
          <p className="muted">บันทึกการให้อาหาร น้ำ เล่น และตรวจสุขภาพจากภาพสด</p>
        </div>
      </div>
      {error ? <p className="banner error">{error}</p> : null}

      <section className="panel">
        <form
          className="toolbar compact"
          onSubmit={(event) => {
            event.preventDefault();
            load(draft).catch((err) => setError(err.message));
          }}
        >
          <label>กล้อง
            <select value={draft.cameraId} onChange={(event) => setDraft({ ...draft, cameraId: event.target.value })}>
              <option value="">ทุกกล้อง</option>
              {cameras.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label>ประเภท
            <select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value })}>
              <option value="">ทั้งหมด</option>
              <option value="feed">อาหาร</option>
              <option value="water">น้ำ</option>
              <option value="play">เล่น</option>
              <option value="health">สุขภาพ</option>
            </select>
          </label>
          <label>ช่วงวัน
            <select value={draft.days} onChange={(event) => setDraft({ ...draft, days: event.target.value })}>
              <option value="1">วันนี้</option>
              <option value="7">7 วัน</option>
              <option value="30">30 วัน</option>
            </select>
          </label>
          <button className="button" type="submit">ค้นหา</button>
        </form>

        {items.length === 0 ? <div className="empty">ยังไม่มีบันทึกตามเงื่อนไขนี้</div> : null}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>เวลา</th>
                <th>กล้อง / ห้อง</th>
                <th>กิจกรรม</th>
                <th>โดย</th>
                <th>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{formatWhen(item.loggedAt)}</td>
                  <td>
                    <strong>{item.cameraName}</strong>
                    <span className="cell-sub">{item.roomLabel || '—'} · {item.catName || '—'}</span>
                  </td>
                  <td><span className={`pill care-${item.kind}`}>{CARE_LABEL[item.kind] || item.kind}</span></td>
                  <td>{item.author || '—'}</td>
                  <td>{item.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function SettingsPanel() {
  const [system, setSystem] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setSystem(await api('/api/admin/system'));
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function syncMedia() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await api('/api/admin/system/sync', { method: 'POST' });
      setMessage(result.ok
        ? `ซิงก์สำเร็จ ${result.synced} กล้อง`
        : `ซิงก์บางส่วน ${result.synced} กล้อง มีปัญหา ${result.errors.length} รายการ`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const summary = system?.summary || { total: 0, online: 0, offline: 0, connecting: 0 };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>ตั้งค่า</h1>
          <p className="muted">สถานะระบบและตัวกลางภาพจริงของโรงแรม</p>
        </div>
        <button className="button" type="button" disabled={busy} onClick={syncMedia}>ซิงก์ MediaMTX</button>
      </div>
      {error ? <p className="banner error">{error}</p> : null}
      {message ? <p className="banner ok">{message}</p> : null}
      {!system ? <p className="muted">กำลังโหลด</p> : null}

      {system ? (
        <>
          <section className="stat-row">
            <article className="stat-card">
              <div>
                <span>ฐานข้อมูลกล้อง</span>
                <strong>{summary.total}</strong>
                <small>ตัว</small>
              </div>
            </article>
            <article className="stat-card">
              <div>
                <span>ออนไลน์</span>
                <strong>{summary.online}</strong>
                <small>ตัว</small>
              </div>
            </article>
            <article className="stat-card">
              <div>
                <span>MediaMTX</span>
                <strong className={system.mediamtx === 'up' ? 'ok-text' : 'bad-text'}>{system.mediamtx === 'up' ? 'พร้อม' : 'ปิดอยู่'}</strong>
              </div>
            </article>
            <article className="stat-card">
              <div>
                <span>เซสชันดูภาพ</span>
                <strong>{system.streamSessionSeconds}</strong>
                <small>วินาที</small>
              </div>
            </article>
          </section>

          <div className="dash-bottom">
            <section className="panel grow">
              <h2>ข้อมูลโรงแรม</h2>
              <dl className="kv-list">
                <div><dt>ชื่อโรงแรม</dt><dd>{system.hotelName}</dd></div>
                <div><dt>MediaMTX API</dt><dd>{system.mediamtxApi}</dd></div>
                <div><dt>WHEP</dt><dd>{system.mediamtxWhep}</dd></div>
                <div><dt>พอร์ต WebRTC UDP</dt><dd>{system.webrtcUdpPort}</dd></div>
              </dl>
              <p className="muted tiny">ชื่อโรงแรมและรหัสแอดมินอ่านจากไฟล์ .env หากเปลี่ยนต้องแก้ที่ไฟล์แล้วรีสตาร์ทเซิร์ฟเวอร์</p>
            </section>
            <section className="panel">
              <h2>เครือข่ายที่อนุญาต</h2>
              {system.allowlist.length === 0 ? <div className="empty">ยังไม่ตั้ง allowlist</div> : (
                <ul className="plain-list">
                  {system.allowlist.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
              <h3>ที่อยู่เล่นภาพ</h3>
              <ul className="plain-list">
                {(system.playbackAddresses || []).map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}

const STAFF_PERMISSION_OPTIONS = [
  { key: 'view_cameras', label: 'ดูภาพกล้อง', group: 'กล้อง' },
  { key: 'manage_cameras', label: 'เพิ่ม แก้ ลบกล้อง', group: 'กล้อง' },
  { key: 'care_logs', label: 'บันทึกการดูแล', group: 'งานดูแล' },
  { key: 'manage_rooms', label: 'จัดการห้อง', group: 'งานดูแล' },
  { key: 'manage_customers', label: 'จัดการลูกค้า', group: 'บัญชี' },
  { key: 'manage_grants', label: 'ให้สิทธิ์ดูกล้อง', group: 'บัญชี' },
  { key: 'view_logs', label: 'ดูบันทึกกิจกรรม', group: 'ระบบ' },
  { key: 'view_settings', label: 'ดูตั้งค่า', group: 'ระบบ' },
];

const EMPTY_STAFF = {
  email: '',
  displayName: '',
  password: '',
  permissions: Object.fromEntries(STAFF_PERMISSION_OPTIONS.map((item) => [item.key, ['view_cameras', 'care_logs'].includes(item.key)])),
};

const EMPTY_CUSTOMER = { email: '', displayName: '', password: '' };

function cleanDisplayName(name) {
  const text = String(name || '').trim();
  if (!text) return '';
  const broken = (text.match(/[?\uFFFD]/g) || []).length;
  if (broken >= Math.max(2, Math.ceil(text.replace(/\s/g, '').length * 0.6))) return '';
  return text;
}

function initialOf(name) {
  const text = cleanDisplayName(name);
  return text ? text.slice(0, 1).toUpperCase() : '?';
}

function permissionLabel(key) {
  return STAFF_PERMISSION_OPTIONS.find((item) => item.key === key)?.label || key;
}

function activePermissionKeys(permissions = {}) {
  return Object.entries(permissions).filter(([, on]) => on).map(([key]) => key);
}

export function UsersPanel({ mode, session }) {
  const isAdmin = session?.user?.role === 'admin';
  const [tab, setTab] = useState(isAdmin ? 'staff' : 'customers');
  const [customers, setCustomers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [created, setCreated] = useState('');
  const [busy, setBusy] = useState(false);
  const [composer, setComposer] = useState(null);
  const [staffForm, setStaffForm] = useState(EMPTY_STAFF);
  const [customerForm, setCustomerForm] = useState(EMPTY_CUSTOMER);
  const [editingStaff, setEditingStaff] = useState(null);

  async function load() {
    const tasks = [api('/api/admin/customers')];
    if (isAdmin) tasks.push(api('/api/admin/staff'));
    const [customerData, staffData] = await Promise.all(tasks);
    setCustomers(customerData.items);
    if (staffData) setStaff(staffData.items);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [isAdmin]);

  if (mode === 'roles') return <RolesPanel />;

  const q = query.trim().toLowerCase();
  const visibleStaff = staff.filter((item) => {
    if (!q) return true;
    return `${cleanDisplayName(item.displayName)} ${item.email}`.toLowerCase().includes(q);
  });
  const visibleCustomers = customers.filter((item) => {
    if (!q) return true;
    return `${cleanDisplayName(item.displayName)} ${item.email}`.toLowerCase().includes(q);
  });

  function openCreate() {
    setError('');
    setCreated('');
    if (tab === 'staff') {
      setEditingStaff(null);
      setStaffForm(EMPTY_STAFF);
      setComposer('staff');
    } else {
      setCustomerForm(EMPTY_CUSTOMER);
      setComposer('customer');
    }
  }

  function openEditStaff(item) {
    setEditingStaff(item);
    setStaffForm({
      email: item.email,
      displayName: cleanDisplayName(item.displayName),
      password: '',
      permissions: { ...EMPTY_STAFF.permissions, ...(item.permissions || {}) },
    });
    setComposer('staff');
    setTab('staff');
  }

  function closeComposer() {
    setComposer(null);
    setEditingStaff(null);
    setStaffForm(EMPTY_STAFF);
    setCustomerForm(EMPTY_CUSTOMER);
  }

  async function saveStaff(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setCreated('');
    try {
      if (editingStaff) {
        await api(`/api/admin/staff/${editingStaff.id}`, {
          method: 'PATCH',
          body: {
            displayName: staffForm.displayName,
            permissions: staffForm.permissions,
            password: staffForm.password || undefined,
          },
        });
        setCreated(`บันทึกพนักงาน ${staffForm.displayName} แล้ว`);
      } else {
        const result = await api('/api/admin/staff', { method: 'POST', body: staffForm });
        setCreated(`สร้างพนักงานแล้ว · อีเมล ${result.user.email} · รหัส ${result.password}`);
      }
      closeComposer();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveCustomer(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setCreated('');
    try {
      const result = await api('/api/admin/customers', { method: 'POST', body: customerForm });
      setCreated(`สร้างลูกค้าแล้ว · อีเมล ${result.user.email} · รหัส ${result.password}`);
      closeComposer();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleStaff(item) {
    setBusy(true);
    setError('');
    try {
      await api(`/api/admin/staff/${item.id}`, { method: 'PATCH', body: { isActive: !item.isActive } });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleCustomer(item) {
    setBusy(true);
    setError('');
    try {
      await api(`/api/admin/customers/${item.id}`, { method: 'PATCH', body: { isActive: !item.isActive } });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const showingStaff = tab === 'staff' && isAdmin;
  const list = showingStaff ? visibleStaff : visibleCustomers;

  const permissionGroups = STAFF_PERMISSION_OPTIONS.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  return (
    <div className="page users-page">
      <div className="page-head">
        <div>
          <h1>จัดการผู้ใช้</h1>
          <p className="muted">ดูรายชื่อ เปิด-ปิดบัญชี และกำหนดสิทธิ์พนักงาน</p>
        </div>
        <button className="button" type="button" onClick={openCreate}>
          {showingStaff ? '+ เพิ่มพนักงาน' : '+ เพิ่มลูกค้า'}
        </button>
      </div>

      <div className="users-toolbar">
        {isAdmin ? (
          <div className="users-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              className={tab === 'staff' ? 'active' : ''}
              aria-selected={tab === 'staff'}
              onClick={() => { setTab('staff'); setQuery(''); }}
            >
              พนักงาน <span>{staff.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              className={tab === 'customers' ? 'active' : ''}
              aria-selected={tab === 'customers'}
              onClick={() => { setTab('customers'); setQuery(''); }}
            >
              ลูกค้า <span>{customers.length}</span>
            </button>
          </div>
        ) : <div />}
        <label className="search users-search">
          <IconSearch />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={showingStaff ? 'ค้นหาชื่อหรืออีเมลพนักงาน' : 'ค้นหาชื่อหรืออีเมลลูกค้า'}
          />
        </label>
      </div>

      {error ? <p className="banner error">{error}</p> : null}
      {created ? <p className="banner ok">{created}</p> : null}

      <section className="panel users-panel">
        {list.length === 0 ? (
          <div className="users-empty">
            <strong>{showingStaff ? 'ยังไม่มีพนักงาน' : 'ยังไม่มีลูกค้า'}</strong>
            <p className="muted">{q ? 'ไม่พบตามคำค้นหา' : 'กดปุ่มเพิ่มด้านบนเพื่อสร้างบัญชีแรก'}</p>
            {!q ? <button className="button" type="button" onClick={openCreate}>{showingStaff ? '+ เพิ่มพนักงาน' : '+ เพิ่มลูกค้า'}</button> : null}
          </div>
        ) : (
          <ul className="people-list">
            {showingStaff
              ? visibleStaff.map((item) => {
                const keys = activePermissionKeys(item.permissions);
                return (
                  <li key={item.id} className={`person-row ${item.isActive ? '' : 'is-disabled'}`}>
                    <span className="avatar person-avatar">{initialOf(item.displayName)}</span>
                    <div className="person-main">
                      <div className="person-title">
                        <strong>{cleanDisplayName(item.displayName) || 'ไม่มีชื่อ'}</strong>
                        <span className={`pill ${item.isActive ? 'online' : 'offline'}`}>{item.isActive ? 'ใช้งาน' : 'ปิดอยู่'}</span>
                      </div>
                      <p className="muted">{item.email}</p>
                      <div className="perm-chips">
                        {keys.length === 0 ? <span className="perm-chip muted-chip">ยังไม่ให้สิทธิ์</span> : null}
                        {keys.slice(0, 4).map((key) => <span className="perm-chip" key={key}>{permissionLabel(key)}</span>)}
                        {keys.length > 4 ? <span className="perm-chip more-chip">+{keys.length - 4}</span> : null}
                      </div>
                    </div>
                    <div className="person-actions">
                      <button className="button ghost tiny" type="button" onClick={() => openEditStaff(item)}>แก้สิทธิ์</button>
                      <button className="button ghost tiny" type="button" disabled={busy} onClick={() => toggleStaff(item)}>
                        {item.isActive ? 'ปิดใช้' : 'เปิดใช้'}
                      </button>
                    </div>
                  </li>
                );
              })
              : visibleCustomers.map((item) => (
                <li key={item.id} className={`person-row ${item.isActive ? '' : 'is-disabled'}`}>
                  <span className="avatar person-avatar customer">{initialOf(item.displayName)}</span>
                  <div className="person-main">
                    <div className="person-title">
                      <strong>{cleanDisplayName(item.displayName) || 'ไม่มีชื่อ'}</strong>
                      <span className={`pill ${item.isActive ? 'online' : 'offline'}`}>{item.isActive ? 'ใช้งาน' : 'ปิดอยู่'}</span>
                    </div>
                    <p className="muted">{item.email}</p>
                  </div>
                  <div className="person-actions">
                    <button className="button ghost tiny" type="button" disabled={busy} onClick={() => toggleCustomer(item)}>
                      {item.isActive ? 'ปิดใช้' : 'เปิดใช้'}
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </section>

      {composer === 'staff' ? (
        <div className="overlay" onClick={closeComposer}>
          <div className="modal profile-modal users-modal" onClick={(event) => event.stopPropagation()}>
            <div className="card-top">
              <div>
                <h2>{editingStaff ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงาน'}</h2>
                <p className="muted tiny">ตั้งชื่อบัญชี แล้วเลือกสิทธิ์ที่ให้ทำได้</p>
              </div>
              <button className="button ghost" type="button" onClick={closeComposer}>ปิด</button>
            </div>
            <form onSubmit={saveStaff}>
              <div className="form-row">
                <label>ชื่อที่แสดง
                  <input value={staffForm.displayName} onChange={(event) => setStaffForm({ ...staffForm, displayName: event.target.value })} required />
                </label>
                <label>อีเมลเข้าสู่ระบบ
                  <input type="email" value={staffForm.email} onChange={(event) => setStaffForm({ ...staffForm, email: event.target.value })} required disabled={Boolean(editingStaff)} />
                </label>
              </div>
              <label>{editingStaff ? 'รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)' : 'รหัสผ่านเริ่มต้น'}
                <input type="text" value={staffForm.password} onChange={(event) => setStaffForm({ ...staffForm, password: event.target.value })} required={!editingStaff} minLength={4} />
              </label>

              <div className="perm-sections">
                {Object.entries(permissionGroups).map(([group, items]) => (
                  <div className="perm-section" key={group}>
                    <h3>{group}</h3>
                    <div className="perm-grid">
                      {items.map((item) => (
                        <label className={`perm-toggle ${staffForm.permissions[item.key] ? 'on' : ''}`} key={item.key}>
                          <input
                            type="checkbox"
                            checked={Boolean(staffForm.permissions[item.key])}
                            onChange={(event) => setStaffForm({
                              ...staffForm,
                              permissions: { ...staffForm.permissions, [item.key]: event.target.checked },
                            })}
                          />
                          <span>{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="card-actions">
                <button className="button ghost" type="button" onClick={closeComposer}>ยกเลิก</button>
                <button className="button" type="submit" disabled={busy}>{busy ? 'กำลังบันทึก' : editingStaff ? 'บันทึก' : 'สร้างพนักงาน'}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {composer === 'customer' ? (
        <div className="overlay" onClick={closeComposer}>
          <div className="modal profile-modal users-modal" onClick={(event) => event.stopPropagation()}>
            <div className="card-top">
              <div>
                <h2>เพิ่มลูกค้า</h2>
                <p className="muted tiny">สร้างบัญชีให้ลูกค้าเข้าดูกล้องได้</p>
              </div>
              <button className="button ghost" type="button" onClick={closeComposer}>ปิด</button>
            </div>
            <form onSubmit={saveCustomer}>
              <label>ชื่อที่แสดง
                <input value={customerForm.displayName} onChange={(event) => setCustomerForm({ ...customerForm, displayName: event.target.value })} required />
              </label>
              <label>อีเมล
                <input type="email" value={customerForm.email} onChange={(event) => setCustomerForm({ ...customerForm, email: event.target.value })} required />
              </label>
              <label>รหัสผ่าน
                <input type="text" value={customerForm.password} onChange={(event) => setCustomerForm({ ...customerForm, password: event.target.value })} required minLength={8} />
              </label>
              <div className="card-actions">
                <button className="button ghost" type="button" onClick={closeComposer}>ยกเลิก</button>
                <button className="button" type="submit" disabled={busy}>{busy ? 'กำลังสร้าง' : 'สร้างลูกค้า'}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
