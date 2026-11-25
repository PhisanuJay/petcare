import { TRIP_STATUSES, tripStatusMeta } from '../constants.js';

export default function TripStatusTimeline({ status }) {
  const current = tripStatusMeta(status);
  return (
    <ol className="tp-timeline">
      {TRIP_STATUSES.map((s) => {
        const done = s.step < current.step;
        const active = s.step === current.step;
        return (
          <li key={s.id} className={`tp-timeline__item ${done ? 'is-done' : ''} ${active ? 'is-active' : ''}`}>
            <span className="tp-timeline__dot">{s.step}</span>
            <span className="tp-timeline__label">{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
