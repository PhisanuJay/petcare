import { useEffect } from 'react';
import { ParasiteForm, TreatmentForm } from './RecordForms.jsx';

function isParasiteService(service) {
  return ['parasite', 'deworming', 'flea_prevention'].includes(service);
}

/**
 * บันทึกการรักษา/ให้ยาจากหน้านัดหมาย — ไม่พาไปหน้าประวัติ
 */
export default function RecordVisitModal({ appointment, onClose, onSaved }) {
  useEffect(() => {
    if (!appointment) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [appointment, onClose]);

  if (!appointment?.pet) return null;

  const parasite = isParasiteService(appointment.service);
  const Form = parasite ? ParasiteForm : TreatmentForm;
  const title = parasite ? 'บันทึกการให้ยา' : 'บันทึกการรักษา';

  return (
    <>
      <div
        className="modal d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vet-record-visit-title"
        onClick={onClose}
        style={{ zIndex: 1055 }}
      >
        <div className="modal-dialog modal-dialog-centered modal-lg" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content card-soft border-0 shadow">
            <div className="d-flex justify-content-between align-items-start gap-2 mb-3 pb-2 border-bottom">
              <div>
                <div id="vet-record-visit-title" className="section-label mb-1">
                  <i className={`bi ${parasite ? 'bi-bug' : 'bi-journal-plus'}`} aria-hidden="true" />
                  {title}
                </div>
                <div className="small text-muted">
                  {appointment.pet.name}
                  {appointment.time ? ` · นัด ${appointment.time} น.` : ''}
                  {appointment.serviceLabel ? ` · ${appointment.serviceLabel}` : ''}
                </div>
              </div>
              <button type="button" className="btn-close" aria-label="ปิด" onClick={onClose} />
            </div>

            <Form
              key={`${appointment.id}-${appointment.pet.id}`}
              patient={appointment.pet}
              onSaved={onSaved}
              onCancel={onClose}
            />
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" style={{ zIndex: 1050 }} />
    </>
  );
}
