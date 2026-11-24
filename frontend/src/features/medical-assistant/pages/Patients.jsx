import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PetPhoto from '../../pet-owner/components/PetPhoto.jsx';
import { SPECIES, formatDate, speciesOf } from '../../pet-owner/petUtils.js';
import MaDataState from '../components/MaDataState.jsx';
import { buildCautionSummary } from '../components/PatientNameLink.jsx';
import { CAUTION_FLAGS } from '../data/constants.js';
import { usePatients } from '../data/usePatients.js';

function hasCaution(patient) {
  return (patient.flags?.length ?? 0) > 0 || Boolean(patient.allergies);
}

/**
 * Patients — Role: Medical Assistant
 * Owner: เอิร์ท
 */
export default function PatientsPage() {
  const { patients, loading, error, reload } = usePatients();
  const navigate = useNavigate();

  const [tab, setTab] = useState('all');
  const [speciesFilter, setSpeciesFilter] = useState('all');
  const [sortBy, setSortBy] = useState('next');
  const [query, setQuery] = useState('');

  const counts = useMemo(() => {
    let caution = 0;
    let upcoming = 0;

    for (const p of patients) {
      if (hasCaution(p)) caution += 1;
      if (p.nextAppointment) upcoming += 1;
    }

    return {
      all: patients.length,
      caution,
      upcoming,
    };
  }, [patients]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const list = patients.filter((p) => {
      if (tab === 'caution' && !hasCaution(p)) return false;
      if (tab === 'upcoming' && !p.nextAppointment) return false;
      if (speciesFilter !== 'all' && p.species !== speciesFilter) return false;

      if (q) {
        const hit = [p.name, p.breed, p.ownerName, p.ownerPhone].some((v) =>
          v?.toLowerCase().includes(q),
        );
        if (!hit) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'next') {
        const aNext = a.nextAppointment ? `${a.nextAppointment.date}${a.nextAppointment.time}` : '9999';
        const bNext = b.nextAppointment ? `${b.nextAppointment.date}${b.nextAppointment.time}` : '9999';
        if (aNext !== bNext) return aNext.localeCompare(bNext);
      } else if (sortBy === 'last') {
        const aLast = a.lastVisit ?? '';
        const bLast = b.lastVisit ?? '';
        if (aLast !== bLast) return bLast.localeCompare(aLast);
      }
      return (a.name || '').localeCompare(b.name || '', 'th');
    });
  }, [patients, tab, speciesFilter, sortBy, query]);

  const hasActiveFilter = tab !== 'all' || speciesFilter !== 'all' || query.trim() !== '';
  const hasData = patients.length > 0;
  const blockedByState = !hasData && (loading || Boolean(error));

  function clearFilters() {
    setTab('all');
    setSpeciesFilter('all');
    setQuery('');
  }

  function openDetail(petId) {
    navigate(`/medical-assistant/patients/${encodeURIComponent(petId)}`);
  }

  const tabs = [
    { id: 'all', label: 'ทั้งหมด', count: counts.all },
    { id: 'caution', label: 'มีข้อควรระวัง', count: counts.caution },
    { id: 'upcoming', label: 'มีนัดถัดไป', count: counts.upcoming },
  ];

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>ผู้ป่วย</h1>
          <p>ค้นหาสัตว์ป่วย ดูประวัติการรักษา ข้อควรระวัง และบันทึกภายในก่อนเข้าตรวจ</p>
        </div>
        <button type="button" className="btn btn-soft" disabled={loading} onClick={reload}>
          <i className="bi bi-arrow-clockwise me-1" />
          รีเฟรช
        </button>
      </div>

      <MaDataState loading={loading} error={error} hasData={hasData} onRetry={reload} />

      {!blockedByState && (
        <>
          <div className="row g-2 g-md-3 mb-4">
            <div className="col-4">
              <div className="stat">
                <span className="tag sky ma-stat-icon" aria-hidden="true">
                  <i className="bi bi-clipboard2-heart" />
                </span>
                <div className="num">{counts.all}</div>
                <div className="small text-muted">ผู้ป่วยทั้งหมด</div>
              </div>
            </div>
            <div className="col-4">
              <div className="stat">
                <span className="tag warn ma-stat-icon" aria-hidden="true">
                  <i className="bi bi-exclamation-triangle" />
                </span>
                <div className="num">{counts.caution}</div>
                <div className="small text-muted">มีข้อควรระวัง</div>
              </div>
            </div>
            <div className="col-4">
              <div className="stat">
                <span className="tag ok ma-stat-icon" aria-hidden="true">
                  <i className="bi bi-calendar2-check" />
                </span>
                <div className="num">{counts.upcoming}</div>
                <div className="small text-muted">มีนัดถัดไป</div>
              </div>
            </div>
          </div>

          <div className="card-soft mb-4">
            <div className="pill-tabs ma-status-tabs mb-3" role="tablist" aria-label="หมวดหมู่ผู้ป่วย">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className={tab === t.id ? 'active' : ''}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                  <span className="count">{t.count}</span>
                </button>
              ))}
            </div>

            <div className="ma-filter-bar">
              <div className="input-group ma-search-group">
                <span className="input-group-text">
                  <i className="bi bi-search" />
                </span>
                <input
                  type="search"
                  className="form-control"
                  placeholder="ค้นหาชื่อสัตว์ / เจ้าของ / เบอร์โทร"
                  aria-label="ค้นหาผู้ป่วย"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              <select
                className="form-select w-auto"
                aria-label="กรองตามชนิดสัตว์"
                value={speciesFilter}
                onChange={(e) => setSpeciesFilter(e.target.value)}
              >
                <option value="all">ชนิดสัตว์ทั้งหมด</option>
                {SPECIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.emoji} {s.label}
                  </option>
                ))}
              </select>

              <select
                className="form-select w-auto"
                aria-label="เรียงลำดับผู้ป่วย"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="next">เรียง: นัดถัดไปใกล้สุด</option>
                <option value="last">เรียง: มาล่าสุด</option>
                <option value="name">เรียง: ชื่อ ก–ฮ</option>
              </select>

              {hasActiveFilter && (
                <button type="button" className="btn btn-soft btn-sm" onClick={clearFilters}>
                  ล้างตัวกรอง
                </button>
              )}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="card-soft">
              <div className="empty-box">
                <i className="bi bi-search" />
                <div>
                  {patients.length === 0
                    ? 'ยังไม่มีผู้ป่วย — ผู้ป่วยมาจากสัตว์ที่เจ้าของลงทะเบียนในระบบ'
                    : 'ไม่พบผู้ป่วยที่ตรงกับเงื่อนไข'}
                </div>
                {hasActiveFilter && (
                  <button type="button" className="btn btn-soft mt-3" onClick={clearFilters}>
                    ล้างตัวกรอง
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="row g-3">
              {filtered.map((p) => {
                const sp = speciesOf(p.species);
                const flags = p.flags ?? [];
                const cautionText = buildCautionSummary(flags, p.allergies);

                return (
                  <div className="col-12 col-lg-6" key={p.id}>
                    <div
                      className="card-soft ma-queue-card ma-clickable-row h-100 d-flex flex-column"
                      role="button"
                      tabIndex={0}
                      onClick={() => openDetail(p.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openDetail(p.id);
                        }
                      }}
                    >
                      <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                        <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                          <PetPhoto pet={{ name: p.name, species: p.species }} size="xs" />
                          <div style={{ minWidth: 0 }}>
                            <div className="mitr fs-5 lh-sm d-flex align-items-center gap-1">
                              <span className="text-truncate">{p.name}</span>
                              {cautionText && (
                                <span
                                  className="ma-caution-icon"
                                  title={`ข้อควรระวัง: ${cautionText}`}
                                >
                                  <i className="bi bi-exclamation-triangle-fill" />
                                </span>
                              )}
                            </div>
                            <div className="small text-muted">
                              {sp.emoji} {sp.label}
                              {p.breed ? ` · ${p.breed}` : ''}
                            </div>
                          </div>
                        </div>

                        <span className="tag sky m-0 flex-shrink-0">
                          มาตรวจ {p.visitCount ?? 0} ครั้ง
                        </span>
                      </div>

                      <div className="small d-grid gap-1 mb-2">
                        <div className="text-muted">
                          <i className="bi bi-person me-1 text-sky" />
                          {p.ownerName || '—'} · {p.ownerPhone || '—'}
                        </div>
                        <div className="text-muted">
                          <i className="bi bi-clock-history me-1 text-sky" />
                          ครั้งล่าสุด: {p.lastVisit ? formatDate(p.lastVisit) : 'ยังไม่เคยมาตรวจ'}
                        </div>
                        <div>
                          <i className="bi bi-calendar2-check me-1 text-sky" />
                          นัดถัดไป:{' '}
                          {p.nextAppointment ? (
                            <span className="fw-medium">
                              {formatDate(p.nextAppointment.date)} · {p.nextAppointment.time} น.
                              {p.nextAppointment.vet ? ` (${p.nextAppointment.vet})` : ''}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </div>
                      </div>

                      {(flags.length > 0 || p.allergies) && (
                        <div className="d-flex flex-wrap gap-1 mt-auto pt-2">
                          {flags.map((f) => {
                            const flagMeta = CAUTION_FLAGS[f];
                            if (!flagMeta) return null;
                            return (
                              <span key={f} className={`tag ${flagMeta.tag} m-0`}>
                                <i className={`bi ${flagMeta.icon} me-1`} />
                                {flagMeta.label}
                              </span>
                            );
                          })}
                          {p.allergies && !flags.includes('drug_allergy') && (
                            <span className="tag danger m-0" title={p.allergies}>
                              <i className="bi bi-capsule me-1" />
                              แพ้: {p.allergies}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
