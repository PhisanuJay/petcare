import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import VetLayout from '../components/VetLayout.jsx';
import { useOwners, usePatient } from '../usePatients.js';
import PetPhoto from '../../pet-owner/components/PetPhoto.jsx';
import { BOOKING_STATUS, todayString } from '../../pet-owner/bookingOptions.js';
import {
  NEUTER_OPTIONS,
  PARASITE_TYPES,
  SEX_OPTIONS,
  ageText,
  careReminders,
  formatDate,
  labelOf,
  reminderText,
  speciesOf,
} from '../../pet-owner/petUtils.js';

/**
 * Customers — Role: Veterinarian (มะแอ่ว)
 * The people who bring pets to the clinic. Pick a customer to see how to reach them and the pets they
 * registered, then pick a pet to see its profile, health notes, vaccines, parasite prevention,
 * treatments and appointments (read-only here: treatments and vaccines are recorded on the
 * Medical Records / Vaccination pages). The URL is still /veterinarian/patients.
 */

const FILTERS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'upcoming', label: 'มีนัดที่กำลังจะถึง' },
  { value: 'visited', label: 'เคยมาตรวจแล้ว' },
];

/** `o` is a customer (or any object with `nextAppointment` and `visitCount`). */
const matches = (o, filter) => {
  if (filter === 'upcoming') return Boolean(o.nextAppointment);
  if (filter === 'visited') return o.visitCount > 0;
  return true;
};

const byDateDesc = (a, b) => (b.date || '').localeCompare(a.date || '');

function DueTag({ date }) {
  if (!date) return <>-</>;
  const [r] = careReminders([{ vaccines: [{ nextDate: date }] }]);
  const cls = r.status === 'overdue' ? 'danger' : r.status === 'soon' ? 'warn' : 'sky';
  return (
    <span className={`tag ${cls}`}>
      {formatDate(date)} · {reminderText(r)}
    </span>
  );
}

function Section({ icon, title, children }) {
  return (
    <div className="mb-4">
      <div className="section-label">
        <i className={`bi ${icon}`} />
        {title}
      </div>
      {children}
    </div>
  );
}

const Empty = ({ text }) => <div className="small text-muted">{text}</div>;

function Info({ k, v }) {
  return (
    <div className="d-flex gap-2 small">
      <span className="text-muted" style={{ minWidth: 120 }}>{k}</span>
      <span>{v || '-'}</span>
    </div>
  );
}

const ownerName = (o) => o.name || 'ไม่ทราบชื่อลูกค้า';

/** One customer in the list: name, phone and the pets they registered. */
function OwnerList({ owners, onSelect }) {
  if (owners.length === 0) {
    return (
      <div className="empty-box py-4">
        <i className="bi bi-search" />
        ไม่พบลูกค้า
      </div>
    );
  }
  return (
    <div className="d-grid gap-2">
      {owners.map((o) => (
        <button
          type="button"
          key={o.id}
          className="btn btn-soft text-start p-3"
          style={{ borderRadius: 20 }}
          onClick={() => onSelect(o.id)}
        >
          <div className="fw-medium">
            <i className="bi bi-person-circle me-1" />
            {ownerName(o)}
          </div>
          {/* one emoji per kind of pet the customer has (🐶 🐱 ...), not the pets' names */}
          <div title="สัตว์เลี้ยงของลูกค้า">
            {[...new Set(o.pets.map((p) => speciesOf(p.species).emoji))].join(' ')}
          </div>
          <div className="small text-muted mt-1">
            {o.nextAppointment
              ? `นัดถัดไป ${formatDate(o.nextAppointment.date)} ${o.nextAppointment.time} น.`
              : o.lastVisit
                ? `มาล่าสุด ${formatDate(o.lastVisit)}`
                : 'ยังไม่เคยมาตรวจ'}
          </div>
        </button>
      ))}
    </div>
  );
}

const ContactRow = ({ icon, label, children }) => (
  <div className="d-flex gap-2 small mb-1">
    <i className={`bi ${icon} text-muted`} title={label} />
    <span>{children || <span className="text-muted">ไม่มีข้อมูล{label}</span>}</span>
  </div>
);

