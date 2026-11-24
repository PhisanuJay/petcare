import { useEffect } from 'react';

export default function ConfirmModal({
  open,
  title,
  message,
  icon = 'bi-exclamation-triangle',
  confirmLabel = 'ยืนยัน',
  cancelLabel = 'ปิด',
  confirmVariant = 'danger',
  submitting = false,
  error = '',
  children = null,
  onClose,
  onConfirm,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const confirmClass = confirmVariant === 'danger' ? 'btn btn-soft-danger' : 'btn btn-sky';

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
                <i className={`bi ${icon}`} />
                {title}
              </div>
              <button
                type="button"
                className="btn-close"
                aria-label="ปิด"
                disabled={submitting}
                onClick={onClose}
              />
            </div>

            {error && (
              <div className="alert-soft danger mb-3" role="alert">
                <i className="bi bi-exclamation-circle" />
                <span>{error}</span>
              </div>
            )}

            <p className="text-muted mb-3">{message}</p>
            {children && <div className="mb-3">{children}</div>}

            <div className="d-flex justify-content-end gap-2 mt-2">
              <button type="button" className="btn btn-soft" disabled={submitting} onClick={onClose}>
                {cancelLabel}
              </button>
              <button type="button" className={confirmClass} disabled={submitting} onClick={onConfirm}>
                {submitting && (
                  <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
                )}
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
