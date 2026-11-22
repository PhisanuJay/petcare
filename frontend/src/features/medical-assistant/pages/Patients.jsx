import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PetPhoto from '../../pet-owner/components/PetPhoto.jsx';
import { SPECIES, formatDate, speciesOf } from '../../pet-owner/petUtils.js';
import { buildCautionSummary } from '../components/PatientNameLink.jsx';
import { CAUTION_FLAGS, offsetDateKey } from '../data/constants.js';
import { usePatients } from '../data/usePatients.js';

function hasCaution(patient) {
  return patient.flags.length > 0 || Boolean(patient.pet?.allergies);
}

function hasTodayAppointment(patient, todayKey) {
  return patient.appointments.some(
    (a) => a.date === todayKey && a.status !== 'cancelled' && a.status !== 'no_show' && a.status !== 'rejected',
  );
}

/**
 * Patients — Role: Medical Assistant
 * Owner: เอิร์ท
 */
export default function PatientsPage() {
  const { patients } = usePatients();
  const navigate = useNavigate();

  const todayKey = offsetDateKey(0);

  const [tab, setTab] = useState('all');
  const [speciesFilter, setSpeciesFilter] = useState('all');
  const [sortBy, setSortBy] = useState('next');
  const [query, setQuery] = useState('');

  const counts = useMemo(() => {
    let today = 0;
    let registered = 0;
    let walkin = 0;
    let caution = 0;

    for (const p of patients) {
      if (hasTodayAppointment(p, todayKey)) today += 1;
      if (p.registered) registered += 1;
      else walkin += 1;
      if (hasCaution(p)) caution += 1;
    }

    return {
      all: patients.length,
      today,
      registered,
      walkin,
      caution,
    };
  }, [patients, todayKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const list = patients.filter((p) => {
      if (tab === 'today' && !hasTodayAppointment(p, todayKey)) return false;
      if (tab === 'registered' && !p.registered) return false;
      if (tab === 'walkin' && p.registered) return false;
      if (tab === 'caution' && !hasCaution(p)) return false;
      if (speciesFilter !== 'all' && p.species !== speciesFilter) return false;

      if (q) {
        const hit = [
          p.petName,
          p.breed,
          p.owner.name,
          p.owner.phone,
          p.pet?.microchip,
        ].some((v) => v?.toLowerCase().includes(q));
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
        const aLast = a.lastVisit ? `${a.lastVisit.date}${a.lastVisit.time}` : '';
        const bLast = b.lastVisit ? `${b.lastVisit.date}${b.lastVisit.time}` : '';
        if (aLast !== bLast) return bLast.localeCompare(aLast);
      }
      return (a.petName || '').localeCompare(b.petName || '', 'th');
    });
  }, [patients, tab, speciesFilter, sortBy, query, todayKey]);

  const hasActiveFilter = tab !== 'all' || speciesFilter !== 'all' || query.trim() !== '';

  function clearFilters() {
    setTab('all');
    setSpeciesFilter('all');
    setQuery('');
  }

  function openDetail(patientId) {
    navigate(`/medical-assistant/patients/${encodeURIComponent(patientId)}`);
  }

  const tabs = [
    { id: 'all', label: 'ทั้งหมด', count: counts.all },
    { id: 'today', label: 'มีนัดวันนี้', count: counts.today },
    { id: 'registered', label: 'ลงทะเบียน', count: counts.registered },
    { id: 'walkin', label: 'Walk-in', count: counts.walkin },
    { id: 'caution', label: 'มีข้อควรระวัง', count: counts.caution },
  ];

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>ผู้ป่วย</h1>
          <p>ค้นหาสัตว์ป่วย ดูประวัติการรักษา และข้อควรระวังก่อนเข้าตรวจ</p>
        </div>
      </div>

      <div className="row g-2 g-md-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="stat">
            <span className="tag sky ma-stat-icon" aria-hidden="true">
              <i className="bi bi-clipboard2-heart" />
            </span>
            <div className="num">{counts.all}</div>
            <div className="small text-muted">ผู้ป่วยทั้งหมด</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="stat">
            <span className="tag ok ma-stat-icon" aria-hidden="true">
              <i className="bi bi-calendar2-check" />
            </span>
            <div className="num">{counts.today}</div>
            <div className="small text-muted">มีนัดวันนี้</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="stat">
            <span className="tag sky ma-stat-icon" aria-hidden="true">
              <i className="bi bi-person-check" />
            </span>
            <div className="num">{counts.registered}</div>
            <div className="small text-muted">ลงทะเบียนในระบบ</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="stat">
            <span className="tag warn ma-stat-icon" aria-hidden="true">
              <i className="bi bi-exclamation-triangle" />
            </span>
            <div className="num">{counts.caution}</div>
            <div className="small text-muted">มีข้อควรระวัง</div>
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
              placeholder="ค้นหาชื่อสัตว์ / เจ้าของ / เบอร์ / ไมโครชิป"
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

      <div className="card-soft">
        <div className="section-label">
          <i className="bi bi-journal-medical" />
          รายชื่อผู้ป่วย ({filtered.length} ตัว)
        </div>

        {filtered.length === 0 ? (
          <div className="empty-box">
            <i className="bi bi-search" />
            <div>ไม่พบผู้ป่วยที่ตรงกับเงื่อนไข</div>
            {hasActiveFilter && (
              <button type="button" className="btn btn-soft mt-3" onClick={clearFilters}>
                ล้างตัวกรอง
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="d-none d-md-block table-responsive">
              <table className="ma-table">
                <thead>
                  <tr>
                    <th>สัตว์</th>
                    <th>เจ้าของ</th>
                    <th>มาล่าสุด</th>
                    <th>นัดถัดไป</th>
                    <th>จำนวนครั้ง</th>
                    <th>ข้อควรระวัง</th>
                    <th>ประเภท</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const sp = speciesOf(p.species);
                    const cautionText = buildCautionSummary(p.flags, p.pet?.allergies);
                    const firstFlag = p.flags[0] ? CAUTION_FLAGS[p.flags[0]] : null;
                    const extraCount = Math.max(0, p.flags.length - 1);

                    return (
                      <tr
                        key={p.patientId}
                        className="ma-clickable-row"
                        tabIndex={0}
                        onClick={() => openDetail(p.patientId)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openDetail(p.patientId);
                          }
                        }}
                      >
                        <td className="text-nowrap">
                          <div className="d-flex align-items-center gap-2">
                            <PetPhoto
                              pet={{ name: p.petName, species: p.species, photo: p.pet?.photo }}
                              size="xs"
                            />
                            <div>
                              <div className="fw-medium d-flex align-items-center gap-1">
                                <span>{p.petName}</span>
                                {cautionText && (
                                  <span
                                    className="ma-caution-icon"
                                    title={`ข้อควรระวัง: ${cautionText}`}
                                  >
                                    <i className="bi bi-exclamation-triangle-fill" />
                                  </span>
                                )}
                              </div>
                              <div className="small text-muted text-truncate" style={{ maxWidth: 180 }}>
                                {sp.label}
                                {p.breed ? ` · ${p.breed}` : ''}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div>{p.owner.name}</div>
                          <div className="small text-muted text-nowrap">{p.owner.phone || '-'}</div>
                        </td>
                        <td className="text-nowrap small">
                          {p.lastVisit ? formatDate(p.lastVisit.date) : '—'}
                        </td>
                        <td className="text-nowrap small">
                          {p.nextAppointment ? (
                            <span>
                              {formatDate(p.nextAppointment.date)} · {p.nextAppointment.time} น.
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="text-nowrap small">{p.visitCount} ครั้ง</td>
                        <td className="text-nowrap">
                          {firstFlag ? (
                            <span className="d-inline-flex align-items-center gap-1">
                              <span className={`tag ${firstFlag.tag} m-0`} title={cautionText}>
                                <i className={`bi ${firstFlag.icon} me-1`} />
                                {firstFlag.label}
                              </span>
                              {extraCount > 0 && (
                                <span className="tag m-0" title={cautionText}>
                                  +{extraCount}
                                </span>
                              )}
                            </span>
                          ) : p.pet?.allergies ? (
                            <span className="tag danger m-0" title={p.pet.allergies}>
                              <i className="bi bi-capsule me-1" />
                              มีประวัติแพ้
                            </span>
                          ) : (
                            <span className="text-muted small">—</span>
                          )}
                        </td>
                        <td className="text-nowrap">
                          <span className={`tag ${p.registered ? 'sky' : ''} m-0`}>
                            {p.registered ? 'ลงทะเบียน' : 'Walk-in'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="d-md-none d-grid gap-3">
              {filtered.map((p) => {
                const sp = speciesOf(p.species);
                const cautionText = buildCautionSummary(p.flags, p.pet?.allergies);
                return (
                  <div
                    key={p.patientId}
                    className="record-row ma-clickable-row mb-0 pb-3"
                    role="button"
                    tabIndex={0}
                    onClick={() => openDetail(p.patientId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openDetail(p.patientId);
                      }
                    }}
                  >
                    <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                      <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                        <PetPhoto
                          pet={{ name: p.petName, species: p.species, photo: p.pet?.photo }}
                          size="xs"
                        />
                        <div style={{ minWidth: 0 }}>
                          <div className="fw-medium d-flex align-items-center gap-1">
                            <span className="text-truncate">{p.petName}</span>
                            {cautionText && (
                              <span className="ma-caution-icon" title={`ข้อควรระวัง: ${cautionText}`}>
                                <i className="bi bi-exclamation-triangle-fill" />
                              </span>
                            )}
                          </div>
                          <div className="small text-muted">
                            {sp.label}
                            {p.breed ? ` · ${p.breed}` : ''}
                          </div>
                        </div>
                      </div>
                      <span className={`tag ${p.registered ? 'sky' : ''} m-0 flex-shrink-0`}>
                        {p.registered ? 'ลงทะเบียน' : 'Walk-in'}
                      </span>
                    </div>

                    <div className="small text-muted mb-1">
                      <i className="bi bi-person me-1" />
                      {p.owner.name} · {p.owner.phone || '-'}
                    </div>
                    <div className="small text-muted mb-2">
                      มาคลินิก {p.visitCount} ครั้ง
                      {p.lastVisit ? ` · ล่าสุด ${formatDate(p.lastVisit.date)}` : ''}
                      {p.nextAppointment
                        ? ` · นัดถัดไป ${formatDate(p.nextAppointment.date)} ${p.nextAppointment.time} น.`
                        : ''}
                    </div>

                    {(p.flags.length > 0 || p.pet?.allergies) && (
                      <div className="d-flex flex-wrap gap-1">
                        {p.flags.map((f) => {
                          const meta = CAUTION_FLAGS[f];
                          if (!meta) return null;
                          return (
                            <span key={f} className={`tag ${meta.tag} m-0`}>
                              <i className={`bi ${meta.icon} me-1`} />
                              {meta.label}
                            </span>
                          );
                        })}
                        {p.pet?.allergies && !p.flags.includes('drug_allergy') && (
                          <span className="tag danger m-0">
                            <i className="bi bi-capsule me-1" />
                            มีประวัติแพ้
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
