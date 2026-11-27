import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePets } from '../usePets.js';
import { PARASITE_TYPES, careReminders, formatDate, labelOf, reminderText, speciesOf } from '../petUtils.js';

/**
 * Medical (health history) — Role: Pet Owner (มะแอ่ว)
 * Read-only health log grouped by month; vaccines, parasites and treatments.
 */

const KINDS = [
  { value: 'all', label: 'ทั้งหมด', icon: 'bi-collection' },
  { value: 'vaccine', label: 'วัคซีน', icon: 'bi-capsule' },
  { value: 'parasite', label: 'ถ่ายพยาธิ', icon: 'bi-bug' },
  { value: 'treatment', label: 'การรักษา', icon: 'bi-journal-medical' },
];

const kindMeta = (kind) => KINDS.find((k) => k.value === kind) ?? KINDS[0];

function buildEntries(pets) {
  const entries = [];
  for (const pet of pets) {
    for (const v of pet.vaccines ?? []) {
      entries.push({
        key: `v-${v.id}`,
        pet,
        kind: 'vaccine',
        date: v.date,
        title: v.name || 'วัคซีน',
        byClinic: v.source === 'vet',
        detail: [v.place, v.vet, v.lot].filter(Boolean).join(' · ') || null,
        nextDate: v.nextDate,
        nextLabel: 'นัดครั้งถัดไป',
      });
    }
    for (const p of pet.parasites ?? []) {
      entries.push({
        key: `p-${p.id}`,
        pet,
        kind: 'parasite',
        byClinic: p.source === 'vet',
        date: p.date,
        title: labelOf(PARASITE_TYPES, p.type),
        detail: [p.product, p.vet].filter(Boolean).join(' · ') || null,
        nextDate: p.nextDate,
        nextLabel: 'ครั้งถัดไป',
      });
    }
    for (const t of pet.treatments ?? []) {
      entries.push({
        key: `t-${t.id}`,
        pet,
        kind: 'treatment',
        byClinic: t.source === 'vet',
        date: t.date,
        title: t.diagnosis || t.symptoms || 'การรักษา',
        detail: [t.treatment, t.vet, t.clinic].filter(Boolean).join(' · ') || null,
        nextDate: t.followUp,
        nextLabel: 'นัดติดตาม',
      });
    }
  }
  return entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function monthLabel(ym) {
  if (!ym || ym === 'unknown') return 'ไม่ระบุวันที่';
  const d = new Date(`${ym}-01T12:00:00`);
  if (Number.isNaN(d.getTime())) return ym;
  return d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
}

function dateParts(iso) {
  if (!iso) return { day: '—', mon: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { day: '—', mon: '' };
  return {
    day: d.getDate(),
    mon: d.toLocaleDateString('th-TH', { month: 'short' }),
  };
}

function dueStatus(date) {
  const [r] = careReminders([{ vaccines: [{ nextDate: date }] }]);
  return r;
}

function UpcomingStrip({ pets, petId }) {
  const scoped = petId === 'all' ? pets : pets.filter((p) => p.id === petId);
  const upcoming = careReminders(scoped)
    .filter((r) => r.status === 'overdue' || r.status === 'soon')
    .slice(0, 3);

  if (upcoming.length === 0) return null;

  return (
    <div className="health-upcoming">
      <div className="small fw-medium text-muted px-1">ใกล้ถึงกำหนด / เลยกำหนด</div>
      {upcoming.map((r) => {
        const tone = r.status === 'overdue' ? 'danger' : 'warn';
        return (
          <Link
            key={`${r.pet.id}-${r.kind}-${r.date}`}
            to={`/pet-owner/my-pets/${r.pet.id}`}
            className="health-upcoming-item"
          >
            <span className={`tag ${tone}`}>{reminderText(r)}</span>
            <div className="flex-grow-1 min-w-0">
              <div className="fw-medium text-truncate">
                {r.title} · {r.pet.name}
              </div>
              <div className="small text-muted">ครบ {formatDate(r.date)}</div>
            </div>
            <i className="bi bi-chevron-right text-muted" />
          </Link>
        );
      })}
    </div>
  );
}

function LogItem({ entry, showPet }) {
  const { day, mon } = dateParts(entry.date);
  const meta = kindMeta(entry.kind);
  const due = entry.nextDate ? dueStatus(entry.nextDate) : null;

  return (
    <article className="health-log-item">
      <div className="health-log-date">
        <div className="day">{day}</div>
        <div className="mon">{mon}</div>
      </div>
      <div className={`health-log-icon ${entry.kind}`} aria-hidden>
        <i className={`bi ${meta.icon}`} />
      </div>
      <div className="health-log-body">
        <div className="health-log-title">{entry.title}</div>
        <div className="health-log-meta">
          <span>{meta.label}</span>
          {showPet && <span>น้อง{entry.pet.name}</span>}
          {entry.byClinic && <span>คลินิกบันทึก</span>}
          {entry.detail && <span>{entry.detail}</span>}
        </div>
        {due && (
          <span className={`tag mt-2 d-inline-block ${due.status === 'overdue' ? 'danger' : due.status === 'soon' ? 'warn' : 'sky'}`}>
            {entry.nextLabel} {formatDate(entry.nextDate)} · {reminderText(due)}
          </span>
        )}
      </div>
      <Link
        to={`/pet-owner/my-pets/${entry.pet.id}`}
        className="btn btn-soft btn-sm align-self-center flex-shrink-0"
        title={`ดูโปรไฟล์${entry.pet.name}`}
      >
        <i className="bi bi-box-arrow-up-right" />
      </Link>
    </article>
  );
}

function groupByMonth(entries) {
  const map = new Map();
  for (const e of entries) {
    const ym = e.date?.slice(0, 7) || 'unknown';
    if (!map.has(ym)) map.set(ym, []);
    map.get(ym).push(e);
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

export default function MedicalPage() {
  const { pets, loading, error, reload } = usePets();
  const [petId, setPetId] = useState('all');
  const [kind, setKind] = useState('all');

  const entries = useMemo(() => buildEntries(pets), [pets]);
  const shown = useMemo(
    () =>
      entries.filter(
        (e) => (petId === 'all' || e.pet.id === petId) && (kind === 'all' || e.kind === kind),
      ),
    [entries, petId, kind],
  );
  const groups = useMemo(() => groupByMonth(shown), [shown]);
  const showPet = petId === 'all' && pets.length > 1;

  const counts = useMemo(() => {
    const base = entries.filter((e) => petId === 'all' || e.pet.id === petId);
    return {
      all: base.length,
      vaccine: base.filter((e) => e.kind === 'vaccine').length,
      parasite: base.filter((e) => e.kind === 'parasite').length,
      treatment: base.filter((e) => e.kind === 'treatment').length,
    };
  }, [entries, petId]);

  return (
    <div className="page-wrap">
      <div className="container">
        <div className="page-head">
          <div>
            <h1>ประวัติสุขภาพ</h1>
            <p>ดูวัคซีน ถ่ายพยาธิ และการรักษา — เรียงตามเดือน อ่านง่ายในที่เดียว</p>
          </div>
          <Link to="/pet-owner/booking" className="btn btn-sky">
            <i className="bi bi-calendar-check me-1" />
            จองนัดหมาย
          </Link>
        </div>

        {error && (
          <div className="alert alert-danger d-flex align-items-center justify-content-between" role="alert">
            <span>{error}</span>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={reload}>
              ลองใหม่
            </button>
          </div>
        )}

        {loading ? (
          <div className="card-soft empty-box">กำลังโหลดข้อมูล...</div>
        ) : pets.length === 0 ? (
          <div className="card-soft empty-box">
            <i className="bi bi-heart" />
            ยังไม่มีสัตว์เลี้ยง เพิ่มน้องตัวแรกเพื่อเริ่มบันทึกประวัติสุขภาพ
            <div className="mt-3">
              <Link to="/pet-owner/my-pets/new" className="btn btn-sky">
                เพิ่มสัตว์เลี้ยง
              </Link>
            </div>
          </div>
        ) : (
          <>
            <UpcomingStrip pets={pets} petId={petId} />

            <div className="health-toolbar">
              <div className="pet-pills">
                <button
                  type="button"
                  className={`btn btn-sm ${petId === 'all' ? 'btn-sky' : 'btn-soft'}`}
                  onClick={() => setPetId('all')}
                >
                  ทุกตัว ({pets.length})
                </button>
                {pets.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    className={`btn btn-sm ${petId === p.id ? 'btn-sky' : 'btn-soft'}`}
                    onClick={() => setPetId(p.id)}
                  >
                    {speciesOf(p.species).emoji} {p.name}
                  </button>
                ))}
              </div>
              <div className="kind-tabs" role="tablist" aria-label="ประเภทประวัติ">
                {KINDS.map((k) => (
                  <button
                    type="button"
                    key={k.value}
                    role="tab"
                    aria-selected={kind === k.value}
                    className={`btn btn-sm ${kind === k.value ? 'btn-sky' : 'btn-soft'}`}
                    onClick={() => setKind(k.value)}
                  >
                    <i className={`bi ${k.icon} me-1`} />
                    {k.label}
                    <span className="opacity-75 ms-1">({counts[k.value]})</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="card-soft" style={{ padding: '1.25rem 1.5rem' }}>
              {shown.length === 0 ? (
                <div className="empty-box py-3">
                  <i className="bi bi-journal-medical" />
                  ยังไม่มีประวัติในหมวดนี้
                  {petId !== 'all' && (
                    <div className="mt-3">
                      <Link to={`/pet-owner/my-pets/${petId}/edit`} className="btn btn-soft">
                        เพิ่มประวัติให้ {pets.find((p) => p.id === petId)?.name}
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                groups.map(([ym, items]) => (
                  <section key={ym}>
                    <h2 className="health-log-month">{monthLabel(ym)}</h2>
                    {items.map((e) => (
                      <LogItem key={e.key} entry={e} showPet={showPet} />
                    ))}
                  </section>
                ))
              )}
            </div>

            <p className="small text-muted mt-3 mb-0">
              แก้ไขประวัติได้ที่หน้า{' '}
              <Link to="/pet-owner/my-pets">สัตว์เลี้ยงของฉัน</Link> → เลือกน้อง → แก้ไข
            </p>
          </>
        )}
      </div>
    </div>
  );
}