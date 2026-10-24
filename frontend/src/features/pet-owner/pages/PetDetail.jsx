import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePets } from '../usePets.js';
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
} from '../petUtils.js';
import PetPhoto from '../components/PetPhoto.jsx';

function Info({ k, v }) {
  return (
    <div className="info-item">
      <div className="k">{k}</div>
      <div className="v">{v || '-'}</div>
    </div>
  );
}

function SectionCard({ icon, title, editTab, petId, children }) {
  return (
    <div className="card-soft mb-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="section-label mb-0">
          <i className={`bi ${icon}`} />
          {title}
        </div>
        {editTab && (
          <Link to={`/pet-owner/my-pets/${petId}/edit`} className="small text-decoration-none">
            <i className="bi bi-pencil-square me-1" />
            แก้ไข
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function Empty({ icon, text }) {
  return (
    <div className="empty-box py-3">
      <i className={`bi ${icon}`} />
      {text}
    </div>
  );
}

function dueTag(date) {
  if (!date) return null;
  const [r] = careReminders([{ vaccines: [{ nextDate: date }] }]);
  const cls = r.status === 'overdue' ? 'danger' : r.status === 'soon' ? 'warn' : 'sky';
  return (
    <span className={`tag ${cls}`}>
      {formatDate(date)} · {reminderText(r)}
    </span>
  );
}

const byDateDesc = (a, b) => (b.date || '').localeCompare(a.date || '');

export default function PetDetailPage() {
  const { petId } = useParams();
  const { getPet, deletePet } = usePets();
  const navigate = useNavigate();
  const pet = getPet(petId);

  if (!pet) {
    return (
      <div className="page-wrap">
        <div className="container">
          <div className="card-soft empty-box">
            <i className="bi bi-question-circle" />
            ไม่พบข้อมูลสัตว์เลี้ยงนี้
            <div className="mt-3">
              <Link to="/pet-owner/my-pets" className="btn btn-sky">กลับไปหน้าสัตว์เลี้ยง</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const reminders = careReminders([pet]).filter((r) => r.status !== 'later');
  const vaccines = [...(pet.vaccines ?? [])].sort(byDateDesc);
  const parasites = [...(pet.parasites ?? [])].sort(byDateDesc);
  const treatments = [...(pet.treatments ?? [])].sort(byDateDesc);

  function handleDelete() {
    if (window.confirm(`ลบข้อมูล "${pet.name}" และประวัติทั้งหมด? การลบไม่สามารถย้อนกลับได้`)) {
      deletePet(pet.id);
      navigate('/pet-owner/my-pets');
    }
  }

  return (
    <div className="page-wrap">
      <div className="container">
        <Link to="/pet-owner/my-pets" className="small text-decoration-none">
          <i className="bi bi-arrow-left me-1" />
          สัตว์เลี้ยงของฉัน
        </Link>

        <div className="card-soft mt-2 mb-4">
          <div className="d-flex flex-wrap align-items-center gap-4">
            <PetPhoto pet={pet} size="lg" />
            <div className="flex-grow-1">
              <h1 className="mb-1">{pet.name}</h1>
              <div className="text-muted mb-2">
                {speciesOf(pet.species).emoji} {speciesOf(pet.species).label}
                {pet.breed ? ` · ${pet.breed}` : ''}
              </div>
              <span className="tag sky">{ageText(pet.birthDate)}</span>
              {pet.sex !== 'unknown' && <span className="tag">{labelOf(SEX_OPTIONS, pet.sex)}</span>}
              {pet.weight && <span className="tag">{pet.weight} กก.</span>}
              {pet.neutered === 'yes' && <span className="tag ok">ทำหมันแล้ว</span>}
              {pet.microchip && <span className="tag">ไมโครชิป</span>}
              {pet.allergies && <span className="tag danger">มีประวัติแพ้</span>}
            </div>
            <div className="d-flex gap-2">
              <Link to={`/pet-owner/my-pets/${pet.id}/edit`} className="btn btn-sky">
                <i className="bi bi-pencil-square me-1" />
                แก้ไข / เพิ่มประวัติ
              </Link>
              <button type="button" className="btn btn-soft-danger" onClick={handleDelete} title="ลบสัตว์เลี้ยง">
                <i className="bi bi-trash3" />
              </button>
            </div>
          </div>

          {reminders.length > 0 && (
            <div className="mt-4 d-grid gap-2">
              {reminders.map((r) => (
                <div key={`${r.title}-${r.date}`} className={`alert-soft ${r.status === 'overdue' ? 'danger' : 'warn'}`}>
                  <i className={`bi ${r.status === 'overdue' ? 'bi-exclamation-triangle' : 'bi-bell'}`} />
                  <span>
                    <strong>{r.title}</strong> · {formatDate(r.date)} ({reminderText(r)})
                  </span>
                  <Link to="/pet-owner/booking" className="btn btn-sm btn-soft ms-auto">จองนัด</Link>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="row g-4">
          <div className="col-lg-7">
            <SectionCard icon="bi-info-circle" title="ข้อมูลทั่วไป" editTab petId={pet.id}>
              <div className="info-grid">
                <Info k="วันเกิด" v={formatDate(pet.birthDate)} />
                <Info k="อายุ" v={ageText(pet.birthDate)} />
                <Info k="เพศ" v={labelOf(SEX_OPTIONS, pet.sex)} />
                <Info k="การทำหมัน" v={labelOf(NEUTER_OPTIONS, pet.neutered)} />
                <Info k="น้ำหนัก" v={pet.weight ? `${pet.weight} กก.` : ''} />
                <Info k="สี / ลักษณะเด่น" v={pet.color} />
                <Info k="ไมโครชิป" v={pet.microchip} />
                <Info k="อัปเดตล่าสุด" v={formatDate(pet.updatedAt)} />
              </div>
            </SectionCard>

            <SectionCard icon="bi-capsule" title={`วัคซีน (${vaccines.length})`} editTab petId={pet.id}>
              {vaccines.length ? (
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr className="small text-muted">
                        <th>วัคซีน</th>
                        <th>วันที่ฉีด</th>
                        <th>นัดครั้งถัดไป</th>
                        <th>สถานที่</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vaccines.map((v) => (
                        <tr key={v.id}>
                          <td className="fw-medium">
                            {v.name || '-'}
                            {v.lot && <div className="small text-muted">{v.lot}</div>}
                          </td>
                          <td>{formatDate(v.date)}</td>
                          <td>{dueTag(v.nextDate) ?? '-'}</td>
                          <td className="small">{v.place || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty icon="bi-capsule" text="ยังไม่มีประวัติวัคซีน" />
              )}
            </SectionCard>

            <SectionCard icon="bi-bug" title={`ถ่ายพยาธิ / เห็บหมัด (${parasites.length})`} editTab petId={pet.id}>
              {parasites.length ? (
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr className="small text-muted">
                        <th>ประเภท</th>
                        <th>ผลิตภัณฑ์</th>
                        <th>วันที่</th>
                        <th>ครั้งถัดไป</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parasites.map((p) => (
                        <tr key={p.id}>
                          <td className="fw-medium">{labelOf(PARASITE_TYPES, p.type)}</td>
                          <td>{p.product || '-'}</td>
                          <td>{formatDate(p.date)}</td>
                          <td>{dueTag(p.nextDate) ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty icon="bi-bug" text="ยังไม่มีประวัติ" />
              )}
            </SectionCard>
          </div>

          <div className="col-lg-5">
            <SectionCard icon="bi-heart-pulse" title="ข้อมูลสุขภาพ" editTab petId={pet.id}>
              <div className="d-grid gap-2">
                <Info k="แพ้ยา / แพ้อาหาร" v={pet.allergies} />
                <Info k="โรคประจำตัว" v={pet.chronicDiseases} />
                <Info k="ยาที่ใช้ประจำ" v={pet.medications} />
                <Info k="อาหารที่กิน" v={pet.food} />
                <Info k="หมายเหตุ / นิสัย" v={pet.notes} />
              </div>
            </SectionCard>

            <SectionCard icon="bi-journal-medical" title={`ประวัติการรักษา (${treatments.length})`} editTab petId={pet.id}>
              {treatments.length ? (
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
                      {t.followUp && <div className="small mt-1">{dueTag(t.followUp)}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <Empty icon="bi-journal-medical" text="ยังไม่มีประวัติการรักษา" />
              )}
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
