import CaModal from './CaModal.jsx';

export default function ConfirmDialog({
  open,
  title,
  message,
  detailTitle = '',
  detailLines = [],
  icon = 'bi-exclamation-triangle',
  confirmLabel = 'ยืนยัน',
  cancelLabel = 'ยกเลิก',
  confirmVariant = 'danger',
  submitting = false,
  error = '',
  children = null,
  onClose,
  onConfirm,
}) {
  const confirmClass = confirmVariant === 'danger' ? 'btn btn-soft-danger' : 'btn btn-sky';
  const lines = Array.isArray(detailLines) ? detailLines.filter(Boolean) : [];
  const hasDetail = Boolean(detailTitle || lines.length);

  return (
    <CaModal
      open={open}
      title={title}
      icon={icon}
      submitting={submitting}
      error={error}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-soft" disabled={submitting} onClick={onClose}>
            {cancelLabel}
          </button>
          <button type="button" className={confirmClass} disabled={submitting} onClick={onConfirm}>
            {submitting && (
              <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
            )}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="ca-confirm">
        {message ? <p className="ca-confirm__message">{message}</p> : null}
        {hasDetail ? (
          <div className="ca-confirm__detail">
            {detailTitle ? <div className="ca-confirm__detail-title">{detailTitle}</div> : null}
            {lines.map((line) => (
              <div key={line} className="ca-confirm__detail-line">{line}</div>
            ))}
          </div>
        ) : null}
        {children}
      </div>
    </CaModal>
  );
}
