import { useState } from 'react';

/**
 * Column chart of appointments over time (one blue series; hover or focus a column for its value).
 * `columns`: [{ key, label, title, count }]. `highlightKey` draws one column in the darker shade
 * (e.g. today). Styles live in vet.css (.viz-*).
 */
export default function DayChart({ columns, highlightKey, emptyText = 'ไม่มีนัดหมายในช่วงนี้', compact = false }) {
  const [active, setActive] = useState(null);
  const max = Math.max(1, ...columns.map((c) => c.count));
  const tickStep = Math.max(1, Math.ceil(columns.length / 8));
  const hovered = active === null ? null : columns[active];
  const total = columns.reduce((sum, c) => sum + c.count, 0);

  if (total === 0) return <div className="small text-muted py-4 text-center">{emptyText}</div>;

  return (
    <div>
      {!compact && <div className="small text-muted mb-1">สูงสุด {max} นัด</div>}
      <div className="viz-columns" style={compact ? { height: 120 } : undefined} onMouseLeave={() => setActive(null)}>
        {columns.map((c, i) => (
          <button
            type="button"
            key={c.key}
            className={`viz-col ${active === i || highlightKey === c.key ? 'active' : ''}`}
            aria-label={`${c.title}: ${c.count} นัด`}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
          >
            <span style={{ height: `${(c.count / max) * 100}%`, opacity: c.count === 0 ? 0.25 : 1 }} />
          </button>
        ))}
        {hovered && (
          <div className="viz-tooltip" style={{ left: `${((active + 0.5) / columns.length) * 100}%` }}>
            <div>{hovered.title}</div>
            <strong>{hovered.count} นัด</strong>
          </div>
        )}
      </div>
      <div className="d-flex mt-1" aria-hidden="true">
        {columns.map((c, i) => (
          <div
            key={c.key}
            className={`small text-center ${highlightKey === c.key ? 'fw-medium' : 'text-muted'}`}
            style={{ flex: '1 1 0', minWidth: 0, fontSize: '0.7rem' }}
          >
            {i % tickStep === 0 ? c.label : ''}
          </div>
        ))}
      </div>
    </div>
  );
}
