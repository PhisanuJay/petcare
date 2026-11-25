export default function BarList({
  items = [],
  max,
  emptyText = 'ยังไม่มีข้อมูล',
  valueFormatter,
}) {
  if (!items || items.length === 0) {
    return (
      <div className="empty-box py-3">
        <i className="bi bi-bar-chart" aria-hidden="true" />
        <p className="mb-0 small">{emptyText}</p>
      </div>
    );
  }

  const computedMax =
    typeof max === 'number' && max > 0
      ? max
      : Math.max(1, ...items.map((item) => Number(item.value) || 0));

  return (
    <div className="ca-bar-list">
      {items.map((item, idx) => {
        const val = Number(item.value) || 0;
        const widthPct = Math.min(100, Math.max(0, (val / computedMax) * 100));
        const formatted = valueFormatter ? valueFormatter(val, item) : `${val}`;
        return (
          <div
            key={item.key ?? `${item.label}-${idx}`}
            className="ca-bar-row"
            aria-label={`${item.label} ${formatted}`}
          >
            <div className="ca-bar-meta">
              <span>{item.label}</span>
            </div>
            <div className="ca-bar-track-wrap">
              <div className="ca-bar-track" aria-hidden="true">
                <div className="ca-bar-fill" style={{ width: `${widthPct}%` }} />
              </div>
              <span className="ca-bar-val">{formatted}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
