import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Shell from '../components/Shell';
import CameraCard from '../components/CameraCard';
import WatchBoard from '../components/WatchBoard';
import { IconCamera, IconSearch } from '../components/Marks';
import { api, formatWhen } from '../api';
import { LogsPanel, RoomsHub, SettingsPanel, UsersPanel } from './AdminSections';
import HotelStayDesk from '../../../../pet-owner/HotelStayDesk.jsx';

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

function sectionTitle(focusLive) {
  if (focusLive) return 'ดูภาพสด';
  return 'ภาพรวม';
}

function AdminBody({ session, section }) {
  if (section === 'users') {
    return <UsersPanel mode={section} session={session} />;
  }
  if (section === 'rooms') {
    return (
      <RoomsHub
        canManage={can(session.user, 'manage_cameras')}
        canGrant={can(session.user, 'manage_grants')}
      />
    );
  }
  if (section === 'stays') return <HotelStayDesk />;
  if (section === 'logs') return <LogsPanel />;
  if (section === 'settings') return <SettingsPanel session={session} />;
  return (
    <CameraDesk
      focusLive={section === 'live'}
      canCare={can(session.user, 'care_logs')}
    />
  );
}

function CameraDesk({ focusLive = false, canCare = true }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const cameraIdFromUrl = searchParams.get('camera');
  const [query, setQuery] = useState({ q: '', status: '', page: 1 });
  const [draft, setDraft] = useState({ q: '', status: '' });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);

  function openPreview(camera) {
    if (!camera?.id) return;
    setPreview(camera);
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('camera', String(camera.id));
      return params;
    }, { replace: true });
  }

  function closePreview() {
    setPreview(null);
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.delete('camera');
      return params;
    }, { replace: true });
  }

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
    let cancelled = false;
    if (!cameraIdFromUrl) {
      setPreview(null);
      return undefined;
    }
    const fromList = data?.items?.find((item) => String(item.id) === String(cameraIdFromUrl));
    if (fromList) {
      setPreview(fromList);
      return undefined;
    }
    api(`/api/admin/cameras/${cameraIdFromUrl}`)
      .then((result) => {
        if (cancelled) return;
        if (result?.camera) setPreview(result.camera);
        else {
          setPreview(null);
          setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            params.delete('camera');
            return params;
          }, { replace: true });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setPreview(null);
        setSearchParams((prev) => {
          const params = new URLSearchParams(prev);
          params.delete('camera');
          return params;
        }, { replace: true });
      });
    return () => { cancelled = true; };
  }, [cameraIdFromUrl, data, setSearchParams]);

  useEffect(() => {
    load(query);
  }, [query.q, query.status, query.page]);

  const summary = data?.summary || { total: 0, online: 0, offline: 0, connecting: 0 };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const latest = data?.items.map((item) => item.lastSeenAt).filter(Boolean).sort().at(-1);
  const pct = summary.total ? Math.round((summary.online / summary.total) * 1000) / 10 : 0;
  const liveItems = data?.items || [];
  const sortedLive = focusLive
    ? [...liveItems].sort((a, b) => {
      const rank = { online: 0, connecting: 1, offline: 2 };
      return (rank[a.streamStatus] ?? 9) - (rank[b.streamStatus] ?? 9);
    })
    : liveItems;

  if (focusLive) {
    return (
      <div className="page live-page">
        <div className="page-head">
          <div>
            <h1>ดูภาพสด</h1>
            <p className="muted">กดการ์ดเพื่อขยายเต็มจอ · เรียงออนไลน์ขึ้นก่อน</p>
          </div>
          <div className="page-tools">
            <span className={`pill ${summary.online > 0 ? 'live' : 'offline'}`}>
              {summary.online > 0 ? `LIVE ${summary.online}` : 'ยังไม่ออนไลน์'}
            </span>
            <span className="muted tiny">อัปเดต {formatWhen(latest)}</span>
            <button className="icon-round" type="button" onClick={() => load()} aria-label="รีเฟรช">↻</button>
          </div>
        </div>

        {error ? <p className="banner error">{error}</p> : null}

        <section className="live-status-bar" aria-label="สรุปสถานะกล้อง">
          <button type="button" className={`live-stat ${draft.status === '' ? 'active' : ''}`} onClick={() => { setDraft({ ...draft, status: '' }); setQuery({ ...query, status: '', page: 1 }); }}>
            <strong>{summary.total}</strong>
            <span>ทั้งหมด</span>
          </button>
          <button type="button" className={`live-stat online ${draft.status === 'online' ? 'active' : ''}`} onClick={() => { setDraft({ ...draft, status: 'online' }); setQuery({ ...query, status: 'online', page: 1 }); }}>
            <strong>{summary.online}</strong>
            <span>ออนไลน์</span>
          </button>
          <button type="button" className={`live-stat connecting ${draft.status === 'connecting' ? 'active' : ''}`} onClick={() => { setDraft({ ...draft, status: 'connecting' }); setQuery({ ...query, status: 'connecting', page: 1 }); }}>
            <strong>{summary.connecting}</strong>
            <span>กำลังเชื่อม</span>
          </button>
          <button type="button" className={`live-stat offline ${draft.status === 'offline' ? 'active' : ''}`} onClick={() => { setDraft({ ...draft, status: 'offline' }); setQuery({ ...query, status: 'offline', page: 1 }); }}>
            <strong>{summary.offline}</strong>
            <span>ออฟไลน์</span>
          </button>
        </section>

        <section className="panel live-wall-panel">
          <div className="live-wall-head">
            <div>
              <h2>ผนังกล้อง</h2>
              <p className="muted tiny">{sortedLive.length} ห้องที่แสดง</p>
            </div>
            <label className="search live-search">
              <IconSearch />
              <input
                placeholder="ค้นหาห้อง หรือชื่อแมว"
                value={draft.q}
                onChange={(event) => {
                  const q = event.target.value;
                  setDraft({ ...draft, q });
                  setQuery({ ...query, q, page: 1 });
                }}
              />
            </label>
          </div>

          {!data ? <p className="muted">กำลังโหลดกล้อง…</p> : null}

          {data && sortedLive.length === 0 ? (
            <div className="empty live-empty">
              <strong>ไม่พบกล้องตามเงื่อนไข</strong>
              <p className="muted">ลองเปลี่ยนตัวกรอง หรือไปเปิดใช้งานกล้องที่เมนูจัดการกล้อง</p>
            </div>
          ) : (
            <section className="live-wall">
              {sortedLive.map((camera) => (
                <CameraCard
                  key={camera.id}
                  variant="live"
                  camera={{ ...camera, mode: 'admin' }}
                  showLive={!preview && camera.isEnabled && camera.streamStatus !== 'offline'}
                  onOpen={() => openPreview(camera)}
                  onPicture={() => load()}
                />
              ))}
            </section>
          )}
        </section>

        {preview ? (
          <div className="watch-overlay">
            <WatchBoard camera={preview} mode="admin" canLog={canCare} onClose={closePreview} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{sectionTitle(focusLive)}</h1>
          <p className="muted">สถานะจริงจากกล้องที่เชื่อมต่ออยู่</p>
        </div>
        <div className="page-tools">
          {summary.online > 0 ? <span className="pill live">ระบบพร้อมใช้งาน</span> : null}
          <span className="muted tiny">อัปเดต {formatWhen(latest)}</span>
          <button className="icon-round" type="button" onClick={() => load()} aria-label="รีเฟรช">↻</button>
        </div>
      </div>

      {error ? <p className="banner error">{error}</p> : null}

      <section className="stat-row">
        <Stat label="ทั้งหมด" value={summary.total} tone="total" unit="กล้อง" />
        <Stat label="ออนไลน์" value={summary.online} tone="online" unit="กล้อง" />
        <Stat label="กำลังเชื่อม" value={summary.connecting} tone="connecting" unit="กล้อง" />
        <Stat label="ออฟไลน์" value={summary.offline} tone="offline" unit="กล้อง" />
      </section>

      <section className="panel">
        <div className="section-head camera-section-head">
          <div>
            <h2>กล้องทั้งหมด</h2>
            <p className="muted tiny">{data?.total ?? 0} รายการ</p>
          </div>
        </div>
        <form
          className="camera-filter-bar"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery({ q: draft.q, status: draft.status, page: 1 });
          }}
        >
          <label className="search camera-filter-search">
            <IconSearch />
            <input
              placeholder="ค้นหากล้อง ห้อง หรือชื่อแมว"
              value={draft.q}
              onChange={(event) => {
                const q = event.target.value;
                setDraft({ ...draft, q });
                setQuery({ ...query, q, page: 1 });
              }}
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
                className={`chip-btn ${draft.status === value ? 'active' : ''} ${value || 'all'}`}
                onClick={() => {
                  setDraft({ ...draft, status: value });
                  setQuery({ ...query, status: value, page: 1 });
                }}
              >
                <span>{label}</span>
                <em>{count}</em>
              </button>
            ))}
          </div>
        </form>
        {!data ? <p className="muted">กำลังโหลด</p> : null}
        {data && data.items.length === 0 ? <div className="empty">ยังไม่มีกล้อง — ไปเพิ่มที่เมนูจัดการกล้อง</div> : null}
        <section className="thumb-grid">
          {data?.items.map((camera) => (
            <CameraCard
              key={camera.id}
              camera={{ ...camera, mode: 'admin' }}
              showLive={!preview && camera.isEnabled && camera.streamStatus !== 'offline'}
              onOpen={() => openPreview(camera)}
              onPicture={() => load()}
            />
          ))}
        </section>
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
          <p>{summary.total === 0 ? 'เพิ่มกล้องที่เมนูจัดการกล้อง' : `ออนไลน์ ${summary.online} จาก ${summary.total} ตัว`}</p>
        </div>
      </section>

      {preview ? (
        <div className="watch-overlay">
          <WatchBoard camera={preview} mode="admin" canLog={canCare} onClose={closePreview} />
        </div>
      ) : null}
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