/** How to reach the owner of the pets. */
function ContactCard({ owner }) {
  const { phone, email, address, emergencyName, emergencyPhone } = owner;
  return (
    <div className="mb-3">
      <div className="section-label">
        <i className="bi bi-person-lines-fill" />
        ช่องทางติดต่อเจ้าของ
      </div>
      <div className="fw-medium mb-1">{ownerName(owner)}</div>
      <ContactRow icon="bi-telephone" label="เบอร์โทร">
        {phone && <a href={`tel:${phone}`}>{phone}</a>}
      </ContactRow>
      <ContactRow icon="bi-envelope" label="อีเมล">
        {email && <a href={`mailto:${email}`}>{email}</a>}
      </ContactRow>
      <ContactRow icon="bi-geo-alt" label="ที่อยู่">{address}</ContactRow>
      {(emergencyName || emergencyPhone) && (
        <ContactRow icon="bi-person-exclamation" label="ผู้ติดต่อฉุกเฉิน">
          {[emergencyName, emergencyPhone].filter(Boolean).join(' · ')}
        </ContactRow>
      )}
    </div>
  );
}

function PatientList({ patients, selectedId, onSelect }) {
  if (patients.length === 0) {
    return (
      <div className="empty-box py-4">
        <i className="bi bi-search" />
        ไม่พบสัตว์เลี้ยง
      </div>
    );
  }
  return (
    <div className="d-grid gap-2">
      {patients.map((p) => {
        const species = speciesOf(p.species);
        return (
          <button
            type="button"
            key={p.id}
            className={`btn text-start p-3 rounded-4 ${selectedId === p.id ? 'btn-sky' : 'btn-soft'}`}
            style={{ borderRadius: 20 }}
            onClick={() => onSelect(p.id)}
          >
            <div className="fw-medium">
              {species.emoji} {p.name}
              {p.allergies && <i className="bi bi-exclamation-triangle-fill ms-2 text-danger" title={`แพ้: ${p.allergies}`} />}
            </div>
            <div className="small opacity-75">
              {species.label}
              {p.breed ? ` · ${p.breed}` : ''} · {ageText(p.birthDate)}
            </div>
            <div className="small mt-1">
              {p.nextAppointment
                ? `นัดถัดไป ${formatDate(p.nextAppointment.date)} ${p.nextAppointment.time} น.`
                : p.lastVisit
                  ? `มาล่าสุด ${formatDate(p.lastVisit)}`
                  : 'ยังไม่เคยมาตรวจ'}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PatientDetail({ patient: p }) {
  const species = speciesOf(p.species);
  const vaccines = [...(p.vaccines ?? [])].sort(byDateDesc);
  const parasites = [...(p.parasites ?? [])].sort(byDateDesc);
  const treatments = [...(p.treatments ?? [])].sort(byDateDesc);

  return (
    <div className="card-soft">
      <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
        <PetPhoto pet={p} size="lg" />
        <div>
          <h2 className="mb-1">{p.name}</h2>
          <div className="text-muted mb-2">
            {species.emoji} {species.label}
            {p.breed ? ` · ${p.breed}` : ''}
          </div>
          <span className="tag sky">{ageText(p.birthDate)}</span>
          {p.sex !== 'unknown' && <span className="tag">{labelOf(SEX_OPTIONS, p.sex)}</span>}
          {p.weight && <span className="tag">{p.weight} กก.</span>}
          {p.neutered === 'yes' && <span className="tag ok">ทำหมันแล้ว</span>}
          {p.microchip && <span className="tag">ไมโครชิป {p.microchip}</span>}
        </div>
      </div>

      {p.allergies && (
        <div className="alert-soft danger mb-3">
          <i className="bi bi-exclamation-triangle" />
          <span>
            <strong>ประวัติการแพ้:</strong> {p.allergies}
          </span>
        </div>
      )}

      <Section icon="bi-heart-pulse" title="ข้อมูลสุขภาพ">
        <div className="d-grid gap-1">
          <Info k="การทำหมัน" v={labelOf(NEUTER_OPTIONS, p.neutered)} />
          <Info k="โรคประจำตัว" v={p.chronicDiseases} />
          <Info k="ยาที่ใช้ประจำ" v={p.medications} />
          <Info k="อาหารที่กิน" v={p.food} />
          <Info k="หมายเหตุ / นิสัย" v={p.notes} />
          <Info k="ไปตรวจแล้ว" v={`${p.visitCount} ครั้ง${p.lastVisit ? ` (ล่าสุด ${formatDate(p.lastVisit)})` : ''}`} />
        </div>
      </Section>

      <Section icon="bi-calendar-event" title={`นัดหมาย (${p.appointments.length})`}>
        {p.appointments.length === 0 ? (
          <Empty text="ยังไม่มีนัดหมาย" />
        ) : (
          <div className="d-grid gap-1">
            {p.appointments.slice(0, 8).map((a) => {
              const status = BOOKING_STATUS[a.status] ?? { label: a.status, tone: '' };
              return (
                <div key={a.id} className="d-flex flex-wrap align-items-center gap-2 small">
                  <span style={{ minWidth: 150 }}>
                    {formatDate(a.date)} {a.time} น.
                  </span>
                  <span>{a.serviceLabel}</span>
                  <span className={`tag ${status.tone}`}>{status.label}</span>
                  {a.date >= todayString() && a.status === 'confirmed' && <span className="tag sky">กำลังจะถึง</span>}
                </div>
              );
            })}
            {p.appointments.length > 8 && <Empty text={`และอีก ${p.appointments.length - 8} รายการ`} />}
          </div>
        )}
      </Section>

      <Section icon="bi-capsule" title={`วัคซีน (${vaccines.length})`}>
        {vaccines.length === 0 ? (
          <Empty text="ยังไม่มีประวัติวัคซีน" />
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0 small">
              <thead>
                <tr className="text-muted">
                  <th>วัคซีน</th>
                  <th>วันที่ฉีด</th>
                  <th>นัดครั้งถัดไป</th>
                  <th>สถานที่</th>
                </tr>
              </thead>
              <tbody>
                {vaccines.map((v) => (
                  <tr key={v.id}>
                    <td className="fw-medium">{v.name || '-'}</td>
                    <td>{formatDate(v.date)}</td>
                    <td><DueTag date={v.nextDate} /></td>
                    <td>{v.place || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section icon="bi-bug" title={`ถ่ายพยาธิ / เห็บหมัด (${parasites.length})`}>
        {parasites.length === 0 ? (
          <Empty text="ยังไม่มีประวัติ" />
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0 small">
              <thead>
                <tr className="text-muted">
                  <th>ประเภท</th>
                  <th>ผลิตภัณฑ์</th>
                  <th>วันที่</th>
                  <th>ครั้งถัดไป</th>
                </tr>
              </thead>
              <tbody>
                {parasites.map((r) => (
                  <tr key={r.id}>
                    <td className="fw-medium">{labelOf(PARASITE_TYPES, r.type)}</td>
                    <td>{r.product || '-'}</td>
                    <td>{formatDate(r.date)}</td>
                    <td><DueTag date={r.nextDate} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section icon="bi-journal-medical" title={`ประวัติการรักษา (${treatments.length})`}>
        {treatments.length === 0 ? (
          <Empty text="ยังไม่มีประวัติการรักษา" />
        ) : (
          <div className="timeline">
            {treatments.map((t) => (
              <div className="tl-item" key={t.id}>
                <div className="date">
                  {formatDate(t.date)}
                  {(t.vet || t.clinic) && ` · ${[t.vet, t.clinic].filter(Boolean).join(' · ')}`}
                </div>
                <div className="fw-medium">{t.diagnosis || t.symptoms || 'ไม่ระบุ'}</div>
                {t.symptoms && t.diagnosis && <div className="small text-muted">อาการ: {t.symptoms}</div>}
                {t.treatment && <div className="small">การรักษา: {t.treatment}</div>}
                {t.followUp && <div className="small mt-1">นัดติดตาม: <DueTag date={t.followUp} /></div>}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

export default function PatientsPage() {
  const [params, setParams] = useSearchParams();
  const petId = params.get('pet') ?? '';
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const { owners, loading, error, reload } = useOwners();
  const detail = usePatient(petId);

  // `?owner=` opens a customer; a link that only has `?pet=` opens that pet's owner too.
  const ownerId = params.get('owner') || detail.patient?.owner?.id || '';
  const owner = owners.find((o) => o.id === ownerId) ?? null;

  const q = query.trim().toLowerCase();
  const shown = owners.filter(
    (o) =>
      matches(o, filter) &&
      (!q ||
        [o.name, o.phone, o.email, ...o.pets.flatMap((p) => [p.name, p.breed, speciesOf(p.species).label])].some((v) =>
          v?.toLowerCase().includes(q),
        )),
  );

  const selectOwner = (id) => setParams({ owner: id });
  const selectPet = (id) => setParams({ owner: ownerId, pet: id });
  const backToCustomers = () => setParams({});

  return (
    <VetLayout>
      <div className="page-wrap">
        <div className="container">
          <div className="page-head">
            <div>
              <h1>ลูกค้า</h1>
              <p>เจ้าของที่ลงทะเบียนสัตว์เลี้ยงไว้ เลือกลูกค้าเพื่อดูสัตว์เลี้ยง ช่องทางติดต่อ และประวัติสุขภาพ</p>
            </div>
          </div>

          {error && (
            <div className="alert alert-danger d-flex align-items-center justify-content-between" role="alert">
              <span>{error}</span>
              <button type="button" className="btn btn-sm btn-outline-danger" onClick={reload}>ลองใหม่</button>
            </div>
          )}

          <div className="row g-4">
            <div className="col-lg-5">
              <div className="card-soft">
                {loading ? (
                  <div className="empty-box py-4">กำลังโหลดข้อมูล...</div>
                ) : owner ? (
                  <>
                    <button type="button" className="btn btn-soft btn-sm mb-3" onClick={backToCustomers}>
                      <i className="bi bi-arrow-left me-1" />
                      ลูกค้าทั้งหมด
                    </button>
                    <ContactCard owner={owner} />
                    <div className="section-label">
                      <i className="bi bi-heart" />
                      สัตว์เลี้ยง ({owner.pets.length})
                    </div>
                    <PatientList patients={owner.pets} selectedId={petId} onSelect={selectPet} />
                  </>
                ) : (
                  <>
                    <div className="input-group mb-3">
                      <span className="input-group-text"><i className="bi bi-search" /></span>
                      <input
                        className="form-control"
                        placeholder="ค้นหาชื่อลูกค้า / เบอร์โทร / ชื่อสัตว์เลี้ยง"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                    <div className="d-flex flex-wrap gap-2 mb-3">
                      {FILTERS.map((f) => (
                        <button
                          type="button"
                          key={f.value}
                          className={`btn btn-sm ${filter === f.value ? 'btn-sky' : 'btn-soft'}`}
                          onClick={() => setFilter(f.value)}
                        >
                          {f.label} ({owners.filter((o) => matches(o, f.value)).length})
                        </button>
                      ))}
                    </div>
                    <OwnerList owners={shown} onSelect={selectOwner} />
                  </>
                )}
              </div>
            </div>

            <div className="col-lg-7">
              {!petId ? (
                <div className="card-soft empty-box">
                  <i className="bi bi-hand-index" />
                  {owner ? 'เลือกสัตว์เลี้ยงเพื่อดูประวัติสุขภาพ' : 'เลือกลูกค้าจากรายการเพื่อดูสัตว์เลี้ยงและช่องทางติดต่อ'}
                </div>
              ) : detail.loading ? (
                <div className="card-soft empty-box">กำลังโหลดข้อมูล...</div>
              ) : detail.error ? (
                <div className="card-soft empty-box">
                  <i className="bi bi-question-circle" />
                  {detail.error}
                </div>
              ) : (
                detail.patient && <PatientDetail patient={detail.patient} />
              )}
            </div>
          </div>
        </div>
      </div>
    </VetLayout>
  );
}
