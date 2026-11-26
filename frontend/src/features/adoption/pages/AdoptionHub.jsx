import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ADOPTION_API_URL } from '../api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useMyAdoptionApplications } from '../useMyAdoptionApplications.js';
import { formatDate } from '../../pet-owner/petUtils.js';
import {
  AddAnimalDialog,
  AnimalCard,
  ApplicationDialog,
  FILTERS,
  getApiErrorMessage,
} from './findHomeDialogs.jsx';
import './FindHome.css';

const SEX_FILTERS = [
  { value: 'all', label: 'ทุกเพศ' },
  { value: 'male', label: 'ผู้' },
  { value: 'female', label: 'เมีย' },
];

const AGE_FILTERS = [
  { value: 'all', label: 'ทุกช่วงอายุ' },
  { value: 'baby', label: 'ต่ำกว่า 1 ปี' },
  { value: 'young', label: '1–3 ปี' },
  { value: 'adult', label: '3–7 ปี' },
  { value: 'senior', label: 'มากกว่า 7 ปี' },
];

function parseAgeYears(ageText = '') {
  const text = String(ageText).toLowerCase();
  const yearMatch = text.match(/(\d+)\s*(ปี|year)/);
  const monthMatch = text.match(/(\d+)\s*(เดือน|month)/);
  const years = yearMatch ? Number(yearMatch[1]) : 0;
  const months = monthMatch ? Number(monthMatch[1]) : 0;
  if (!years && !months && /^\d+$/.test(text.trim())) return Number(text.trim());
  return years + months / 12;
}

function ageBand(ageText) {
  const years = parseAgeYears(ageText);
  if (!years) return 'all';
  if (years < 1) return 'baby';
  if (years < 3) return 'young';
  if (years < 7) return 'adult';
  return 'senior';
}

const HUB_TABS = [
  { id: 'browse', label: 'น้องรอบ้าน', icon: 'bi-search-heart' },
  { id: 'my-posts', label: 'ประกาศของฉัน', icon: 'bi-megaphone' },
  { id: 'requests', label: 'คำขอรับเลี้ยง', icon: 'bi-clipboard-heart' },
];

const APPLICATION_STATUS = {
  pending: { label: 'รอพิจารณา', tone: 'warn' },
  submitted: { label: 'ส่งคำขอแล้ว', tone: 'warn' },
  reviewing: { label: 'กำลังตรวจสอบ', tone: 'sky' },
  interview: { label: 'นัดพูดคุย', tone: 'sky' },
  approved: { label: 'อนุมัติแล้ว', tone: 'ok' },
  rejected: { label: 'ไม่ผ่าน', tone: '' },
  completed: { label: 'รับน้องแล้ว', tone: 'ok' },
  closed: { label: 'ปิดแล้ว', tone: '' },
  cancelled: { label: 'ยกเลิกแล้ว', tone: '' },
};

function statusChip(status) {
  return APPLICATION_STATUS[status] || { label: status, tone: 'sky' };
}

function LoginGate({ title, description }) {
  return (
    <div className="find-home-state adoption-hub-gate">
      <i className="bi bi-person-lock" />
      <h2 className="h5">{title}</h2>
      <p>{description}</p>
      <Link className="btn btn-sky" to="/login?next=%2Fpet-owner%2Fadoption%3Ftab%3Drequests">
        เข้าสู่ระบบ
      </Link>
    </div>
  );
}

function AnimalGrid({
  animals,
  loading,
  error,
  onReload,
  onApply,
  onEdit,
  emptyMessage,
}) {
  if (loading) {
    return (
      <div className="find-home-state" role="status">
        <div className="spinner-border text-primary" aria-hidden="true" />
        <p>กำลังโหลด...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="find-home-state find-home-state-error" role="alert">
        <i className="bi bi-wifi-off" />
        <p>{error}</p>
        <button className="btn btn-soft" type="button" onClick={onReload}>
          ลองอีกครั้ง
        </button>
      </div>
    );
  }
  if (!animals.length) {
    return (
      <div className="find-home-state">
        <i className="bi bi-search-heart" />
        <p>{emptyMessage}</p>
      </div>
    );
  }
  return (
    <div className="row g-4">
      {animals.map((animal) => (
        <div className="col-sm-6 col-lg-4 col-xl-3" key={animal.id}>
          <AnimalCard animal={animal} onApply={onApply} onEdit={onEdit} />
        </div>
      ))}
    </div>
  );
}

