import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import IssueFields from '../components/IssueFields.jsx';
import PetKind from '../components/PetKind.jsx';
import { nextTripStatus, tripStatusMeta } from '../constants.js';
import { ensureDemoDriverJobs, placeParts } from '../store.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useTransport } from '../useTransport.js';
import '../transport.css';

const JOB_KIND = {
  pickup: 'รับขึ้นโรงแรม',
  dropoff: 'ส่งกลับบ้าน',
};

function dayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function dayOffset(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(date);
  that.setHours(0, 0, 0, 0);
  return Math.round((that.getTime() - today.getTime()) / 86400000);
}

function dayTitle(value) {
  const offset = dayOffset(value);
  if (offset === 0) return 'วันนี้';
  if (offset === 1) return 'พรุ่งนี้';
  return new Date(value).toLocaleDateString('th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function clockLabel(value, overdue) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  if (overdue) {
    return date.toLocaleString('th-TH', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function phoneHref(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : '';
}

function Stop({ label, place, state }) {
  const parts = placeParts(place, state);
  return (
    <div className="driver-stop">
      <span>{label}</span>
      <strong>{parts.name || 'ไม่ระบุสถานที่'}</strong>
      <p>{parts.address || 'ยังไม่มีเลขที่อยู่'}</p>
    </div>
  );
}

function groupJobs(jobs) {
  const overdue = jobs.filter((job) => dayOffset(job.pickupTime) < 0);
  const todayJobs = jobs.filter((job) => dayOffset(job.pickupTime) === 0);
  const laterKeys = [...new Set(
    jobs.filter((job) => dayOffset(job.pickupTime) > 0).map((job) => dayKey(job.pickupTime)),
  )].sort();
  const groups = [];
  if (overdue.length) {
    groups.push({ id: 'overdue', title: 'เลยกำหนด', jobs: overdue, overdue: true });
  }
  if (jobs.length) {
    groups.push({ id: dayKey(new Date()), title: 'วันนี้', jobs: todayJobs, today: true });
  }
  laterKeys.forEach((key) => {
    const sample = jobs.find((job) => dayKey(job.pickupTime) === key);
    groups.push({
      id: key,
      title: dayTitle(sample.pickupTime),
      jobs: jobs.filter((job) => dayKey(job.pickupTime) === key),
    });
  });
  return groups;
}

export default function DriverSchedule() {
  const { currentUser } = useAuth();
  const transport = useTransport();
  const { tripsForDriver, advanceTripStatus, reportIssue } = transport;
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [activeDay, setActiveDay] = useState(() => dayKey(new Date()));
  const [issueId, setIssueId] = useState('');

  useEffect(() => {
    if (currentUser?.id) ensureDemoDriverJobs(currentUser.id);
  }, [currentUser?.id]);

  const all = tripsForDriver(currentUser?.id);
  const jobs = all
    .filter((job) => job.status !== 'completed')
    .sort((left, right) => String(left.pickupTime).localeCompare(String(right.pickupTime)));
  const groups = groupJobs(jobs);
  const selected = groups.find((group) => group.id === activeDay) || groups[0];
  const visible = selected ? [selected] : [];
  const todayJobs = jobs.filter((job) => dayOffset(job.pickupTime) === 0);
  const moving = todayJobs.filter((job) => {
    const step = tripStatusMeta(job.status).step;
    return step >= 2 && step < 7;
  }).length;
  const upcoming = jobs.filter((job) => dayOffset(job.pickupTime) > 0).length;
  const done = all.filter((job) => job.status === 'completed').length;

  function markNext(job) {
    setError('');
    setNote('');
    try {
      advanceTripStatus(job.id);
      const next = nextTripStatus(job.status);
      setNote(next ? `${job.booking?.petName} · ${next.label}` : 'อัปเดตแล้ว');
    } catch (err) {
      setError(err.message);
    }
  }

  function submitIssue(job, reasonId, message) {
    reportIssue({
      tripId: job.id,
      driverId: currentUser.id,
      reasonId,
      message,
    });
    setIssueId('');
    setError('');
    setNote(`${job.booking?.petName || 'งานนี้'} · ส่งปัญหาให้แอดมินแล้ว`);
  }

  function showDay(id) {
    setActiveDay(id);
    setIssueId('');
  }

  return (
    <section className="tp-page driver-page">
      <header className="driver-board">
        <div>
          <p>ตารางรับส่ง</p>
          <h1>{new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' })}</h1>
        </div>
        <ul className="driver-stats">
          <li><strong>{todayJobs.length}</strong><span>งานค้างวันนี้</span></li>
          <li><strong>{moving}</strong><span>กำลังเดินทาง</span></li>
          <li><strong>{done}</strong><span>ส่งแล้ว</span></li>
          <li><strong>{upcoming}</strong><span>จองวันหน้า</span></li>
        </ul>
      </header>
      {note ? <div className="tp-alert tp-alert--ok">{note}</div> : null}
      {error ? <div className="tp-alert tp-alert--danger">{error}</div> : null}
      {groups.length ? (
        <div className="driver-days" aria-label="วันที่มีงาน">
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              className={selected?.id === group.id ? 'is-active' : ''}
              aria-pressed={selected?.id === group.id}
              onClick={() => showDay(group.id)}
            >
              {group.title}
              <b>{group.jobs.length}</b>
            </button>
          ))}
        </div>
      ) : null}
      <div className="driver-days-list">
        {visible.map((group) => (
          <section className="driver-day" id={`driver-day-${group.id}`} key={group.id}>
            <h2 className={group.overdue ? 'is-overdue' : ''}>
              {group.title}
              <small>{group.jobs.length} งาน</small>
            </h2>
            <div className="driver-jobs">
              {group.jobs.map((job) => {
                const next = nextTripStatus(job.status);
                const meta = tripStatusMeta(job.status);
                const phone = phoneHref(job.booking?.ownerPhone);
                return (
                  <article className={`driver-job is-${job.type}`} key={job.id}>
                    <header className="driver-job__top">
                      <time>{clockLabel(job.pickupTime, group.overdue)}</time>
                      <div className="driver-job__who">
                        <strong>{job.booking?.petName || 'สัตว์เลี้ยง'}</strong>
                        <div className="driver-job__meta">
                          <em className={`driver-kind is-${job.type}`}>{JOB_KIND[job.type] || 'งานส่งสัตว์'}</em>
                          <PetKind booking={job.booking} />
                        </div>
                      </div>
                      <span className={`driver-status step-${meta.step}`}>{meta.label}</span>
                    </header>
                    <div className="driver-stops">
                      <Stop label="รับจาก" place={job.from} state={transport} />
                      <Stop label="ส่งที่" place={job.to} state={transport} />
                    </div>
                    <footer>
                      <div className="driver-contact">
                        <span>{job.booking?.ownerName || 'เจ้าของ'}</span>
                        {phone ? <a href={phone}>{job.booking.ownerPhone}</a> : <span>ไม่มีเบอร์</span>}
                        {job.booking?.petNotes ? <p>{job.booking.petNotes}</p> : null}
                      </div>
                      <div className="driver-job__actions">
                        <button type="button" className="tp-btn" disabled={!next} onClick={() => markNext(job)}>
                          {next ? next.label : 'ส่งแล้ว'}
                        </button>
                        <Link className="tp-btn tp-btn--ghost" to={`/pet-transport/jobs/${job.id}`}>รายละเอียด</Link>
                        <button
                          type="button"
                          className="tp-btn tp-btn--ghost"
                          aria-expanded={issueId === job.id}
                          onClick={() => setIssueId(issueId === job.id ? '' : job.id)}
                        >
                          แจ้งปัญหา
                        </button>
                      </div>
                    </footer>
                    {issueId === job.id ? (
                      <IssueFields
                        onClose={() => setIssueId('')}
                        onSubmit={(reasonId, message) => submitIssue(job, reasonId, message)}
                      />
                    ) : null}
                  </article>
                );
              })}
              {!group.jobs.length && group.today ? <div className="driver-empty">วันนี้ไม่มีงานค้าง</div> : null}
            </div>
          </section>
        ))}
        {!jobs.length ? <div className="driver-empty">วันนี้ยังไม่มีงานค้าง</div> : null}
      </div>
    </section>
  );
}
