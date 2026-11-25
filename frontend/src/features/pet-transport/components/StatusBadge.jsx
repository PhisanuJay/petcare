export default function StatusBadge({ label, tone = 'info' }) {
  return <span className={`tp-badge tp-badge--${tone}`}>{label}</span>;
}
