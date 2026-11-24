import { useCallback, useEffect, useRef, useState } from 'react';

export function useCaToast() {
  const [message, setMessage] = useState('');
  const timerRef = useRef(null);

  const show = useCallback((msg) => {
    setMessage(msg);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMessage(''), 3200);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const toast = message ? (
    <div className="toast-soft ca-no-print" role="status" aria-live="polite">
      <i className="bi bi-check-circle me-2 text-sky" aria-hidden="true" />
      {message}
    </div>
  ) : null;

  return { show, toast };
}

export default function DataState({
  loading = false,
  error = '',
  onRetry,
  hasData = true,
  empty = false,
  emptyIcon = 'bi-inbox',
  emptyText = 'ไม่มีข้อมูล',
  children = null,
}) {
  if (error) {
    return (
      <div
        className="alert-soft danger d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4"
        role="alert"
      >
        <div className="d-flex align-items-center gap-2">
          <i className="bi bi-exclamation-octagon-fill" aria-hidden="true" />
          <span>{error}</span>
        </div>
        {onRetry && (
          <button type="button" className="btn btn-soft btn-sm" onClick={onRetry}>
            <i className="bi bi-arrow-clockwise me-1" aria-hidden="true" />
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

  if (empty) {
    return (
      <div className="card-soft empty-box mb-4">
        <i className={`bi ${emptyIcon}`} aria-hidden="true" />
        <p className="mb-0">{emptyText}</p>
      </div>
    );
  }

  return children;
}
