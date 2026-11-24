import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { speciesOf } from '../../pet-owner/petUtils.js';
import { STORAGE_KEYS, readJSON } from '../../../shared/utils/storage.js';
import { placeParts } from '../store.js';
import { useTransport } from '../useTransport.js';
import '../transport.css';

const SPECIES_SHORT = {
  dog: 'หมา',
  cat: 'แมว',
};

function findPet(petId) {
  if (!petId) return null;
  const pets = readJSON(STORAGE_KEYS.pets, []);
  return pets.find((p) => p.id === petId) || null;
}

function formatWhen(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleDateString('th-TH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })} ${date.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  })} น.`;
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v4.5l3 1.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PawIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="8" cy="9" r="1.6" fill="currentColor" />
      <circle cx="12" cy="7.5" r="1.6" fill="currentColor" />
      <circle cx="16" cy="9" r="1.6" fill="currentColor" />
      <ellipse cx="12" cy="15.2" rx="3.4" ry="2.6" fill="currentColor" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-5H10v5H5a1 1 0 0 1-1-1v-8.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="11" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.5 12.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CalIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3.5v3M16 3.5v3M4 9.5h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function HistoryPage() {
  const { currentUser } = useAuth();
  const transport = useTransport();
  const jobs = transport.tripsForDriver(currentUser?.id)
    .filter((job) => job.status === 'completed')
    .sort((left, right) => String(right.pickupTime).localeCompare(String(left.pickupTime)));

  const dateLabel = new Date().toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <section className="tp-page driver-page dv-light">
      <header className="dv-appt-head">
        <h2>
          <CalIcon />
          งานที่ส่งแล้ว
        </h2>
        <div className="dv-date" aria-label="วันที่">
          <CalIcon />
          {dateLabel}
        </div>
      </header>

      <div className="dv-appt-list">
        {jobs.map((job) => {
          const pet = findPet(job.booking?.petId);
          const from = placeParts(job.from, transport);
          const speciesKey = pet?.species || job.booking?.petSpecies;
          const speciesLabel = SPECIES_SHORT[speciesKey] || speciesOf(speciesKey).label;
          const breed = pet?.breed || job.booking?.petBreed || '';
          const kindLine = [speciesLabel, breed].filter(Boolean).join(' · ') || 'สัตว์เลี้ยง';
          const photo = pet?.photo || job.booking?.petPhoto || '';

          return (
            <article className="dv-appt" key={job.id}>
              {photo ? (
                <img className="dv-appt__photo" src={photo} alt="" />
              ) : (
                <span className="dv-appt__photo is-fallback" aria-hidden="true">
                  {speciesOf(speciesKey).emoji}
                </span>
              )}

              <div className="dv-appt__info">
                <time>
                  <ClockIcon />
                  {formatWhen(job.pickupTime)}
                </time>
                <strong>{job.booking?.petName || pet?.name || 'สัตว์เลี้ยง'}</strong>
                <span className="dv-appt__kind">
                  <PawIcon />
                  {kindLine}
                </span>
              </div>

              <div className="dv-appt__addr">
                <div className="dv-appt__place">
                  <HomeIcon />
                  <span>ที่อยู่</span>
                  <strong>{from.name || 'ไม่ระบุสถานที่'}</strong>
                </div>
                <p>
                  <PinIcon />
                  <span>{from.address || 'ยังไม่มีที่อยู่'}</span>
                </p>
              </div>

              <div className="dv-appt__side">
                <span className="dv-appt__badge is-done">
                  <CheckIcon />
                  ส่งแล้ว
                </span>
                <Link className="dv-appt__detail" to={`/pet-transport/jobs/${job.id}`}>
                  <EyeIcon />
                  ดูรายละเอียด
                  <span aria-hidden="true">›</span>
                </Link>
              </div>
            </article>
          );
        })}

        {!jobs.length ? <div className="dv-empty">ยังไม่มีงานที่ส่งแล้ว</div> : null}
      </div>
    </section>
  );
}
