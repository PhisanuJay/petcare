import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IconSearch } from '../components/Marks';
import { api, bangkokInput, formatWhen, statusLabel } from '../api';

const CARE_LABEL = {
  feed: 'อาหาร',
  water: 'น้ำ',
  play: 'เล่น',
  walk: 'เดินเล่น',
  clean: 'ทำความสะอาด',
  health: 'สุขภาพ',
  custom: 'กิจกรรมอื่น',
};

const emptyCameraForm = {
  rtspUrl: '',
  roomLabel: '',
  catName: '',
  isEnabled: true,
};

export function RoomsHub({ canManage = true, canGrant = false } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('view') === 'access' ? 'access' : 'cameras';
  const grantCamera = searchParams.get('grantCamera') || '';

  function setView(next, cameraId = '') {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('tab', 'rooms');
      if (next === 'access') params.set('view', 'access');
      else params.delete('view');
      if (cameraId) params.set('grantCamera', String(cameraId));
      else params.delete('grantCamera');
      return params;
    }, { replace: true });
  }

  return (
    <div className="rooms-hub">
      <div className="rooms-hub-tabs" role="tablist" aria-label="จัดการกล้อง">
        <button
          type="button"
          role="tab"
          className={view === 'cameras' ? 'active' : ''}
          aria-selected={view === 'cameras'}
          onClick={() => setView('cameras')}
        >
          กล้อง
        </button>
        {canGrant ? (
          <button
            type="button"
            role="tab"
            className={view === 'access' ? 'active' : ''}
            aria-selected={view === 'access'}
            onClick={() => setView('access')}
          >
            สิทธิ์ลูกค้า
          </button>
        ) : null}
      </div>
      {view === 'access' && canGrant ? (
        <RolesPanel embedded initialCameraId={grantCamera} />
      ) : (
        <RoomsPanel
          canManage={canManage}
          canGrant={canGrant}
          onOpenAccess={(cameraId) => setView('access', cameraId)}
        />
      )}
    </div>
  );
}

