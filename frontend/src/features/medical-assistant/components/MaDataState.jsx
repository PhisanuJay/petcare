export default function MaDataState({ loading, error, onRetry, hasData = false }) {
  if (error) {
    return (
      <div className="alert-soft danger d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4" role="alert">
        <div className="d-flex align-items-center gap-2">
          <i className="bi bi-exclamation-octagon-fill" />
          <span>{error}</span>
        </div>
        {onRetry && (
          <button type="button" className="btn btn-soft btn-sm" onClick={onRetry}>
            <i className="bi bi-arrow-clockwise me-1" />
            ลองใหม่
          </button>
        )}
      </div>
    );
  }

  if (loading && !hasData) {
    return (
      <div className="card-soft text-center py-5 mb-4" role="status" aria-live="polite">
        <div className="spinner-border text-primary spinner-border-sm me-2" aria-hidden="true" />
        <span className="text-muted">กำลังโหลดข้อมูล...</span>
      </div>
    );
  }

  return null;
}
