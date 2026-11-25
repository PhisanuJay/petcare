import { useEffect, useMemo, useState } from 'react';
import { formatDate, speciesOf } from '../../pet-owner/petUtils.js';
import { FALLBACK_REJECT_REASONS } from '../data/constants.js';

function RejectBookingModalInner({ booking, meta, onClose, onReject }) {
  const reasons = useMemo(
    () => (meta?.REJECT_REASONS?.length ? meta.REJECT_REASONS : FALLBACK_REJECT_REASONS),
    [meta],
  );
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [submitting, onClose]);

  const needNote = reason === 'อื่นๆ';

  async function handleSubmit(e) {
    e.preventDefault();
    if (!reason) return;
    if (needNote && !note.trim()) {
      setNoteError('กรุณาระบุรายละเอียดเพิ่มเติมเมื่อเลือก "อื่นๆ"');
      return;
    }
    setSubmitting(true);
    setApiError('');
    try {
      await onReject({ reason, note: note.trim() });
    } catch (err) {
      setApiError(err?.message || 'ไม่สามารถปฏิเสธคำขอได้');
    } finally {
      setSubmitting(false);
    }
  }

  const sp = speciesOf(booking.petSpecies);

  return (
    <>
      <div
        className="modal d-block ma-modal"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        onClick={() => !submitting && onClose()}
      >
        <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content ma-modal-card">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <div className="section-label mb-0">
                <i className="bi bi-x-circle" />
                ปฏิเสธคำขอจอง
              </div>
              <button
                type="button"
                className="btn-close"
                aria-label="ปิด"
                disabled={submitting}
                onClick={onClose}
              />
            </div>

            <p className="small text-muted mb-3">
              {sp.emoji} <strong>{booking.petName}</strong> · {booking.ownerName || '—'} ·{' '}
              {formatDate(booking.date)} เวลา {booking.time} น.
            </p>

            <div className="alert-soft info mb-3">
              <i className="bi bi-info-circle" />
              <span>เจ้าของสัตว์เลี้ยงจะเห็นเหตุผลและหมายเหตุนี้ในหน้ารายการนัดหมาย</span>
            </div>

            {apiError && (
              <div className="alert-soft danger mb-3" role="alert">
                <i className="bi bi-exclamation-circle" />
                <span>{apiError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="mb-3">
                <div className="form-label">
                  เลือกเหตุผลในการปฏิเสธ <span className="text-danger">*</span>
                </div>
                <div className="d-grid gap-2">
                  {reasons.map((item) => (
                    <label
                      key={item}
                      className={`ma-reason-option${reason === item ? ' selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="reject-reason"
                        className="form-check-input mt-0"
                        disabled={submitting}
                        checked={reason === item}
                        onChange={() => {
                          setReason(item);
                          setNoteError('');
                          setApiError('');
                        }}
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
                {!reason && <div className="small text-muted mt-2">กรุณาเลือกเหตุผล</div>}
              </div>

              <div className="mb-4">
                <label className="form-label" htmlFor="reject-note">
                  หมายเหตุเพิ่มเติมถึงเจ้าของ {needNote && <span className="text-danger">*</span>}
                </label>
                <textarea
                  id="reject-note"
                  rows={2}
                  maxLength={500}
                  disabled={submitting}
                  className={`form-control${noteError ? ' is-invalid' : ''}`}
                  placeholder={needNote ? 'ระบุรายละเอียดเหตุผล' : 'รายละเอียดเพิ่มเติมถึงลูกค้า (ถ้ามี)'}
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    if (noteError) setNoteError('');
                    if (apiError) setApiError('');
                  }}
                />
                {noteError && <div className="invalid-feedback">{noteError}</div>}
              </div>

              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-soft" disabled={submitting} onClick={onClose}>
                  ยกเลิก
                </button>
                <button type="submit" className="btn btn-soft-danger" disabled={submitting || !reason}>
                  {submitting && (
                    <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
                  )}
                  <i className="bi bi-x-lg me-1" />
                  ยืนยันการปฏิเสธ
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show ma-modal-backdrop" />
    </>
  );
}

export default function RejectBookingModal({ open, booking, meta, onClose, onReject }) {
  if (!open || !booking) return null;
  return (
    <RejectBookingModalInner
      key={`reject-${booking.id}`}
      booking={booking}
      meta={meta}
      onClose={onClose}
      onReject={onReject}
    />
  );
}
