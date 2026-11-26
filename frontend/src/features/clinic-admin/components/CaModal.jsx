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
  size = '',
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

  const dialogClass = [
    'modal-dialog',
    'modal-dialog-centered',
    size === 'sm' ? 'modal-sm' : '',
    size === 'lg' ? 'modal-lg' : '',
  ].filter(Boolean).join(' ');

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
        <div className={dialogClass} onClick={(e) => e.stopPropagation()}>
          <div className="modal-content ca-modal-card">
            <div className="ca-modal-card__head">
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

            <div className="ca-modal-card__body">{children}</div>

            {footer ? <div className="ca-modal-card__footer">{footer}</div> : null}
          </div>
        </div>
      </div>
      <div className="modal-backdrop show ca-modal-backdrop" />
    </>
  );
}
