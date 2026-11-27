import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import VetLayout from '../components/VetLayout.jsx';
import VetPageHeader from '../components/VetPageHeader.jsx';
import { useOwners, usePatient } from '../usePatients.js';
import { BOOKING_STATUS } from '../../pet-owner/bookingOptions.js';
import { ageText, formatDate, labelOf, speciesOf, PARASITE_TYPES } from '../../pet-owner/petUtils.js';

/**
 * Medical Records — view-only history for the veterinarian.
 * การกรอกบันทึกใหม่ทำจากหน้านัดหมาย ไม่กรอกที่นี่
 */

const byDateDesc = (a, b) => (b.date || '').localeCompare(a.date || '');

/** Newest registered pet first (then most recently updated). */
function petNewestKey(pet) {
  return pet.createdAt || pet.updatedAt || '';
}

function ownerNewestKey(owner) {
  const pets = owner.pets ?? [];
  return pets.reduce((latest, pet) => {
    const key = petNewestKey(pet);
    return key > latest ? key : latest;
  }, owner.lastVisit || '');
}

function buildHistory(patient) {
  return [
    ...(patient.treatments ?? []).map((row) => ({ kind: 'treatment', row })),
    ...(patient.parasites ?? []).map((row) => ({ kind: 'parasite', row })),
    ...(patient.appointments ?? []).map((row) => ({ kind: 'appointment', row })),
  ].sort((a, b) => {
    const byDate = byDateDesc(a.row, b.row);
    if (byDate) return byDate;
    const aTime = a.row.time || a.row.createdAt || '';
    const bTime = b.row.time || b.row.createdAt || '';
    return String(bTime).localeCompare(String(aTime));
  });
}

function kindMeta(kind) {
  if (kind === 'parasite') return { icon: 'bi-bug', label: 'ถ่ายพยาธิ / เห็บหมัด', title: 'รายละเอียดการให้ยา' };
  if (kind === 'appointment') return { icon: 'bi-calendar2-check', label: 'นัดหมายคลินิก', title: 'รายละเอียดนัดหมาย' };
  return { icon: 'bi-journal-medical', label: 'ตรวจ / รักษา', title: 'รายละเอียดการรักษา' };
}

function DetailRow({ label, value }) {
  const text = typeof value === 'string' ? value.trim() : value;
  return (
    <div className="vet-record-detail__row">
      <dt>{label}</dt>
      <dd>{text ? text : '—'}</dd>
    </div>
  );
}