export default function AdoptionHub() {
  const { authToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab = HUB_TABS.some((t) => t.id === tabParam) ? tabParam : 'browse';

  const [animals, setAnimals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [species, setSpecies] = useState('all');
  const [sexFilter, setSexFilter] = useState('all');
  const [ageFilter, setAgeFilter] = useState('all');
  const [selectedAnimal, setSelectedAnimal] = useState(null);
  const [addingAnimal, setAddingAnimal] = useState(false);
  const [editingAnimal, setEditingAnimal] = useState(null);
  const [cancelBusy, setCancelBusy] = useState('');
  const [myPostAnimals, setMyPostAnimals] = useState([]);
  const [myPostsLoading, setMyPostsLoading] = useState(false);

  const {
    applications,
    loading: appsLoading,
    error: appsError,
    reload: reloadApps,
    cancelApplication,
  } = useMyAdoptionApplications(authToken);

  async function loadAnimals(signal) {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${ADOPTION_API_URL}/animals`, {
        signal,
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'โหลดข้อมูลน้องๆ ไม่สำเร็จ');
      if (!Array.isArray(result.animals)) throw new Error('ข้อมูลน้องๆ จากระบบไม่ถูกต้อง');
      setAnimals(result.animals);
    } catch (requestError) {
      if (requestError.name !== 'AbortError') {
        setError(getApiErrorMessage(requestError, 'เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่'));
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    loadAnimals(controller.signal);
    return () => controller.abort();
  }, [authToken]);

  async function loadMyPosts(signal) {
    if (!authToken) {
      setMyPostAnimals([]);
      return;
    }
    setMyPostsLoading(true);
    try {
      const response = await fetch(`${ADOPTION_API_URL}/animals/mine`, {
        signal,
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'โหลดประกาศของฉันไม่สำเร็จ');
      setMyPostAnimals(Array.isArray(result.animals) ? result.animals : []);
    } catch (requestError) {
      if (requestError.name !== 'AbortError') {
        setError(getApiErrorMessage(requestError, 'โหลดประกาศไม่สำเร็จ'));
      }
    } finally {
      if (!signal?.aborted) setMyPostsLoading(false);
    }
  }

  useEffect(() => {
    if (tab !== 'my-posts' || !authToken) return undefined;
    const controller = new AbortController();
    loadMyPosts(controller.signal);
    return () => controller.abort();
  }, [tab, authToken]);

  function setTab(next) {
    if (next === 'browse') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab: next }, { replace: true });
    }
  }

  function handleAddAnimal() {
    if (!authToken) {
      navigate('/login?next=%2Fpet-owner%2Fadoption');
      return;
    }
    setAddingAnimal(true);
  }

  function openTabRequiringAuth(next) {
    if (!authToken) {
      navigate(`/login?next=${encodeURIComponent(`/pet-owner/adoption?tab=${next}`)}`);
      return;
    }
    setTab(next);
  }

  const filteredBrowse = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('th');
    return animals.filter((animal) => {
      const matchesSpecies = species === 'all' || animal.species === species;
      const animalSex = (animal.sex || '').toLowerCase();
      const matchesSex = sexFilter === 'all' || animalSex === sexFilter;
      const matchesAge = ageFilter === 'all' || ageBand(animal.age) === ageFilter;
      const searchableText = [
        animal.name,
        animal.breed,
        animal.personality,
        animal.location,
        animal.address,
        animal.color,
      ].join(' ').toLocaleLowerCase('th');
      return matchesSpecies && matchesSex && matchesAge
        && (normalizedQuery === '' || searchableText.includes(normalizedQuery));
    });
  }, [animals, query, species, sexFilter, ageFilter]);

  const myPosts = myPostAnimals;

  async function handleCancelApp(id) {
    if (!window.confirm('ยกเลิกคำขอรับเลี้ยงนี้?')) return;
    setCancelBusy(id);
    try {
      await cancelApplication(id);
    } finally {
      setCancelBusy('');
    }
  }

  return (
    <div className="find-home">
      <section className="find-home-hero find-home-hero--hub">
        <div className="container">
          <div className="row align-items-center g-4">
            <div className="col-lg-8">
              <span className="chip"><i className="bi bi-house-heart me-1" /> หาบ้านให้น้อง</span>
              <h1>โครงการหาบ้าน</h1>
              <p className="mb-3">
                ดูน้องที่รอบ้าน ลงประกาศหาบ้าน หรือติดตามคำขอรับเลี้ยงของคุณ — ครบในหน้าเดียว
              </p>
              <div className="d-flex flex-wrap gap-2">
                <button type="button" className="btn btn-sky" onClick={() => setTab('browse')}>
                  ดูน้องรอรับเลี้ยง
                </button>
                <button type="button" className="btn btn-soft" onClick={() => openTabRequiringAuth('my-posts')}>
                  ประกาศหาบ้าน
                </button>
              </div>
            </div>
            <div className="col-lg-4 text-center d-none d-lg-block">
              <img src="/adoption/adopt-003.jpg" alt="" className="img-fluid rounded-4 shadow-sm" />
            </div>
          </div>
        </div>
      </section>

      <div className="container adoption-hub-tabs-wrap">
        <nav className="adoption-hub-tabs" role="tablist" aria-label="เมนูหาบ้าน">
          {HUB_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={`adoption-hub-tab${tab === item.id ? ' is-active' : ''}`}
              onClick={() => (item.id === 'browse' ? setTab('browse') : openTabRequiringAuth(item.id))}
            >
              <i className={`bi ${item.icon}`} aria-hidden />
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'browse' && (
        <>
          <section id="available-animals" className="find-home-listing">
            <div className="container">
              <div className="find-home-listing-heading">
                <div>
                  <span className="chip">สมาชิกใหม่ที่รอคุณ</span>
                  <h2>เลือกเพื่อนตัวโปรด</h2>
                  <p>ลองค้นหาจากชื่อ สายพันธุ์ หรือนิสัยที่ใช่สำหรับบ้านของคุณ</p>
                </div>
                <div className="find-home-listing-actions">
                  <div className="find-home-search">
                    <i className="bi bi-search" />
                    <input
                      type="search"
                      className="form-control"
                      placeholder="ค้นหาน้องๆ..."
                      aria-label="ค้นหาน้องๆ"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-sky find-home-add-btn"
                    onClick={handleAddAnimal}
                  >
                    <i className="bi bi-plus-lg me-2" />
                    เพิ่มสัตว์หาบ้าน
                  </button>
                </div>
              </div>

              <div className="find-home-filters" aria-label="กรองตามประเภทสัตว์">
                {FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    className={`find-home-filter ${species === filter.value ? 'active' : ''}`}
                    aria-pressed={species === filter.value}
                    onClick={() => setSpecies(filter.value)}
                  >
                    <i className={`bi ${filter.icon}`} />
                    {filter.label}
                  </button>
                ))}
                {!loading && !error && (
                  <span className="find-home-count">พบ {filteredBrowse.length} ชีวิต</span>
                )}
              </div>
              <div className="find-home-filters mt-2" aria-label="กรองเพศและอายุ">
                {SEX_FILTERS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={`find-home-filter ${sexFilter === item.value ? 'active' : ''}`}
                    aria-pressed={sexFilter === item.value}
                    onClick={() => setSexFilter(item.value)}
                  >
                    {item.label}
                  </button>
                ))}
                {AGE_FILTERS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={`find-home-filter ${ageFilter === item.value ? 'active' : ''}`}
                    aria-pressed={ageFilter === item.value}
                    onClick={() => setAgeFilter(item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <AnimalGrid
                animals={filteredBrowse}
                loading={loading}
                error={error}
                onReload={() => loadAnimals(new AbortController().signal)}
                onApply={setSelectedAnimal}
                onEdit={setEditingAnimal}
                emptyMessage="ยังไม่พบน้องที่ตรงกับการค้นหา ลองเปลี่ยนคำค้นดูนะ"
              />
            </div>
          </section>

          <section className="find-home-steps">
            <div className="container">
              <div className="title-wrap">
                <span className="chip">รับเลี้ยงอย่างเข้าใจ</span>
                <h2>4 ขั้นตอนสู่บ้านหลังใหม่</h2>
                <p className="mb-0">เราจะอยู่ข้างๆ ตั้งแต่วันที่เริ่มสนใจจนถึงวันที่น้องได้กลับบ้าน</p>
              </div>
              <div className="row g-3">
                {[
                  ['bi-search-heart', 'เลือกน้องที่ใช่', 'ดูข้อมูลและนิสัยของน้องๆ'],
                  ['bi-file-earmark-text', 'ส่งคำขอรับเลี้ยง', 'ฝากข้อมูลให้ทีมงานติดต่อกลับ'],
                  ['bi-chat-heart', 'พูดคุยทำความรู้จัก', 'เตรียมบ้านและนัดพบกับน้อง'],
                  ['bi-house-heart', 'ต้อนรับสมาชิกใหม่', 'รับคำแนะนำหลังน้องกลับบ้าน'],
                ].map(([icon, title, description], index) => (
                  <div className="col-6 col-lg-3" key={title}>
                    <div className="find-home-step">
                      <span className="find-home-step-number">{String(index + 1).padStart(2, '0')}</span>
                      <span className="find-home-step-icon"><i className={`bi ${icon}`} /></span>
                      <h3>{title}</h3>
                      <p>{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {tab === 'my-posts' && (
        <section className="find-home-listing">
          <div className="container">
            {!authToken ? (
              <LoginGate
                title="ประกาศของฉัน"
                description="เข้าสู่ระบบเพื่อดูและแก้ไขประกาศหาบ้านที่คุณลงไว้"
              />
            ) : (
              <>
                <div className="find-home-listing-heading">
                  <div>
                    <h2>ประกาศหาบ้านของคุณ</h2>
                    <p>โพสต์ที่คุณสร้างจะแสดงที่น้องรอบ้าน — แก้ไขได้เมื่อสถานะยังหาบ้านอยู่</p>
                  </div>
                  <button type="button" className="btn btn-sky find-home-add-btn" onClick={handleAddAnimal}>
                    <i className="bi bi-plus-lg me-2" />
                    เพิ่มประกาศใหม่
                  </button>
                </div>
                <AnimalGrid
                  animals={myPosts}
                  loading={loading || myPostsLoading}
                  error={error}
                  onReload={() => loadMyPosts(new AbortController().signal)}
                  onApply={setSelectedAnimal}
                  onEdit={setEditingAnimal}
                  emptyMessage="ยังไม่มีประกาศ — กดเพิ่มสัตว์หาบ้านเพื่อเริ่มลงประกาศ"
                />
              </>
            )}
          </div>
        </section>
      )}

      {tab === 'requests' && (
        <section className="find-home-listing">
          <div className="container adoption-hub-requests">
            {!authToken ? (
              <LoginGate
                title="คำขอรับเลี้ยง"
                description="เข้าสู่ระบบเพื่อดูคำขอที่คุณส่งและสถานะการพิจารณา"
              />
            ) : (
              <>
                <header className="adoption-hub-requests-head">
                  <h2>คำขอรับเลี้ยงของฉัน</h2>
                  <button type="button" className="btn btn-soft btn-sm" onClick={reloadApps}>
                    รีเฟรช
                  </button>
                </header>

                {appsError && (
                  <div className="alert alert-danger py-2" role="alert">
                    {appsError}
                  </div>
                )}

                {appsLoading && !applications.length ? (
                  <div className="find-home-state" role="status">
                    <div className="spinner-border text-primary" aria-hidden="true" />
                    <p>กำลังโหลดคำขอ...</p>
                  </div>
                ) : null}

                {!appsLoading && applications.length === 0 ? (
                  <div className="find-home-state">
                    <i className="bi bi-clipboard-heart" />
                    <p>ยังไม่มีคำขอรับเลี้ยง — เลือกน้องจากแท็บ «น้องรอบ้าน» แล้วกดสนใจรับเลี้ยง</p>
                    <button type="button" className="btn btn-sky" onClick={() => setTab('browse')}>
                      ไปเลือกน้อง
                    </button>
                  </div>
                ) : (
                  <ul className="adoption-hub-request-list">
                    {applications.map((item) => {
                      const chip = statusChip(item.status);
                      return (
                        <li key={item.id} className="adoption-hub-request-card">
                          <div>
                            <strong>{item.animalName || 'น้อง'}</strong>
                            <span className="find-home-muted d-block small">
                              ส่งเมื่อ {formatDate(item.createdAt)}
                            </span>
                          </div>
                          <span className={`tag ${chip.tone}`}>{chip.label}</span>
                          {['pending', 'submitted', 'reviewing', 'interview'].includes(item.status) ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-soft-danger"
                              disabled={cancelBusy === item.id}
                              onClick={() => handleCancelApp(item.id)}
                            >
                              ยกเลิก
                            </button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {selectedAnimal && (
        <ApplicationDialog
          animal={selectedAnimal}
          authToken={authToken}
          onClose={() => setSelectedAnimal(null)}
          onSubmitted={() => {
            reloadApps();
            setTab('requests');
          }}
        />
      )}
      {addingAnimal && (
        <AddAnimalDialog
          authToken={authToken}
          onClose={() => setAddingAnimal(false)}
          onCreated={(animal) => {
            setAnimals((current) => [animal, ...current]);
            setTab('my-posts');
          }}
        />
      )}
      {editingAnimal && (
        <AddAnimalDialog
          key={editingAnimal.id}
          animal={editingAnimal}
          authToken={authToken}
          onClose={() => setEditingAnimal(null)}
          onCreated={(updatedAnimal) => {
            setAnimals((current) =>
              current.map((animal) => (animal.id === updatedAnimal.id ? updatedAnimal : animal)),
            );
          }}
        />
      )}
    </div>
  );
}