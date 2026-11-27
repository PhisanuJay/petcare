import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PetPhoto from '../../pet-owner/components/PetPhoto.jsx';
import { SPECIES, formatDate, speciesOf } from '../../pet-owner/petUtils.js';
import MaDataState from '../components/MaDataState.jsx';
import { buildCautionSummary } from '../components/PatientNameLink.jsx';
import { CAUTION_FLAGS } from '../data/constants.js';
import { usePatients } from '../data/usePatients.js';

/**
 * Patients — Role: Clinic Admin / Medical Assistant
 */
export default function PatientsPage() {
  const { patients, loading, error, reload } = usePatients();
  const navigate = useNavigate();

  const [tab, setTab] = useState('all');
  const [speciesFilter, setSpeciesFilter] = useState('all');
  const [sortBy, setSortBy] = useState('next');
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');

  const counts = useMemo(() => {
    let upcoming = 0;
    for (const p of patients) {
      if (p.nextAppointment) upcoming += 1;
    }
    return {
      all: patients.length,
      upcoming,
    };
  }, [patients]);

  const filtered = useMemo(() => {
    const q = appliedQuery.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');

    const list = patients.filter((p) => {
      if (tab === 'upcoming' && !p.nextAppointment) return false;
      if (speciesFilter !== 'all' && p.species !== speciesFilter) return false;

      if (q) {
        const fields = [p.name, p.breed, p.ownerName, p.ownerPhone, speciesOf(p.species).label];
        const textHit = fields.some((v) => String(v || '').toLowerCase().includes(q));
        const phoneHit =
          digits.length >= 3 &&
          String(p.ownerPhone || '').replace(/\D/g, '').includes(digits);
        if (!textHit && !phoneHit) return false;
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
  }, [patients, tab, speciesFilter, sortBy, appliedQuery]);

  const hasActiveFilter = tab !== 'all' || speciesFilter !== 'all' || Boolean(appliedQuery.trim());
  const hasData = patients.length > 0;
  const blockedByState = !hasData && (loading || Boolean(error));

  function runSearch(event) {
    event?.preventDefault?.();
    setAppliedQuery(query.trim());
  }

  function clearSearch() {
    setQuery('');
    setAppliedQuery('');
  }

  function clearFilters() {
    setTab('all');
    setSpeciesFilter('all');
    clearSearch();
  }

  function openDetail(petId) {
    navigate(`/clinic-admin/patients/${encodeURIComponent(petId)}`);
  }

  const tabs = [
    { id: 'all', label: 'ทั้งหมด', count: counts.all },
    { id: 'upcoming', label: 'มีนัดถัดไป', count: counts.upcoming },
  ];

  return (
    <section className="ca-patients">
      <div className="page-head">
        <div>
          <h1>สัตว์เลี้ยง</h1>
          <p>ค้นหาสัตว์เลี้ยง ดูประวัติการรักษา และบันทึกภายในก่อนเข้าตรวจ</p>
        </div>
        <button type="button" className="btn btn-soft" disabled={loading} onClick={reload}>
          <i className="bi bi-arrow-clockwise me-1" />
          รีเฟรช
        </button>
      </div>

      <MaDataState loading={loading} error={error} hasData={hasData} onRetry={reload} />

      {!blockedByState && (
        <>
          <div className="ca-stat-grid ca-stat-grid--two mb-4">
            <div className="stat">
              <span className="ca-stat-icon" aria-hidden="true">
                <i className="bi bi-clipboard2-heart" />
              </span>
              <div className="num">{counts.all}</div>
              <div className="small text-muted">สัตว์เลี้ยงทั้งหมด</div>
            </div>
            <div className="stat">
              <span className="ca-stat-icon" aria-hidden="true">
                <i className="bi bi-calendar2-check" />
              </span>
              <div className="num">{counts.upcoming}</div>
              <div className="small text-muted">มีนัดถัดไป</div>
            </div>
          </div>

          <div className="card-soft ca-patients-board">
            <div className="pill-tabs ca-scroll-tabs mb-3" role="tablist" aria-label="หมวดหมู่สัตว์เลี้ยง">
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

            <div className="ca-filter-bar">
              <form className="input-group ca-search-group" onSubmit={runSearch}>
                <span className="input-group-text">
                  <i className="bi bi-search" />
                </span>
                <input
                  type="search"
                  className="form-control"
                  placeholder="ค้นหาชื่อสัตว์ / เจ้าของ / เบอร์โทร"
                  aria-label="ค้นหาสัตว์เลี้ยง"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {appliedQuery ? (
                  <button type="button" className="btn btn-soft" onClick={clearSearch}>
                    ล้าง
                  </button>
                ) : null}
                <button type="submit" className="btn btn-sky">
                  ค้นหา
                </button>
              </form>

              <select
                className="form-select ca-patients-select"
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
                className="form-select ca-patients-select"
                aria-label="เรียงลำดับสัตว์เลี้ยง"
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

            <div className="ca-patients-board__head">
              <div className="section-label mb-0">
                <i className="bi bi-clipboard2-heart" />
                รายการสัตว์เลี้ยง
                <span className="ca-patients-board__count">{filtered.length} รายการ</span>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="empty-box">
                <i className="bi bi-search" />
                <div>
                  {patients.length === 0
                    ? 'ยังไม่มีสัตว์เลี้ยง — รายชื่อมาจากสัตว์ที่เจ้าของลงทะเบียนในระบบ'
                    : 'ไม่พบสัตว์เลี้ยงที่ตรงกับเงื่อนไข'}
                </div>
                {hasActiveFilter && (
                  <button type="button" className="btn btn-soft mt-3" onClick={clearFilters}>
                    ล้างตัวกรอง
                  </button>
                )}
              </div>
            ) : (
              <div className="ca-patients-list">
                {filtered.map((p) => {
                  const sp = speciesOf(p.species);
                  const flags = p.flags ?? [];
                  const cautionText = buildCautionSummary(flags, p.allergies);

                  return (
                    <article
                      className="ca-patient-row"
                      key={p.id}
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
                      <div className="ca-patient-row__identity">
                        <PetPhoto pet={{ name: p.name, species: p.species }} size="xs" />
                        <div className="ca-patient-row__who">
                          <div className="ca-patient-row__name">
                            <span>{p.name}</span>
                            {cautionText && (
                              <span
                                className="ca-patient-row__caution"
                                title={`ข้อควรระวัง: ${cautionText}`}
                              >
                                <i className="bi bi-exclamation-triangle-fill" />
                              </span>
                            )}
                          </div>
                          <div className="ca-patient-row__meta">
                            {sp.emoji} {sp.label}
                            {p.breed ? ` · ${p.breed}` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="ca-patient-row__facts">
                        <div>
                          <i className="bi bi-person" aria-hidden="true" />
                          <span>
                            {p.ownerName || '—'}
                            {p.ownerPhone ? ` · ${p.ownerPhone}` : ''}
                          </span>
                        </div>
                        <div>
                          <i className="bi bi-clock-history" aria-hidden="true" />
                          <span>
                            ครั้งล่าสุด: {p.lastVisit ? formatDate(p.lastVisit) : 'ยังไม่เคยมาตรวจ'}
                          </span>
                        </div>
                        <div>
                          <i className="bi bi-calendar2-check" aria-hidden="true" />
                          <span>
                            นัดถัดไป:{' '}
                            {p.nextAppointment ? (
                              <strong>
                                {formatDate(p.nextAppointment.date)} · {p.nextAppointment.time} น.
                                {p.nextAppointment.vet ? ` (${p.nextAppointment.vet})` : ''}
                              </strong>
                            ) : (
                              '—'
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="ca-patient-row__aside">
                        <span className="tag sky m-0">มาตรวจ {p.visitCount ?? 0} ครั้ง</span>
                        {(flags.length > 0 || p.allergies) && (
                          <div className="ca-patient-row__flags">
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
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
