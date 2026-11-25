/**
 * Banner at the top of every veterinarian page except the dashboard (which has its own hero):
 * an icon, the page title and a short line, with the page's actions on the right. Styles: vet.css (.vet-pagehead).
 */
export default function VetPageHeader({ icon, title, subtitle, stats = [], children }) {
  return (
    <div className="vet-pagehead">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div className="d-flex align-items-center gap-3">
          <span className="head-icon">
            <i className={`bi ${icon}`} />
          </span>
          <div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>
        {(stats.length > 0 || children) && (
          <div className="d-flex flex-wrap align-items-center gap-2">
            {stats.map((s) => (
              <div className="head-stat" key={s.label}>
                <i className={`bi ${s.icon}`} />
                <span className="stat-num">{s.value}</span>
                <span className="stat-label">{s.label}</span>
              </div>
            ))}
            {children && <div className="head-actions d-flex flex-wrap gap-2">{children}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
