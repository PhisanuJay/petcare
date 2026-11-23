import { TRIP_STATUSES, tripStatusMeta } from '../constants.js';

export default function TripStatusTimeline({ status, orientation = 'vertical' }) {
  const current = tripStatusMeta(status);
  const horizontal = orientation === 'horizontal';

  return (
    <ol className={`tp-timeline ${horizontal ? 'tp-timeline--horizontal' : ''}`}>
      {TRIP_STATUSES.map((s, index) => {
        const done = s.step < current.step;
        const active = s.step === current.step;
        return (
          <li
            key={s.id}
            className={`tp-timeline__item ${done ? 'is-done' : ''} ${active ? 'is-active' : ''}`}
          >
            {horizontal ? (
              <div className="tp-timeline__track">
                {index > 0 && <span className="tp-timeline__line" aria-hidden="true" />}
                <span className="tp-timeline__dot">
                  {done || active ? <i className="bi bi-check2" /> : s.step}
                </span>
              </div>
            ) : (
              <span className="tp-timeline__dot">
                {done || active ? <i className="bi bi-check2" /> : s.step}
              </span>
            )}
            <span className="tp-timeline__label">{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
