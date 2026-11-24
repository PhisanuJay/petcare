import CaModal from './CaModal.jsx';

export default function ConfirmDialog({
  open,
  title,
  message,
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

  return (
    <CaModal
      open={open}
      title={title}
      icon={icon}
      submitting={submitting}
      error={error}
      onClose={onClose}
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
      <p className="text-muted mb-2">{message}</p>
      {children}
    </CaModal>
  );
}
