import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePets } from '../usePets.js';
import { PARASITE_TYPES, careReminders, formatDate, labelOf, reminderText } from '../petUtils.js';
import PetPhoto from '../components/PetPhoto.jsx';

/**
 * Medical (health history) — Role: Pet Owner (มะแอ่ว)
 * Read-only timeline of vaccines, parasite prevention and treatments for all of the owner's pets.
 * Records are added / edited from the pet's own page.
 */

const KINDS = [
  { value: 'all', label: 'ทั้งหมด', icon: 'bi-collection' },
  { value: 'vaccine', label: 'วัคซีน', icon: 'bi-capsule' },
  { value: 'parasite', label: 'ถ่ายพยาธิ / เห็บหมัด', icon: 'bi-bug' },
  { value: 'treatment', label: 'การรักษา', icon: 'bi-journal-medical' },
];

const kindMeta = (kind) => KINDS.find((k) => k.value === kind);

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
        lines: [
          (v.place || v.vet) && `สถานที่: ${[v.place, v.vet].filter(Boolean).join(' · ')}`,
          v.lot && `หมายเหตุ: ${v.lot}`,
        ],
        nextDate: v.nextDate,
        nextLabel: 'นัดครั้งถัดไป',
      });
    }
    for (const p of pet.parasites ?? []) {
      entries.push({
        key: `p-${p.id}`,
        pet,
        kind: 'parasite',
        date: p.date,
        title: labelOf(PARASITE_TYPES, p.type),
        lines: [p.product && `ผลิตภัณฑ์: ${p.product}`],
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
        lines: [
          t.symptoms && t.diagnosis && `อาการ: ${t.symptoms}`,
          t.treatment && `การรักษา: ${t.treatment}`,
          (t.vet || t.clinic) && [t.vet, t.clinic].filter(Boolean).join(' · '),
        ],
        nextDate: t.followUp,
        nextLabel: 'นัดติดตามอาการ',
      });
    }
  }
  return entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function DueTag({ label, date }) {
  const [r] = careReminders([{ vaccines: [{ nextDate: date }] }]);
  const cls = r.status === 'overdue' ? 'danger' : r.status === 'soon' ? 'warn' : 'sky';
  return (
    <span className={`tag ${cls}`}>
      {label} {formatDate(date)} · {reminderText(r)}
    </span>
  );
}

export default function MedicalPage() {
  const { pets, loading, error, reload } = usePets();
  const [petId, setPetId] = useState('all');
  const [kind, setKind] = useState('all');

  const entries = useMemo(() => buildEntries(pets), [pets]);
  const selectedPet = pets.find((p) => p.id === petId) ?? null;
  const shown = entries.filter(
    (e) => (!selectedPet || e.pet.id === selectedPet.id) && (kind === 'all' || e.kind === kind),
  );
  const count = (k) =>
    entries.filter((e) => (!selectedPet || e.pet.id === selectedPet.id) && (k === 'all' || e.kind === k)).length;

  return (
    <div className="page-wrap">
      <div className="container">
        <div className="page-head">
          <div>
            <h1>ประวัติสุขภาพ</h1>
            <p>วัคซีน การถ่ายพยาธิ และการรักษาของสัตว์เลี้ยงทุกตัวในที่เดียว</p>
          </div>
          <Link to="/pet-owner/booking" className="btn btn-sky">
            <i className="bi bi-calendar-check me-1" />
            จองนัดหมาย
          </Link>
        </div>

        {error && (
          <div className="alert alert-danger d-flex align-items-center justify-content-between" role="alert">
            <span>{error}</span>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={reload}>ลองใหม่</button>
          </div>
        )}

        {loading ? (
          <div className="card-soft empty-box">กำลังโหลดข้อมูล...</div>
        ) : pets.length === 0 ? (
          <div className="card-soft empty-box">
            <i className="bi bi-heart" />
            ยังไม่มีสัตว์เลี้ยง เพิ่มน้องตัวแรกเพื่อเริ่มบันทึกประวัติสุขภาพ
            <div className="mt-3">
              <Link to="/pet-owner/my-pets/new" className="btn btn-sky">เพิ่มสัตว์เลี้ยง</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="d-flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                className={`btn ${petId === 'all' ? 'btn-sky' : 'btn-soft'}`}
                onClick={() => setPetId('all')}
              >
                สัตว์เลี้ยงทั้งหมด
              </button>
              {pets.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  className={`btn ${petId === p.id ? 'btn-sky' : 'btn-soft'}`}
                  onClick={() => setPetId(p.id)}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <div className="d-flex flex-wrap gap-2 mb-4">
              {KINDS.map((k) => (
                <button
                  type="button"
                  key={k.value}
                  className={`btn btn-sm ${kind === k.value ? 'btn-sky' : 'btn-soft'}`}
                  onClick={() => setKind(k.value)}
                >
                  <i className={`bi ${k.icon} me-1`} />
                  {k.label} ({count(k.value)})
                </button>
              ))}
            </div>

            <div className="card-soft">
              {shown.length === 0 ? (
                <div className="empty-box py-3">
                  <i className="bi bi-journal-medical" />
                  ยังไม่มีประวัติในหมวดนี้
                  {selectedPet && (
                    <div className="mt-3">
                      <Link to={`/pet-owner/my-pets/${selectedPet.id}/edit`} className="btn btn-soft">
                        เพิ่มประวัติให้ {selectedPet.name}
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="timeline">
                  {shown.map((e) => (
                    <div className="tl-item" key={e.key}>
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <PetPhoto pet={e.pet} style={{ width: 32, height: 32, fontSize: '1rem', borderWidth: 1 }} />
                        <Link to={`/pet-owner/my-pets/${e.pet.id}`} className="mitr text-decoration-none">
                          {e.pet.name}
                        </Link>
                        <span className="tag">
                          <i className={`bi ${kindMeta(e.kind).icon} me-1`} />
                          {kindMeta(e.kind).label}
                        </span>
                        {e.byClinic && <span className="tag ok">บันทึกโดยคลินิก</span>}
                      </div>
                      <div className="date">{formatDate(e.date)}</div>
                      <div className="fw-medium">{e.title}</div>
                      {e.lines.filter(Boolean).map((line) => (
                        <div className="small text-muted" key={line}>{line}</div>
                      ))}
                      {e.nextDate && (
                        <div className="mt-1">
                          <DueTag label={e.nextLabel} date={e.nextDate} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="small text-muted mt-3">
              ต้องการเพิ่มหรือแก้ไขประวัติ? เปิดหน้าสัตว์เลี้ยงแล้วกด “แก้ไข / เพิ่มประวัติ”
            </div>
          </>
        )}
      </div>
    </div>
  );
}
