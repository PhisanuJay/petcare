import { useEffect } from 'react';

export default function ConfirmModal({
  open,
  title,
  message,
  icon = 'bi-exclamation-triangle',
  confirmLabel = 'ยืนยัน',
  cancelLabel = 'ปิด',
  confirmVariant = 'danger',
  onClose,
  onConfirm,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const confirmClass = confirmVariant === 'danger' ? 'btn btn-soft-danger' : 'btn btn-sky';

  return (
    <>
      <div className="modal d-block ma-modal" tabIndex={-1} role="dialog" aria-modal="true" onClick={onClose}>
        <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content ma-modal-card">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <div className="section-label mb-0">
                <i className={`bi ${icon}`} />
                {title}
              </div>
              <button type="button" className="btn-close" aria-label="ปิด" onClick={onClose} />
            </div>
            <p className="text-muted mb-4">{message}</p>
            <div className="d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-soft" onClick={onClose}>
                {cancelLabel}
              </button>
              <button type="button" className={confirmClass} onClick={onConfirm}>
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show ma-modal-backdrop" />
    </>
  );
}
