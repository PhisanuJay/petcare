import { useEffect, useState } from 'react';
import Shell from '../components/Shell';
import CameraCard from '../components/CameraCard';
import WatchBoard from '../components/WatchBoard';
import { IconCamera, IconSearch } from '../components/Marks';
import { api, bangkokInput, formatWhen, statusLabel } from '../api';
import { LogsPanel, RoomsPanel, SettingsPanel, UsersPanel } from './AdminSections';

const emptyForm = {
  rtspUrl: '',
  roomLabel: '',
  catName: '',
  isEnabled: true,
};

export default function AdminCameras() {
  return (
    <Shell role="admin">
      {(session, nav) => <AdminBody session={session} section={nav.section} />}
    </Shell>
  );
}

function can(user, key) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return Boolean(user.permissions && user.permissions[key]);
}

function sectionTitle(focusLive, showManage, canManage) {
  if (focusLive) return 'ดูภาพสด';
  if (showManage && canManage) return 'จัดการกล้อง';
  return 'ภาพรวมกล้อง';
}

function AdminBody({ session, section }) {
  if (section === 'users' || section === 'roles') {
    return <UsersPanel mode={section} session={session} />;
  }
  if (section === 'rooms') return <RoomsPanel />;
  if (section === 'logs') return <LogsPanel />;
  if (section === 'settings') return <SettingsPanel />;
  return (
    <CameraDesk
      focusLive={section === 'live'}
      showManage={section === 'cameras' || (section === 'dashboard' && can(session.user, 'manage_cameras'))}
      canManage={can(session.user, 'manage_cameras')}
      canGrant={can(session.user, 'manage_grants')}
      canCare={can(session.user, 'care_logs')}
      session={session}
    />
  );
}

