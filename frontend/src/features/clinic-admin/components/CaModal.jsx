import { useEffect, useId } from 'react';

export default function CaModal({
  open,
  title,
  icon = 'bi-window',
  submitting = false,
  error = '',
  onClose,
  children,
  footer = null,
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, submitting, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="modal d-block ca-modal"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={() => !submitting && onClose()}
      >
        <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content ca-modal-card">
            <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
              <div id={titleId} className="section-label mb-0">
                <i className={`bi ${icon}`} aria-hidden="true" />
                <span>{title}</span>
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
                <i className="bi bi-exclamation-circle" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div>{children}</div>

            {footer && <div className="d-flex justify-content-end gap-2 mt-3">{footer}</div>}
          </div>
        </div>
      </div>
      <div className="modal-backdrop show ca-modal-backdrop" />
    </>
  );
}
