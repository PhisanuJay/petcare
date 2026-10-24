import { newId } from '../../../shared/utils/storage.js';

/**
 * Editable list of history rows (vaccines, treatments, parasite prevention).
 * `fields`: [{ key, label, type: 'text' | 'date' | 'select' | 'textarea', options?, col?, placeholder? }]
 */
export default function RecordList({ rows, onChange, fields, newRow, addLabel, emptyText, emptyIcon }) {
  const update = (id, key, value) => onChange(rows.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  const remove = (id) => onChange(rows.filter((r) => r.id !== id));
  const add = () => onChange([{ ...newRow(), id: newId() }, ...rows]);

  return (
    <div>
      <button type="button" className="btn btn-soft mb-3" onClick={add}>
        <i className="bi bi-plus-lg me-1" />
        {addLabel}
      </button>

      {rows.length === 0 && (
        <div className="empty-box">
          <i className={`bi ${emptyIcon}`} />
          {emptyText}
        </div>
      )}

      {rows.map((row, index) => (
        <div className="record-row" key={row.id}>
          <button
            type="button"
            className="btn btn-sm btn-soft-danger remove"
            onClick={() => remove(row.id)}
            title="ลบรายการนี้"
          >
            <i className="bi bi-trash3" />
          </button>
          <div className="small text-muted mb-2">รายการที่ {rows.length - index}</div>
          <div className="row g-2 pb-2">
            {fields.map((f) => {
              const id = `${row.id}-${f.key}`;
              return (
                <div className={f.col ?? 'col-md-6'} key={f.key}>
                  <label className="form-label small" htmlFor={id}>{f.label}</label>
                  {f.type === 'select' ? (
                    <select
                      id={id}
                      className="form-select"
                      value={row[f.key] ?? ''}
                      onChange={(e) => update(row.id, f.key, e.target.value)}
                    >
                      {f.options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea
                      id={id}
                      rows={2}
                      className="form-control"
                      placeholder={f.placeholder}
                      value={row[f.key] ?? ''}
                      onChange={(e) => update(row.id, f.key, e.target.value)}
                    />
                  ) : (
                    <input
                      id={id}
                      type={f.type ?? 'text'}
                      className="form-control"
                      placeholder={f.placeholder}
                      value={row[f.key] ?? ''}
                      onChange={(e) => update(row.id, f.key, e.target.value)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