function RecordDetailModal({ item, onClose }) {
  useEffect(() => {
    if (!item) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [item, onClose]);

  if (!item) return null;
  const { kind, row: t } = item;
  const meta = kindMeta(kind);
  const bookingStatus = BOOKING_STATUS[t.status] ?? { label: t.status || '', tone: '' };

  return (
    <>
      <div
        className="modal d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vet-record-detail-title"
        onClick={onClose}
        style={{ zIndex: 1055 }}
      >
        <div className="modal-dialog modal-dialog-centered modal-lg" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content card-soft border-0 shadow">
            <div className="d-flex justify-content-between align-items-start gap-2 mb-3 pb-2 border-bottom">
              <div>
                <div id="vet-record-detail-title" className="section-label mb-1">
                  <i className={`bi ${meta.icon}`} aria-hidden="true" />
                  {meta.title}
                </div>
                <div className="small text-muted">
                  {formatDate(t.date)}
                  {t.time ? ` · ${t.time} น.` : ''}
                </div>
              </div>
              <button type="button" className="btn-close" aria-label="ปิด" onClick={onClose} />
            </div>

            <dl className="vet-record-detail">
              {kind === 'treatment' ? (
                <>
                  <DetailRow label="วันที่ตรวจ" value={formatDate(t.date)} />
                  <DetailRow label="สัตวแพทย์" value={t.vet} />
                  <DetailRow label="คลินิก / โรงพยาบาล" value={t.clinic} />
                  <DetailRow label="อาการ" value={t.symptoms} />
                  <DetailRow label="ผลการวินิจฉัย" value={t.diagnosis} />
                  <DetailRow label="การรักษา / ยาที่ได้รับ" value={t.treatment} />
                  <DetailRow label="นัดติดตามอาการ" value={t.followUp ? formatDate(t.followUp) : ''} />
                </>
              ) : kind === 'parasite' ? (
                <>
                  <DetailRow label="วันที่ให้ยา" value={formatDate(t.date)} />
                  <DetailRow label="ประเภท" value={labelOf(PARASITE_TYPES, t.type)} />
                  <DetailRow label="ชื่อยา / ผลิตภัณฑ์" value={t.product} />
                  <DetailRow label="สัตวแพทย์" value={t.vet} />
                  <DetailRow label="สถานที่" value={t.place} />
                </>
              ) : (
                <>
                  <DetailRow label="วันเวลานัด" value={`${formatDate(t.date)}${t.time ? ` · ${t.time} น.` : ''}`} />
                  <DetailRow label="บริการ" value={t.serviceLabel || t.service} />
                  <DetailRow label="สถานะ" value={bookingStatus.label} />
                  <DetailRow label="สัตวแพทย์" value={t.vetName} />
                  <DetailRow label="หมายเหตุเจ้าของ" value={t.note} />
                  <DetailRow label="หมายเหตุคลินิก" value={t.clinicNote} />
                </>
              )}
              {kind !== 'appointment' && (
                <DetailRow
                  label="แหล่งบันทึก"
                  value={t.source === 'vet' ? 'บันทึกโดยคลินิก' : 'บันทึกโดยเจ้าของ'}
                />
              )}
            </dl>

            <div className="d-flex justify-content-end mt-3 pt-2 border-top">
              <button type="button" className="btn btn-soft" onClick={onClose}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" style={{ zIndex: 1050 }} />
    </>
  );
}

function HistoryList({ history }) {
  const [selected, setSelected] = useState(null);

  if (history.length === 0) {
    return (
      <div className="empty-box py-3">
        <i className="bi bi-journal-medical" />
        ยังไม่มีประวัติ — บันทึกการรักษาจากหน้านัดหมายหลังตรวจเสร็จ
      </div>
    );
  }

  return (
    <>
      <div className="timeline">
        {history.map((item) => {
          const { kind, row: t } = item;
          const meta = kindMeta(kind);
          const bookingStatus = BOOKING_STATUS[t.status] ?? { label: t.status || '', tone: '' };
          return (
            <button
              type="button"
              className="tl-item tl-item--button text-start w-100"
              key={`${kind}-${t.id}`}
              onClick={() => setSelected(item)}
            >
              <div className="date d-flex flex-wrap align-items-center gap-2">
                <span>
                  {formatDate(t.date)}
                  {t.time ? ` · ${t.time} น.` : ''}
                  {kind === 'treatment' && (t.vet || t.clinic) && ` · ${[t.vet, t.clinic].filter(Boolean).join(' · ')}`}
                  {kind === 'parasite' && (t.vet || t.place) && ` · ${[t.vet, t.place].filter(Boolean).join(' · ')}`}
                </span>
                <span className="tag">
                  <i className={`bi ${meta.icon} me-1`} />
                  {meta.label}
                </span>
                {kind === 'appointment' ? (
                  <span className={`tag ${bookingStatus.tone}`}>{bookingStatus.label}</span>
                ) : t.source === 'vet' ? (
                  <span className="tag ok">บันทึกโดยคลินิก</span>
                ) : (
                  <span className="tag">บันทึกโดยเจ้าของ</span>
                )}
              </div>

              {kind === 'treatment' ? (
                <>
                  <div className="fw-medium">{t.diagnosis || t.symptoms || 'ไม่ระบุ'}</div>
                  {t.symptoms && t.diagnosis && <div className="small text-muted">อาการ: {t.symptoms}</div>}
                  {t.treatment && <div className="small">การรักษา: {t.treatment}</div>}
                </>
              ) : kind === 'parasite' ? (
                <div className="fw-medium">
                  {labelOf(PARASITE_TYPES, t.type)}
                  {t.product && <span className="fw-normal text-muted"> · {t.product}</span>}
                </div>
              ) : (
                <div className="fw-medium">{t.serviceLabel || t.service || 'นัดหมายคลินิก'}</div>
              )}

              <div className="small text-sky mt-2">
                <i className="bi bi-eye me-1" aria-hidden="true" />
                กดเพื่อดูรายละเอียดทั้งหมด
              </div>
            </button>
          );
        })}
      </div>
      <RecordDetailModal item={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function PatientPicker({ owners, loading, onSelect, onlyOwnerId = '', onShowAll }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = owners
    .filter((o) => !onlyOwnerId || o.id === onlyOwnerId)
    .map((o) => ({
      ...o,
      pets: o.pets
        .filter((p) => p.visited)
        .slice()
        .sort((a, b) => petNewestKey(b).localeCompare(petNewestKey(a))),
    }))
    .filter((o) => o.pets.length > 0)
    .sort((a, b) => ownerNewestKey(b).localeCompare(ownerNewestKey(a)))
    .filter(
      (o) =>
        !q ||
        [o.name, o.phone, ...o.pets.flatMap((p) => [p.name, p.breed, speciesOf(p.species).label])].some((v) =>
          v?.toLowerCase().includes(q),
        ),
    );
  return (
    <div className="card-soft">
      {onlyOwnerId && (
        <button type="button" className="btn btn-soft btn-sm mb-3" onClick={onShowAll}>
          <i className="bi bi-arrow-left me-1" />
          ลูกค้าทั้งหมด
        </button>
      )}
      <div className="section-label">
        <i className="bi bi-search" />
        เลือกลูกค้าและสัตว์เลี้ยงเพื่อดูประวัติ
      </div>
      <input
        className="form-control mb-3"
        placeholder="ค้นหาชื่อลูกค้า / เบอร์โทร / ชื่อสัตว์เลี้ยง"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {loading ? (
        <div className="empty-box py-3">กำลังโหลดข้อมูล...</div>
      ) : shown.length === 0 ? (
        <div className="empty-box py-3">ไม่พบลูกค้าที่มีสัตว์เลี้ยงมารักษา</div>
      ) : (
        <div className="d-grid gap-3">
          {shown.map((o) => (
            <div key={o.id}>
              <div className="fw-medium mb-1">
                <i className="bi bi-person-circle me-1" />
                {o.name || 'ไม่ทราบชื่อลูกค้า'}
              </div>
              <div className="d-grid gap-2">
                {o.pets.map((p) => {
                  const species = speciesOf(p.species);
                  return (
                    <button type="button" key={p.id} className="vet-person" onClick={() => onSelect(p.id)}>
                      <span className="person-avatar pet" aria-hidden="true">{species.emoji}</span>
                      <span className="person-body">
                        <span className="fw-medium d-block">{p.name}</span>
                        <span className="small text-muted d-block">
                          {species.label}
                          {p.breed ? ` · ${p.breed}` : ''} · {ageText(p.birthDate)}
                        </span>
                        <span className="small text-muted d-block">
                          {p.lastVisit
                            ? `มารักษาล่าสุด ${formatDate(p.lastVisit)}`
                            : p.nextAppointment?.date
                              ? `มีนัด ${formatDate(p.nextAppointment.date)}`
                              : 'ยังไม่มีบันทึกการรักษา'}
                        </span>
                      </span>
                      <i className="bi bi-chevron-right person-go" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MedicalRecordsPage() {
  const [params, setParams] = useSearchParams();
  const petId = params.get('pet') ?? '';
  const { owners, loading: listLoading, error: listError } = useOwners();
  const detail = usePatient(petId);

  const patient = detail.patient;
  const history = patient ? buildHistory(patient) : [];

  const choose = (id) => {
    setParams({ pet: id });
  };

  return (
    <VetLayout>
      <div className="page-wrap">
        <div className="container">
          <VetPageHeader
            icon="bi-journal-medical"
            title="ประวัติการรักษา"
            subtitle="ดูประวัติการตรวจ การรักษา และการให้ยา — การบันทึกใหม่ทำจากหน้านัดหมาย"
          >
            {petId ? (
              <button
                type="button"
                className="btn btn-soft"
                onClick={() => setParams(patient?.owner?.id ? { owner: patient.owner.id } : {})}
              >
                <i className="bi bi-arrow-left me-1" />
                กลับ
              </button>
            ) : null}
          </VetPageHeader>

          {listError && <div className="alert alert-danger">{listError}</div>}

          {!petId ? (
            <PatientPicker
              owners={owners}
              loading={listLoading}
              onSelect={choose}
              onlyOwnerId={params.get('owner') ?? ''}
              onShowAll={() => setParams({})}
            />
          ) : detail.loading ? (
            <div className="card-soft empty-box">กำลังโหลดข้อมูล...</div>
          ) : detail.error ? (
            <div className="card-soft empty-box">
              <i className="bi bi-question-circle" />
              {detail.error}
            </div>
          ) : (
            patient && (
              <>
                <div className="vet-ownerline mb-3">
                  <i className="bi bi-person-circle" />
                  <span>
                    <strong>เจ้าของ:</strong> {patient.owner?.name || 'ไม่ทราบชื่อลูกค้า'}
                    {patient.owner?.phone && <span className="text-muted"> · {patient.owner.phone}</span>}
                  </span>
                </div>
                {patient.allergies && (
                  <div className="alert-soft danger mb-3">
                    <i className="bi bi-exclamation-triangle" />
                    <span>
                      <strong>ประวัติการแพ้ของ {patient.name}:</strong> {patient.allergies}
                    </span>
                  </div>
                )}

                <div className="card-soft">
                  <div className="section-label">
                    <i className="bi bi-journal-medical" />
                    ประวัติของ {patient.name} ({history.length})
                  </div>
                  <HistoryList history={history} />
                </div>
              </>
            )
          )}
        </div>
      </div>
    </VetLayout>
  );
}