export function RoomsPanel({ canManage = true, canGrant = false, onOpenAccess } = {}) {
  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [formMsg, setFormMsg] = useState('');
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [filter, setFilter] = useState({ q: '', status: '' });

  async function load() {
    const data = await api('/api/admin/rooms');
    setRooms(data.items);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  function openAdd(roomLabel = '') {
    setError('');
    setFormMsg('');
    setAdding({
      ...emptyCameraForm,
      roomLabel: roomLabel === 'ไม่ได้ระบุห้อง' ? '' : roomLabel,
    });
  }

  async function saveCamera(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const room = editing.roomLabel?.trim() || '';
      const cat = editing.catName?.trim() || '';
      const body = {
        roomLabel: room,
        catName: cat,
        name: room && cat ? `${room} · ${cat}` : room || cat || 'กล้อง',
      };
      const rtspUrl = editing.rtspUrl?.trim();
      if (rtspUrl) body.rtspUrl = rtspUrl;
      await api(`/api/admin/cameras/${editing.id}`, {
        method: 'PATCH',
        body,
      });
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function addCamera(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setFormMsg('กำลังเชื่อมต่อกล้อง');
    const room = adding.roomLabel?.trim() || '';
    const cat = adding.catName?.trim() || '';
    const name = room && cat ? `${room} · ${cat}` : room || cat || 'กล้อง';
    const rtspUrl = adding.rtspUrl?.trim() || '';
    try {
      if (!rtspUrl) throw new Error('ใส่ที่อยู่กล้องก่อน');
      await api('/api/admin/cameras', {
        method: 'POST',
        body: {
          name,
          description: '',
          roomLabel: room,
          catName: cat,
          rtspUrl,
          isEnabled: true,
        },
      });
      setAdding(null);
      setFormMsg('');
      await load();
    } catch (err) {
      setError(err.message);
      setFormMsg('');
    } finally {
      setBusy(false);
    }
  }

  async function renameRoom(event) {
    event.preventDefault();
    if (!renaming?.fromLabel || !renaming?.toLabel?.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api('/api/admin/rooms/rename', {
        method: 'PATCH',
        body: { fromLabel: renaming.fromLabel, toLabel: renaming.toLabel.trim() },
      });
      setRenaming(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled(camera) {
    if (busy) return;
    const next = !camera.isEnabled;
    setRooms((prev) => prev.map((room) => ({
      ...room,
      cameras: room.cameras.map((cam) => (
        cam.id === camera.id ? { ...cam, isEnabled: next } : cam
      )),
    })));
    setBusy(true);
    setError('');
    try {
      await api(`/api/admin/cameras/${camera.id}/toggle`, { method: 'PATCH' });
      await load();
    } catch (err) {
      setError(err.message);
      await load().catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  async function recheck(camera) {
    setBusy(true);
    setError('');
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
    if (!removeTarget) return;
    setBusy(true);
    setError('');
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

  const namedRooms = rooms.filter((room) => room.roomLabel !== 'ไม่ได้ระบุห้อง');
  const allCameras = rooms.flatMap((room) => room.cameras);
  const summary = {
    total: allCameras.length,
    online: allCameras.filter((cam) => cam.streamStatus === 'online').length,
    connecting: allCameras.filter((cam) => cam.streamStatus === 'connecting').length,
    offline: allCameras.filter((cam) => cam.streamStatus === 'offline').length,
  };
  const q = filter.q.trim().toLowerCase();
  const filteredRooms = rooms
    .map((room) => {
      const cameras = room.cameras.filter((camera) => {
        if (filter.status && camera.streamStatus !== filter.status) return false;
        if (!q) return true;
        const hay = [camera.name, camera.catName, camera.roomLabel, room.roomLabel]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
      if (cameras.length === 0) {
        if (!q && !filter.status) return room;
        if (q && String(room.roomLabel || '').toLowerCase().includes(q) && !filter.status) {
          return { ...room, cameras: room.cameras };
        }
        return null;
      }
      return {
        ...room,
        cameras,
        cameraCount: cameras.length,
        online: cameras.filter((cam) => cam.streamStatus === 'online').length,
      };
    })
    .filter(Boolean);
  const filteredCamCount = filteredRooms.reduce((sum, room) => sum + room.cameras.length, 0);

  return (
    <div className="page rooms-page">
      <div className="page-head">
        <div>
          <h1>จัดการกล้อง</h1>
          <p className="muted">เพิ่ม แก้ ลบ และตรวจสถานะกล้องตามห้อง</p>
        </div>
        <div className="page-tools">
          <span className="rooms-stat-pill">{namedRooms.length} ห้อง</span>
          <span className="rooms-stat-pill soft">{summary.online}/{summary.total} ออนไลน์</span>
          <button className="button ghost" type="button" onClick={() => load().catch((err) => setError(err.message))}>รีเฟรช</button>
          {canManage ? (
            <button className="button" type="button" onClick={() => openAdd()}>+ เพิ่มกล้อง</button>
          ) : null}
        </div>
      </div>
      {error && !adding && !editing && !removeTarget ? <p className="banner error">{error}</p> : null}

      {rooms.length === 0 ? (
        <div className="empty rooms-empty">
          ยังไม่มีกล้อง
          {canManage ? (
            <button className="button" type="button" onClick={() => openAdd()} style={{ marginTop: 12 }}>
              + เพิ่มกล้อง
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <section className="panel rooms-filter-panel">
            <label className="search rooms-filter-search">
              <IconSearch />
              <input
                value={filter.q}
                onChange={(event) => setFilter({ ...filter, q: event.target.value })}
                placeholder="ค้นหาห้อง หรือชื่อแมว"
                aria-label="ค้นหากล้อง"
              />
            </label>
            <div className="chip-row camera-status-chips" role="group" aria-label="กรองสถานะ">
              {[
                ['', 'ทั้งหมด', summary.total],
                ['online', 'ออนไลน์', summary.online],
                ['connecting', 'กำลังเชื่อม', summary.connecting],
                ['offline', 'ออฟไลน์', summary.offline],
              ].map(([value, label, count]) => (
                <button
                  key={value || 'all'}
                  type="button"
                  className={`chip-btn ${filter.status === value ? 'active' : ''} ${value || 'all'}`}
                  onClick={() => setFilter({ ...filter, status: value })}
                >
                  <span>{label}</span>
                  <em>{count}</em>
                </button>
              ))}
            </div>
            {(q || filter.status) && filteredCamCount === 0 ? (
              <p className="muted tiny rooms-filter-empty">ไม่พบกล้องตามเงื่อนไข</p>
            ) : null}
          </section>

          {filteredRooms.length === 0 ? (
            <div className="empty rooms-empty">ไม่พบกล้องตามเงื่อนไข</div>
          ) : (
            <div className="room-grid">
              {filteredRooms.map((room) => {
                const canRename = room.roomLabel !== 'ไม่ได้ระบุห้อง';
                const isRenaming = renaming?.fromLabel === room.roomLabel;
                return (
                  <section className="panel room-card" key={room.roomLabel}>
                    <div className="room-card-head">
                      <div className="room-card-title">
                        <span className="room-card-mark">{String(room.roomLabel || '?').slice(0, 1)}</span>
                        <div>
                          <h2>{room.roomLabel}</h2>
                          <p className="muted tiny">
                            {room.cameras.length} กล้อง · {room.online} ออนไลน์
                          </p>
                        </div>
                      </div>
                      {canRename && !isRenaming ? (
                        <button
                          className="button ghost tiny"
                          type="button"
                          onClick={() => setRenaming({ fromLabel: room.roomLabel, toLabel: room.roomLabel })}
                        >
                          เปลี่ยนชื่อ
                        </button>
                      ) : null}
                    </div>

                    {isRenaming ? (
                      <form className="room-rename-inline" onSubmit={renameRoom}>
                        <input
                          value={renaming.toLabel}
                          onChange={(event) => setRenaming({ ...renaming, toLabel: event.target.value })}
                          required
                          maxLength={120}
                          placeholder="ชื่อห้องใหม่"
                          autoFocus
                        />
                        <button className="button tiny" type="submit" disabled={busy || !renaming.toLabel.trim() || renaming.toLabel.trim() === renaming.fromLabel}>
                          บันทึก
                        </button>
                        <button className="button ghost tiny" type="button" onClick={() => setRenaming(null)}>ยกเลิก</button>
                      </form>
                    ) : null}

                    <ul className="room-cam-list">
                      {room.cameras.map((camera) => (
                        <li key={camera.id} className={!camera.isEnabled ? 'disabled' : ''}>
                          <div className="room-cam-top">
                            <div className="room-cam-main">
                              <strong>{camera.name}</strong>
                              <span className="muted">{camera.catName || 'ยังไม่ระบุชื่อแมว'}</span>
                            </div>
                            <span className={`status-dot ${camera.streamStatus}`}>{statusLabel(camera.streamStatus)}</span>
                          </div>
                          {canManage ? (
                            <div className="room-cam-actions">
                              <button
                                className={`room-cam-power ${camera.isEnabled ? 'on' : ''}`}
                                type="button"
                                disabled={busy}
                                onClick={() => toggleEnabled(camera)}
                                aria-pressed={camera.isEnabled}
                                aria-label={camera.isEnabled ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                              >
                                <span className={`toggle ${camera.isEnabled ? 'on' : ''}`} aria-hidden="true" />
                                <span>{camera.isEnabled ? 'เปิดใช้' : 'ปิดอยู่'}</span>
                              </button>
                              <div className="room-cam-tools">
                                <button
                                  className="room-tool"
                                  type="button"
                                  disabled={busy}
                                  onClick={() => recheck(camera)}
                                  title="ตรวจใหม่"
                                >
                                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 0 1 12.8-5.3L19 8.5V4h-1.5v3.2L15.7 5.4A9 9 0 1 0 21 12h-1.5A7.5 7.5 0 0 1 4.5 12Z" fill="currentColor"/></svg>
                                  ตรวจใหม่
                                </button>
                                <button
                                  className="room-tool"
                                  type="button"
                                  onClick={() => {
                                    setError('');
                                    setEditing({
                                      id: camera.id,
                                      roomLabel: camera.roomLabel || '',
                                      catName: camera.catName || '',
                                      rtspUrl: '',
                                    });
                                  }}
                                  title="แก้ไข"
                                >
                                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17.5V20h2.5L17.1 9.4l-2.5-2.5L4 17.5Zm15.7-9.2a.7.7 0 0 0 0-1l-1.5-1.5a.7.7 0 0 0-1 0l-1.2 1.2 2.5 2.5 1.2-1.2Z" fill="currentColor"/></svg>
                                  แก้ไข
                                </button>
                                {canGrant && onOpenAccess ? (
                                  <button
                                    className="room-tool"
                                    type="button"
                                    onClick={() => onOpenAccess(camera.id)}
                                    title="ให้สิทธิ์ลูกค้า"
                                  >
                                    สิทธิ์
                                  </button>
                                ) : null}
                                <button
                                  className="room-tool danger"
                                  type="button"
                                  disabled={busy}
                                  onClick={() => {
                                    setError('');
                                    setRemoveTarget(camera);
                                  }}
                                  title="ลบกล้อง"
                                >
                                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1h4v1.5h-1.2l-1 12.2A2 2 0 0 1 15.8 23H8.2a2 2 0 0 1-2-1.8L5.2 7.5H4V6h4Zm1.5 0h5V5h-5v1Zm-1.1 1.5 1 11.8h6.2l1-11.8H8.4Z" fill="currentColor"/></svg>
                                  ลบ
                                </button>
                              </div>
                            </div>
                          ) : canGrant && onOpenAccess ? (
                            <div className="room-cam-actions">
                              <div className="room-cam-tools">
                                <button
                                  className="room-tool"
                                  type="button"
                                  onClick={() => onOpenAccess(camera.id)}
                                  title="ให้สิทธิ์ลูกค้า"
                                >
                                  สิทธิ์
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      {adding ? (
        <div className="overlay"><div className="modal rooms-edit-modal">
          <form onSubmit={addCamera}>
            <h2>เพิ่มกล้อง</h2>
            <p className="muted tiny">ใส่ที่อยู่ RTSP แล้วกดเชื่อมต่อ ระบบจะตรวจให้ทันที</p>
            {error ? <p className="banner error">{error}</p> : null}
            {formMsg ? <p className="banner ok">{formMsg}</p> : null}
            <label>ที่อยู่กล้อง (RTSP)
              <input
                value={adding.rtspUrl}
                autoComplete="off"
                placeholder="rtsp://user:pass@192.168.1.45:554/stream1"
                onChange={(event) => setAdding({ ...adding, rtspUrl: event.target.value })}
                required
                autoFocus
              />
            </label>
            <div className="form-row">
              <label>ห้อง
                <input
                  value={adding.roomLabel}
                  onChange={(event) => setAdding({ ...adding, roomLabel: event.target.value })}
                  placeholder="เช่น A"
                  list="rooms-add-labels"
                />
              </label>
              <label>ชื่อแมว
                <input
                  value={adding.catName}
                  onChange={(event) => setAdding({ ...adding, catName: event.target.value })}
                  placeholder="เช่น มะลิ"
                />
              </label>
            </div>
            <datalist id="rooms-add-labels">
              {namedRooms.map((room) => (
                <option key={room.roomLabel} value={room.roomLabel} />
              ))}
            </datalist>
            <div className="card-actions">
              <button className="button ghost" type="button" onClick={() => { setAdding(null); setFormMsg(''); }}>ยกเลิก</button>
              <button className="button" type="submit" disabled={busy}>{busy ? 'กำลังเชื่อมต่อ…' : 'เชื่อมต่อ'}</button>
            </div>
          </form>
        </div></div>
      ) : null}

      {editing ? (
        <div className="overlay"><div className="modal rooms-edit-modal">
          <form onSubmit={saveCamera}>
            <h2>แก้ไขกล้อง</h2>
            {error ? <p className="banner error">{error}</p> : null}
            <div className="form-row">
              <label>ห้อง<input value={editing.roomLabel} onChange={(event) => setEditing({ ...editing, roomLabel: event.target.value })} placeholder="เช่น A" /></label>
              <label>ชื่อแมว<input value={editing.catName} onChange={(event) => setEditing({ ...editing, catName: event.target.value })} placeholder="เช่น มะลิ" /></label>
            </div>
            <label>ที่อยู่กล้อง (RTSP)
              <input
                value={editing.rtspUrl}
                autoComplete="off"
                placeholder="เว้นว่างถ้าไม่เปลี่ยน · rtsp://user:pass@ip:554/stream1"
                onChange={(event) => setEditing({ ...editing, rtspUrl: event.target.value })}
              />
            </label>
            <div className="card-actions">
              <button className="button ghost" type="button" onClick={() => setEditing(null)}>ยกเลิก</button>
              <button className="button" type="submit" disabled={busy}>บันทึก</button>
            </div>
          </form>
        </div></div>
      ) : null}

      {removeTarget ? (
        <div className="overlay"><div className="modal rooms-edit-modal">
          <h2>ลบกล้อง {removeTarget.name}?</h2>
          {error ? <p className="banner error">{error}</p> : null}
          <p className="muted">สิทธิ์ดูภาพของลูกค้าสำหรับกล้องนี้จะถูกเพิกถอน</p>
          <div className="card-actions">
            <button className="button ghost" type="button" onClick={() => setRemoveTarget(null)}>ยกเลิก</button>
            <button className="button danger" type="button" onClick={confirmDelete} disabled={busy}>
              {busy ? 'กำลังลบ…' : 'ลบกล้อง'}
            </button>
          </div>
        </div></div>
      ) : null}
    </div>
  );
}

function grantStatus(item) {
  if (item.revokedAt) return { key: 'revoked', label: 'เพิกถอนแล้ว', tone: 'offline' };
  if (item.isActive) return { key: 'active', label: 'กำลังใช้ได้', tone: 'online' };
  return { key: 'idle', label: 'หมดอายุ / ยังไม่ถึง', tone: 'connecting' };
}

export function RolesPanel({ embedded = false, initialCameraId = '' } = {}) {
  const [grants, setGrants] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [filter, setFilter] = useState('active');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const [duration, setDuration] = useState('7');
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
    return cams.items;
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [filter]);

  useEffect(() => {
    if (!initialCameraId || !cameras.length) return;
    const camera = cameras.find((item) => String(item.id) === String(initialCameraId));
    if (!camera) return;
    setForm((prev) => ({
      ...prev,
      cameraId: String(camera.id),
      petName: camera.catName || prev.petName || '',
      roomLabel: camera.roomLabel || prev.roomLabel || '',
    }));
  }, [initialCameraId, cameras]);

  function applyDuration(days, baseStart = form.startsAt) {
    const start = baseStart ? new Date(baseStart) : new Date();
    const end = new Date(start.getTime() + Number(days) * 24 * 60 * 60 * 1000);
    setDuration(String(days));
    setForm((prev) => ({
      ...prev,
      startsAt: bangkokInput(start),
      endsAt: bangkokInput(end),
    }));
  }

  async function createAccess(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setOkMsg('');
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
      const customer = customers.find((item) => String(item.id) === String(form.userId));
      const camera = cameras.find((item) => String(item.id) === String(form.cameraId));
      setOkMsg(`ให้สิทธิ์ ${customer?.displayName || 'ลูกค้า'} ดู ${camera?.name || 'กล้อง'} แล้ว`);
      setForm((prev) => ({
        ...prev,
        userId: '',
        petName: camera?.catName || '',
        roomLabel: camera?.roomLabel || '',
        startsAt: bangkokInput(new Date()),
        endsAt: bangkokInput(new Date(Date.now() + Number(duration === 'custom' ? 7 : duration) * 24 * 60 * 60 * 1000)),
      }));
      setFilter('active');
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
    setOkMsg('');
    try {
      await api(`/api/admin/grants/${id}`, { method: 'DELETE' });
      setOkMsg('เพิกถอนสิทธิ์แล้ว');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function pickCamera(cameraId) {
    const camera = cameras.find((item) => String(item.id) === String(cameraId));
    setForm((prev) => ({
      ...prev,
      cameraId,
      petName: camera?.catName || '',
      roomLabel: camera?.roomLabel || '',
    }));
  }

  const activeCustomers = customers.filter((item) => item.isActive);
  const selectedCamera = cameras.find((item) => String(item.id) === String(form.cameraId));
  const selectedCustomer = activeCustomers.find((item) => String(item.id) === String(form.userId));
  const needle = query.trim().toLowerCase();
  const visibleGrants = grants.filter((item) => {
    if (!needle) return true;
    const blob = [
      item.displayName,
      item.email,
      item.cameraName,
      item.petName,
      item.cameraCat,
      item.roomLabel,
    ].join(' ').toLowerCase();
    return blob.includes(needle);
  });

  return (
    <div className={`page access-page ${embedded ? 'access-embedded' : ''}`}>
      <div className="page-head">
        <div>
          <h1>{embedded ? 'สิทธิ์ลูกค้า' : 'สิทธิ์การเข้าถึง'}</h1>
          <p className="muted">หลังรับฝากแล้ว ให้สิทธิ์ด้วยบัญชีลูกค้าที่อีเมลตรงกับบัญชี PetCare ของผู้จอง เพิกถอนได้ทันที</p>
        </div>
        <button
          className="button ghost"
          type="button"
          onClick={() => load().catch((err) => setError(err.message))}
        >
          รีเฟรช
        </button>
      </div>

      {error ? <p className="banner error">{error}</p> : null}
      {okMsg ? <p className="banner ok">{okMsg}</p> : null}

      <section className="panel access-create">
        <div className="access-create-head">
          <div>
            <p className="access-step">ขั้นตอนเดียว</p>
            <h2>ให้สิทธิ์ใหม่</h2>
          </div>
          {(selectedCamera || selectedCustomer) ? (
            <div className="access-preview">
              {selectedCustomer ? <span>{selectedCustomer.displayName}</span> : <span className="muted">เลือกลูกค้า</span>}
              <span className="access-preview-sep">→</span>
              {selectedCamera ? <span>{selectedCamera.name}</span> : <span className="muted">เลือกกล้อง</span>}
            </div>
          ) : null}
        </div>

        <form className="access-form" onSubmit={createAccess}>
          <div className="access-form-grid">
            <label className="access-field">
              <span>1. เลือกกล้อง</span>
              <select value={form.cameraId} onChange={(event) => pickCamera(event.target.value)} required>
                <option value="">เลือกกล้อง</option>
                {cameras.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.roomLabel || 'ไม่มีห้อง'} · {item.catName || 'ไม่ระบุแมว'}
                  </option>
                ))}
              </select>
            </label>

            <label className="access-field">
              <span>2. เลือกลูกค้า</span>
              <select
                value={form.userId}
                onChange={(event) => setForm({ ...form, userId: event.target.value })}
                required
              >
                <option value="">เลือกลูกค้า</option>
                {activeCustomers.map((item) => (
                  <option key={item.id} value={item.id}>{item.displayName} · {item.email}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="access-duration">
            <span className="access-duration-label">3. ระยะเวลา</span>
            <div className="chip-row" role="group" aria-label="เลือกระยะเวลา">
              {[
                ['1', '1 วัน'],
                ['3', '3 วัน'],
                ['7', '7 วัน'],
                ['custom', 'กำหนดเอง'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`chip-btn ${duration === value ? 'active' : ''}`}
                  onClick={() => {
                    if (value === 'custom') setDuration('custom');
                    else applyDuration(value);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {duration === 'custom' ? (
            <div className="access-form-grid">
              <label className="access-field">
                <span>เริ่ม</span>
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(event) => setForm({ ...form, startsAt: event.target.value })}
                  required
                />
              </label>
              <label className="access-field">
                <span>สิ้นสุด</span>
                <input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(event) => setForm({ ...form, endsAt: event.target.value })}
                  required
                />
              </label>
            </div>
          ) : (
            <p className="access-range muted">
              {formatWhen(form.startsAt)} → {formatWhen(form.endsAt)}
            </p>
          )}

          <button
            className="button ghost tiny access-extra-toggle"
            type="button"
            onClick={() => setShowExtra((value) => !value)}
          >
            {showExtra ? 'ซ่อนรายละเอียดเพิ่มเติม' : 'แก้ชื่อแมว / ห้องที่แสดง'}
          </button>

          {showExtra ? (
            <div className="access-form-grid">
              <label className="access-field">
                <span>ชื่อแมวที่แสดง</span>
                <input
                  value={form.petName}
                  onChange={(event) => setForm({ ...form, petName: event.target.value })}
                  placeholder="เช่น มะลิ"
                />
              </label>
              <label className="access-field">
                <span>ชื่อห้องที่แสดง</span>
                <input
                  value={form.roomLabel}
                  onChange={(event) => setForm({ ...form, roomLabel: event.target.value })}
                  placeholder="เช่น ห้อง A"
                />
              </label>
            </div>
          ) : null}

          <div className="access-actions">
            <button className="button wide" type="submit" disabled={busy || !form.cameraId || !form.userId}>
              {busy ? 'กำลังบันทึก…' : 'ให้สิทธิ์ดูกล้อง'}
            </button>
          </div>
        </form>
      </section>

      <section className="panel access-list">
        <div className="access-list-head">
          <div>
            <h2>สิทธิ์ที่มีอยู่</h2>
            <p className="muted tiny">{visibleGrants.length} รายการ</p>
          </div>
          <div className="chip-row" role="tablist" aria-label="กรองสิทธิ์">
            <button
              type="button"
              className={`chip-btn ${filter === 'active' ? 'active' : ''}`}
              onClick={() => setFilter('active')}
            >
              กำลังใช้ได้
            </button>
            <button
              type="button"
              className={`chip-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              ทั้งหมด
            </button>
          </div>
        </div>

        <label className="search access-search">
          <IconSearch />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ค้นหาลูกค้า กล้อง ห้อง หรือชื่อแมว"
            aria-label="ค้นหาสิทธิ์"
          />
        </label>

        {visibleGrants.length === 0 ? (
          <div className="empty access-empty">
            <strong>ยังไม่มีสิทธิ์ตามเงื่อนไขนี้</strong>
            <p className="muted">เลือกกล้องกับลูกค้าด้านบน แล้วกดให้สิทธิ์ได้เลย</p>
          </div>
        ) : (
          <div className="access-cards">
            {visibleGrants.map((item) => {
              const status = grantStatus(item);
              return (
                <article className="access-card" key={item.id}>
                  <div className="access-card-top">
                    <div className="access-who">
                      <span className="avatar tiny-avatar">{initialOf(item.displayName)}</span>
                      <div>
                        <strong>{item.displayName}</strong>
                        <span className="cell-sub">{item.email}</span>
                      </div>
                    </div>
                    <span className={`pill ${status.tone}`}>{status.label}</span>
                  </div>

                  <div className="access-card-body">
                    <div>
                      <span className="access-meta-label">กล้อง</span>
                      <strong>{item.cameraName}</strong>
                      <span className="cell-sub">
                        {item.petName || item.cameraCat || 'ไม่ระบุแมว'} · {item.roomLabel || 'ไม่ระบุห้อง'}
                      </span>
                    </div>
                    <div>
                      <span className="access-meta-label">ช่วงเวลา</span>
                      <span className="cell-sub">{formatWhen(item.startsAt)}</span>
                      <span className="cell-sub">ถึง {formatWhen(item.endsAt)}</span>
                    </div>
                  </div>

                  {!item.revokedAt && item.isActive ? (
                    <div className="access-card-actions">
                      <button
                        className="button danger tiny"
                        type="button"
                        disabled={busy}
                        onClick={() => revoke(item.id)}
                      >
                        เพิกถอนสิทธิ์
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
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
              <option value="walk">เดินเล่น</option>
              <option value="clean">ทำความสะอาด</option>
              <option value="health">สุขภาพ</option>
              <option value="custom">กิจกรรมอื่น</option>
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

export function SettingsPanel({ session }) {
  const [system, setSystem] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

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
        ? `ซิงก์กล้องเข้าตัวกลางภาพแล้ว ${result.synced} ตัว`
        : `ซิงก์ได้ ${result.synced} ตัว มีปัญหา ${result.errors.length} รายการ`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const summary = system?.summary || { total: 0, online: 0, offline: 0, connecting: 0 };
  const mediaUp = system?.mediamtx === 'up';
  const statusTone = !system ? '' : (!mediaUp ? 'bad' : summary.online > 0 ? 'ok' : 'warn');
  const statusTitle = !mediaUp
    ? 'ยังดูภาพสดไม่ได้'
    : summary.online > 0
      ? 'พร้อมให้ลูกค้าดูภาพ'
      : 'ระบบพร้อม แต่กล้องยังออฟไลน์';
  const statusDetail = !mediaUp
    ? 'ตัวกลางภาพปิดอยู่ เปิด MediaMTX แล้วกดรีเฟรช'
    : summary.online > 0
      ? `${summary.online} จาก ${summary.total} กล้องพร้อมใช้งาน`
      : summary.total > 0
        ? 'ลองกดซิงก์กล้อง หรือไปตรวจที่เมนูจัดการกล้อง'
        : 'ยังไม่มีกล้องในระบบ ไปเพิ่มที่เมนูจัดการกล้อง';

  return (
    <div className="page settings-page">
      <div className="page-head">
        <div>
          <h1>ตั้งค่า</h1>
          <p className="muted">ภาพรวมโรงแรมและการดูแลระบบภาพสด</p>
        </div>
        <button
          className="button ghost"
          type="button"
          disabled={busy}
          onClick={() => load().catch((err) => setError(err.message))}
        >
          รีเฟรช
        </button>
      </div>

      {error ? <p className="banner error">{error}</p> : null}
      {message ? <p className="banner ok">{message}</p> : null}
      {!system ? <p className="muted">กำลังโหลด…</p> : null}

      {system ? (
        <div className="settings-admin">
          <section className={`panel settings-status ${statusTone}`}>
            <div className="settings-status-copy">
              <p className="access-step">สถานะวันนี้</p>
              <h2>{statusTitle}</h2>
              <p className="muted">{statusDetail}</p>
            </div>
            <div className="settings-status-metrics">
              <div>
                <strong>{summary.online}</strong>
                <span>ออนไลน์</span>
              </div>
              <div>
                <strong>{summary.offline}</strong>
                <span>ออฟไลน์</span>
              </div>
              <div>
                <strong>{summary.total}</strong>
                <span>ทั้งหมด</span>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="settings-card-head">
              <div>
                <h2>โรงแรม</h2>
                <p className="muted tiny">ข้อมูลที่ลูกค้าเห็นตอนเข้าใช้งาน</p>
              </div>
            </div>
            <div className="settings-profile">
              <div className="settings-profile-mark">
                <img className="brand-mark-art" src="/brand-mark.jpg" alt="" draggable="false" />
              </div>
              <div className="settings-profile-copy">
                <strong>{system.hotelName}</strong>
                <span className="muted">แอดมิน: {session?.user?.displayName || 'Admin'}</span>
                <span className="muted">{system.adminEmail || session?.user?.email || '—'}</span>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="settings-card-head">
              <div>
                <h2>ระบบภาพสด</h2>
                <p className="muted tiny">ซิงก์กล้องเข้าตัวกลางภาพเมื่อเพิ่มหรือแก้กล้องแล้วภาพไม่ออก</p>
              </div>
              <span className={`pill ${mediaUp ? 'online' : 'offline'}`}>
                {mediaUp ? 'ตัวกลางพร้อม' : 'ตัวกลางปิด'}
              </span>
            </div>
            <div className="settings-inline-facts">
              <div>
                <span>เวลาดูภาพต่อครั้ง</span>
                <strong>{Math.round(system.streamSessionSeconds / 60)} นาที</strong>
              </div>
              <div>
                <span>กล้องในระบบ</span>
                <strong>{summary.total} ตัว</strong>
              </div>
            </div>
            <button className="button wide" type="button" disabled={busy || !mediaUp} onClick={syncMedia}>
              {busy ? 'กำลังซิงก์…' : 'ซิงก์กล้องเข้าตัวกลางภาพ'}
            </button>
            {!mediaUp ? (
              <p className="muted tiny settings-note">เปิดโปรแกรม MediaMTX ก่อน แล้วค่อยกดซิงก์</p>
            ) : null}
          </section>

          <section className="panel">
            <div className="settings-card-head">
              <div>
                <h2>ความปลอดภัย</h2>
                <p className="muted tiny">ช่วงเครือข่ายที่ระบบยอมรับกล้อง</p>
              </div>
            </div>
            {(system.allowlist || []).length === 0 ? (
              <div className="empty">ยังไม่ได้จำกัดเครือข่ายกล้อง</div>
            ) : (
              <ul className="settings-tags">
                {system.allowlist.map((item) => <li key={item}>{item}</li>)}
              </ul>
            )}
          </section>

          <section className="panel settings-advanced">
            <button
              className="settings-advanced-toggle"
              type="button"
              onClick={() => setShowAdvanced((value) => !value)}
              aria-expanded={showAdvanced}
            >
              <span>
                <strong>รายละเอียดทางเทคนิค</strong>
                <small className="muted">สำหรับช่าง/ผู้ติดตั้งระบบ</small>
              </span>
              <span className="muted">{showAdvanced ? 'ซ่อน' : 'แสดง'}</span>
            </button>

            {showAdvanced ? (
              <dl className="settings-tech-list">
                <div><dt>MediaMTX API</dt><dd>{system.mediamtxApi}</dd></div>
                <div><dt>WHEP</dt><dd>{system.mediamtxWhep}</dd></div>
                <div><dt>WebRTC</dt><dd>{system.webrtcHost}:{system.webrtcUdpPort}</dd></div>
                <div><dt>API Port</dt><dd>{system.apiPort}</dd></div>
                <div><dt>โหมด</dt><dd>{system.nodeEnv}</dd></div>
                <div><dt>คุกกี้ Secure</dt><dd>{system.cookieSecure ? 'เปิด' : 'ปิด'}</dd></div>
                <div>
                  <dt>ที่อยู่เล่นภาพ</dt>
                  <dd>{(system.playbackAddresses || []).join(', ') || '—'}</dd>
                </div>
              </dl>
            ) : null}
          </section>
        </div>
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
                <p className="muted tiny">ใช้อีเมลเดียวกับที่ลูกค้าจองใน PetCare แล้วค่อยให้สิทธิ์กล้องหลังรับฝาก</p>
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