function CameraDesk({ focusLive = false, showManage = true, canManage = true, canGrant = true, canCare = true }) {
  const [query, setQuery] = useState({ q: '', status: '', page: 1 });
  const [draft, setDraft] = useState({ q: '', status: '' });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [preview, setPreview] = useState(null);
  const [grantsFor, setGrantsFor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formMsg, setFormMsg] = useState('');

  async function load(next = query) {
    const params = new URLSearchParams();
    if (next.q) params.set('q', next.q);
    if (next.status) params.set('status', next.status);
    params.set('page', String(next.page));
    try {
      setData(await api(`/api/admin/cameras?${params}`));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load(query);
  }, [query.q, query.status, query.page]);

  async function saveCamera(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setFormMsg(form.id ? 'กำลังบันทึก' : 'กำลังเชื่อมต่อกล้อง');
    const room = form.roomLabel?.trim() || '';
    const cat = form.catName?.trim() || '';
    const name = room && cat ? `${room} · ${cat}` : room || cat || 'กล้อง';
    const body = {
      name,
      description: '',
      roomLabel: room,
      catName: cat,
      isEnabled: form.isEnabled !== false,
    };
    if (form.rtspUrl) body.rtspUrl = form.rtspUrl.trim();
    try {
      if (form.id) await api(`/api/admin/cameras/${form.id}`, { method: 'PATCH', body });
      else {
        if (!body.rtspUrl) throw new Error('ใส่ที่อยู่กล้องก่อน');
        await api('/api/admin/cameras', { method: 'POST', body });
      }
      setForm(null);
      setFormMsg('');
      await load();
    } catch (err) {
      setError(err.message);
      setFormMsg('');
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled(camera) {
    setBusy(true);
    try {
      await api(`/api/admin/cameras/${camera.id}`, {
        method: 'PATCH',
        body: { isEnabled: !camera.isEnabled },
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function recheck(camera) {
    setBusy(true);
    try {
      await api(`/api/admin/cameras/${camera.id}/recheck`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      await api(`/api/admin/cameras/${removeTarget.id}`, { method: 'DELETE' });
      setRemoveTarget(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const summary = data?.summary || { total: 0, online: 0, offline: 0, connecting: 0 };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const latest = data?.items.map((item) => item.lastSeenAt).filter(Boolean).sort().at(-1);
  const pct = summary.total ? Math.round((summary.online / summary.total) * 1000) / 10 : 0;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{focusLive ? 'ดูภาพสด' : sectionTitle(focusLive, showManage, canManage)}</h1>
          <p className="muted">{focusLive ? 'กดการ์ดกล้องเพื่อเปิดดูแบบเต็มจอ' : 'สถานะจริงจากกล้องที่เชื่อมต่ออยู่'}</p>
        </div>
        <div className="page-tools">
          {summary.online > 0 ? <span className="pill live">ระบบพร้อมใช้งาน</span> : null}
          <span className="muted tiny">อัปเดต {formatWhen(latest)}</span>
          <button className="icon-round" type="button" onClick={() => load()} aria-label="รีเฟรช">↻</button>
          {!focusLive && canManage ? <button className="button" type="button" onClick={() => { setError(''); setFormMsg(''); setForm({ ...emptyForm }); }}>+ เพิ่มกล้อง</button> : null}
        </div>
      </div>

      {error && !form ? <p className="banner error">{error}</p> : null}

      <section className="stat-row">
        <Stat label="ทั้งหมด" value={summary.total} tone="total" unit="กล้อง" />
        <Stat label="ออนไลน์" value={summary.online} tone="online" unit="กล้อง" />
        <Stat label="กำลังเชื่อม" value={summary.connecting} tone="connecting" unit="กล้อง" />
        <Stat label="ออฟไลน์" value={summary.offline} tone="offline" unit="กล้อง" />
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>กล้องทั้งหมด</h2>
          <form className="toolbar compact" onSubmit={(event) => { event.preventDefault(); setQuery({ q: draft.q, status: draft.status, page: 1 }); }}>
            <label className="search">
              <IconSearch />
              <input placeholder="ค้นหากล้อง ห้อง หรือชื่อแมว" value={draft.q} onChange={(event) => setDraft({ ...draft, q: event.target.value })} />
            </label>
            <select value={draft.status} onChange={(event) => { const status = event.target.value; setDraft({ ...draft, status }); setQuery({ ...query, status, page: 1 }); }} aria-label="สถานะ">
              <option value="">ทุกสถานะ</option>
              <option value="online">ออนไลน์</option>
              <option value="connecting">กำลังเชื่อมต่อ</option>
              <option value="offline">ออฟไลน์</option>
            </select>
          </form>
        </div>
        {!data ? <p className="muted">กำลังโหลด</p> : null}
        {data && data.items.length === 0 ? <div className="empty">ยังไม่มีกล้อง กดเพิ่มกล้องแล้วใส่ที่อยู่ RTSP ได้เลย</div> : null}
        <section className="thumb-grid">
          {data?.items.map((camera) => (
            <CameraCard
              key={camera.id}
              camera={{ ...camera, mode: 'admin' }}
              showLive={!preview}
              onOpen={() => setPreview(camera)}
              onPicture={() => load()}
            />
          ))}
        </section>
      </section>

      {showManage ? (
      <div className="dash-bottom">
        <section className="panel grow">
          <div className="section-head">
            <h2>จัดการกล้อง</h2>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ชื่อ</th>
                  <th>ห้อง</th>
                  <th>สถานะ</th>
                  <th>เปิดใช้</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((camera) => (
                  <tr key={camera.id}>
                    <td>
                      <strong>{camera.name}</strong>
                      {camera.catName ? <span className="cell-sub">{camera.catName}</span> : null}
                    </td>
                    <td>{camera.roomLabel || '—'}</td>
                    <td>
                      <span className={`status-dot ${camera.streamStatus}`}>{statusLabel(camera.streamStatus)}</span>
                    </td>
                    <td>
                      <button
                        className={`toggle ${camera.isEnabled ? 'on' : ''}`}
                        type="button"
                        disabled={busy || !canManage}
                        onClick={() => toggleEnabled(camera)}
                        aria-label={camera.isEnabled ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                      />
                    </td>
                    <td className="row-actions">
                      <button className="button ghost tiny" type="button" onClick={() => setPreview(camera)} disabled={!camera.isEnabled}>ดู</button>
                      {canManage ? <button className="button ghost tiny" type="button" onClick={() => recheck(camera)} disabled={busy}>ตรวจใหม่</button> : null}
                      {canGrant ? <button className="button ghost tiny" type="button" onClick={() => setGrantsFor(camera)}>สิทธิ์</button> : null}
                      {canManage ? <button className="button ghost tiny" type="button" onClick={() => { setError(''); setForm({ ...camera, rtspUrl: '', name: camera.name }); }}>แก้ไข</button> : null}
                      {canManage ? <button className="button danger tiny" type="button" onClick={() => setRemoveTarget(camera)}>ลบ</button> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && data.total > data.pageSize ? (
            <div className="pager">
              <button className="button ghost" type="button" disabled={query.page <= 1} onClick={() => setQuery({ ...query, page: query.page - 1 })}>ก่อนหน้า</button>
              <span>{query.page} / {pages}</span>
              <button className="button ghost" type="button" disabled={query.page >= pages} onClick={() => setQuery({ ...query, page: query.page + 1 })}>ถัดไป</button>
            </div>
          ) : null}
        </section>

        <section className="panel connect-panel">
          <h2>สถานะการเชื่อมต่อ</h2>
          <div className="donut-row">
            <div className="donut" style={{ background: `conic-gradient(#10b981 ${pct}%, #ef5350 0)` }}>
              <div className="donut-hole">
                <strong>{pct}%</strong>
                <span>ออนไลน์</span>
              </div>
            </div>
            <ul className="legend">
              <li><span><i className="dot online" />ออนไลน์</span><strong>{summary.online}</strong></li>
              <li><span><i className="dot offline" />ออฟไลน์</span><strong>{summary.offline}</strong></li>
              <li><span><i className="dot connecting" />กำลังเชื่อม</span><strong>{summary.connecting}</strong></li>
            </ul>
          </div>
          <div className={`system-banner ${summary.offline === 0 && summary.total > 0 ? 'ok' : ''}`}>
            <strong>{summary.total === 0 ? 'ยังไม่มีกล้อง' : summary.offline === 0 ? 'ระบบทำงานปกติ' : 'มีกล้องที่ยังเชื่อมไม่ได้'}</strong>
            <p>{summary.total === 0 ? 'เพิ่มกล้องด้วยที่อยู่ RTSP ได้เลย' : `ออนไลน์ ${summary.online} จาก ${summary.total} ตัว`}</p>
          </div>
        </section>
      </div>
      ) : null}

      {form ? (
        <div className="overlay"><div className="modal">
          <form onSubmit={saveCamera}>
            <h2>{form.id ? 'แก้ไขกล้อง' : 'เพิ่มกล้อง'}</h2>
            <p className="muted">ใส่ที่อยู่กล้องแล้วกดเชื่อมต่อ ระบบจะตรวจให้ทันที</p>
            {error ? <p className="banner error">{error}</p> : null}
            {formMsg ? <p className="banner ok">{formMsg}</p> : null}
            <label>ที่อยู่กล้อง (RTSP)
              <input
                value={form.rtspUrl}
                autoComplete="off"
                placeholder={form.id ? 'เว้นว่างถ้าไม่เปลี่ยนรหัส' : 'rtsp://user:pass@192.168.1.45:554/stream1'}
                onChange={(event) => setForm({ ...form, rtspUrl: event.target.value })}
                required={!form.id}
              />
            </label>
            <div className="form-row">
              <label>ห้อง<input value={form.roomLabel || ''} onChange={(event) => setForm({ ...form, roomLabel: event.target.value })} placeholder="เช่น A" /></label>
              <label>ชื่อแมว<input value={form.catName || ''} onChange={(event) => setForm({ ...form, catName: event.target.value })} placeholder="เช่น มะลิ" /></label>
            </div>
            <label className="check"><input type="checkbox" checked={form.isEnabled !== false} onChange={(event) => setForm({ ...form, isEnabled: event.target.checked })} />เปิดใช้งานทันที</label>
            <div className="card-actions">
              <button className="button" type="submit" disabled={busy}>{busy ? 'กำลังเชื่อมต่อ' : form.id ? 'บันทึก' : 'เชื่อมต่อ'}</button>
              <button className="button ghost" type="button" onClick={() => { setForm(null); setFormMsg(''); }}>ยกเลิก</button>
            </div>
          </form>
        </div></div>
      ) : null}

      {removeTarget ? (
        <div className="overlay"><div className="modal">
          <h2>ลบกล้อง {removeTarget.name}?</h2>
          <p>สิทธิ์ดูภาพของลูกค้าสำหรับกล้องนี้จะถูกเพิกถอน</p>
          <div className="card-actions">
            <button className="button danger" type="button" onClick={confirmDelete} disabled={busy}>ลบกล้อง</button>
            <button className="button ghost" type="button" onClick={() => setRemoveTarget(null)}>ยกเลิก</button>
          </div>
        </div></div>
      ) : null}

      {preview ? (
        <div className="watch-overlay">
          <WatchBoard camera={preview} mode="admin" canLog={canCare} onClose={() => setPreview(null)} />
        </div>
      ) : null}

      {grantsFor ? <GrantPanel camera={grantsFor} onClose={() => setGrantsFor(null)} /> : null}
    </div>
  );
}

function Stat({ label, value, tone, unit }) {
  return (
    <article className="stat-card">
      <span className={`stat-icon ${tone || 'total'}`}><IconCamera /></span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {unit ? <small>{unit}</small> : null}
      </div>
    </article>
  );
}

function GrantPanel({ camera, onClose }) {
  const [customers, setCustomers] = useState([]);
  const [grants, setGrants] = useState([]);
  const [error, setError] = useState('');
  const [created, setCreated] = useState('');
  const [account, setAccount] = useState({ email: '', displayName: '', password: '' });
  const [grant, setGrant] = useState({
    userId: '',
    petName: camera.catName || '',
    roomLabel: camera.roomLabel || '',
    startsAt: bangkokInput(new Date()),
    endsAt: bangkokInput(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
  });

  async function load() {
    const [people, access] = await Promise.all([
      api('/api/admin/customers'),
      api(`/api/admin/cameras/${camera.id}/grants`),
    ]);
    setCustomers(people.items);
    setGrants(access.items);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [camera.id]);

  async function addCustomer(event) {
    event.preventDefault();
    setError('');
    try {
      const result = await api('/api/admin/customers', { method: 'POST', body: account });
      setCreated(`สร้างบัญชี ${result.user.email} แล้ว รหัสผ่าน ${result.password} แสดงครั้งนี้ครั้งเดียว`);
      setAccount({ email: '', displayName: '', password: '' });
      setGrant({ ...grant, userId: result.user.id });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function addGrant(event) {
    event.preventDefault();
    setError('');
    try {
      await api(`/api/admin/cameras/${camera.id}/grants`, {
        method: 'POST',
        body: { ...grant, userId: Number(grant.userId) },
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function revoke(id) {
    setError('');
    try {
      await api(`/api/admin/grants/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="overlay"><div className="modal wide">
      <div className="card-top">
        <h2>สิทธิ์ดู {camera.name}</h2>
        <button className="button ghost" type="button" onClick={onClose}>ปิด</button>
      </div>
      {error ? <p className="banner error">{error}</p> : null}
      {created ? <p className="banner ok">{created}</p> : null}
      <div className="split">
        <form onSubmit={addCustomer}>
          <h3>สร้างบัญชีลูกค้า</h3>
          <label>ชื่อ<input value={account.displayName} onChange={(event) => setAccount({ ...account, displayName: event.target.value })} required /></label>
          <label>อีเมล<input type="email" value={account.email} onChange={(event) => setAccount({ ...account, email: event.target.value })} required /></label>
          <label>รหัสผ่าน<input type="text" value={account.password} onChange={(event) => setAccount({ ...account, password: event.target.value })} required minLength={8} /></label>
          <button className="button" type="submit">สร้างบัญชี</button>
        </form>
        <form onSubmit={addGrant}>
          <h3>ให้สิทธิ์ดูกล้องนี้</h3>
          <label>ลูกค้า
            <select value={grant.userId} onChange={(event) => setGrant({ ...grant, userId: event.target.value })} required>
              <option value="">เลือก</option>
              {customers.filter((item) => item.isActive).map((item) => (
                <option value={item.id} key={item.id}>{item.displayName} · {item.email}</option>
              ))}
            </select>
          </label>
          <label>ชื่อแมวที่แสดง<input value={grant.petName} onChange={(event) => setGrant({ ...grant, petName: event.target.value })} /></label>
          <label>ชื่อห้องที่แสดง<input value={grant.roomLabel} onChange={(event) => setGrant({ ...grant, roomLabel: event.target.value })} /></label>
          <label>เริ่ม<input type="datetime-local" value={grant.startsAt} onChange={(event) => setGrant({ ...grant, startsAt: event.target.value })} required /></label>
          <label>สิ้นสุด<input type="datetime-local" value={grant.endsAt} onChange={(event) => setGrant({ ...grant, endsAt: event.target.value })} required /></label>
          <button className="button" type="submit">ให้สิทธิ์</button>
        </form>
      </div>
      {grants.length === 0 ? <div className="empty">ยังไม่มีการให้สิทธิ์</div> : null}
      <ul className="grant-list">
        {grants.map((item) => (
          <li key={item.id}>
            <div>
              <strong>{item.displayName}</strong>
              <p className="muted">{item.email} · {item.petName || 'ไม่ได้ระบุชื่อแมว'} · ถึง {formatWhen(item.endsAt)}</p>
              <span className={`pill ${item.isActive ? 'online' : 'offline'}`}>{item.revokedAt ? 'เพิกถอนแล้ว' : item.isActive ? 'ใช้ได้' : 'หมดอายุหรือยังไม่ถึงเวลา'}</span>
            </div>
            {!item.revokedAt ? <button className="button danger" type="button" onClick={() => revoke(item.id)}>เพิกถอน</button> : null}
          </li>
        ))}
      </ul>
    </div></div>
  );
}
