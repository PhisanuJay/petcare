import { useEffect, useState } from 'react';
import { formatDate, speciesOf } from '../../pet-owner/petUtils.js';
import { REJECT_REASONS } from '../data/constants.js';

function RejectBookingModalInner({ booking, onClose, onConfirm }) {
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const needNote = reason === 'อื่นๆ';

  function handleSubmit(e) {
    e.preventDefault();
    if (needNote && !note.trim()) {
      setNoteError('กรุณาระบุเหตุผลเพิ่มเติม');
      return;
    }
    onConfirm({ reason, note: note.trim() });
  }

  const sp = speciesOf(booking.species);

  return (
    <>
      <div className="modal d-block ma-modal" tabIndex={-1} role="dialog" aria-modal="true" onClick={onClose}>
        <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content ma-modal-card">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <div className="section-label mb-0">
                <i className="bi bi-x-circle" />
                ปฏิเสธคำขอจอง
              </div>
              <button type="button" className="btn-close" aria-label="ปิด" onClick={onClose} />
            </div>

            <p className="small text-muted mb-3">
              {sp.emoji} <strong>{booking.petName}</strong> · {booking.ownerName} ·{' '}
              {formatDate(booking.date)} เวลา {booking.time} น.
            </p>

            <form onSubmit={handleSubmit} noValidate>
              <div className="mb-3">
                <div className="form-label">เลือกเหตุผลในการปฏิเสธ</div>
                <div className="d-grid gap-2">
                  {REJECT_REASONS.map((item) => (
                    <label
                      key={item}
                      className={`ma-reason-option${reason === item ? ' selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="reject-reason"
                        className="form-check-input mt-0"
                        checked={reason === item}
                        onChange={() => {
                          setReason(item);
                          setNoteError('');
                        }}
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label" htmlFor="reject-note">
                  หมายเหตุเพิ่มเติม {needNote && <span className="text-danger">*</span>}
                </label>
                <textarea
                  id="reject-note"
                  rows={2}
                  className={`form-control${noteError ? ' is-invalid' : ''}`}
                  placeholder={needNote ? 'ระบุรายละเอียดเหตุผล' : 'รายละเอียดเพิ่มเติมถึงลูกค้า (ถ้ามี)'}
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    if (noteError) setNoteError('');
                  }}
                />
                {noteError && <div className="invalid-feedback">{noteError}</div>}
              </div>

              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-soft" onClick={onClose}>
                  ยกเลิก
                </button>
                <button type="submit" className="btn btn-soft-danger">
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

export default function RejectBookingModal({ open, booking, onClose, onConfirm }) {
  if (!open || !booking) return null;
  return (
    <RejectBookingModalInner
      key={booking.id}
      booking={booking}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
