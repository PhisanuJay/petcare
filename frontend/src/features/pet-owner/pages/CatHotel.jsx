import { forwardRef, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import DatePicker, { registerLocale } from 'react-datepicker';
import { th } from 'date-fns/locale/th';
import { format, isValid, parse } from 'date-fns';
import 'react-datepicker/dist/react-datepicker.css';
import { HOTEL_PERKS, HOTEL_ROOMS, HOTEL_STAY_PROMO } from '../../../shared/data/homeContent.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { usePets } from '../usePets.js';
import { speciesOf } from '../petUtils.js';
import { HOTEL_STATUS, HOTEL_STATUS_LABEL, cagePlan, quoteStay, stayNights, useHotelBookings } from '../useHotelBookings.js';
import { createPayment, PAY_KIND, submitSlip } from '../../payments/store.js';
import { PAY_ACCOUNT, depositOf, promptPayPayload } from '../../payments/promptpay.js';
import { fileToResizedDataUrl } from '../../../shared/utils/storage.js';
import QRCode from 'qrcode';

const PET_GROUPS = [
  { id: 'dog', label: 'สุนัข' },
  { id: 'cat', label: 'แมว' },
  { id: 'other', label: 'อื่น ๆ' },
];

function petGroup(species) {
  if (species === 'dog' || species === 'cat') return species;
  return 'other';
}

function stayChoice(id) {
  const group = PET_GROUPS.find((item) => id === `guest:${item.id}`);
  if (!group) return null;
  return {
    id,
    name: group.label,
    species: group.id === 'other' ? 'other' : group.id,
    guest: true,
  };
}

registerLocale('th', th);
import { api, formatWhen } from '../../super-admin/hotel-cctv/src/api.js';
import Player from '../../super-admin/hotel-cctv/src/components/Player.jsx';
import '../hotel.css';

const ROOM_THAI = {
  Standard: 'ห้องมาตรฐาน',
  Deluxe: 'ห้องพิเศษ',
  Suite: 'ห้องสวีท',
};

const GUIDE = [
  { n: '1', title: 'เลือกแพ็กเกจ', text: 'เลือกห้องในหน้านี้ แล้วไปกรอกวันเข้าพักในหน้าจอง' },
  { n: '2', title: 'พาน้องมาฝาก', text: 'นำน้องมาที่เคาน์เตอร์ตามวันเข้าพัก โรงแรมเปิดตลอด 24 ชั่วโมง' },
  { n: '3', title: 'เจ้าหน้าที่รับน้อง', text: 'สถานะเข้าพักและรับกลับอัปเดตจากหลังบ้าน ลูกค้าไม่ต้องกดเอง' },
  { n: '4', title: 'ดูกล้อง', text: 'เมื่อเจ้าหน้าที่เปิดจอ จอเล็กจะขึ้นข้างใบจอง กดเพื่อเข้าหน้าจอนั้น' },
];

const CARE_LABEL = {
  feed: 'ให้อาหาร',
  water: 'น้ำ',
  play: 'เล่น',
  health: 'สุขภาพ',
};

function formatDay(value) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function folioNo(id) {
  const raw = String(id || '').replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase();
  return raw ? `PC-${raw}` : 'PC';
}

function baht(value) {
  return `฿${Number(value).toLocaleString('th-TH')}`;
}

function StayTabs() {
  const { pathname } = useLocation();
  const onBookings = pathname.startsWith('/pet-owner/cat-hotel/bookings') || pathname.startsWith('/pet-owner/cat-hotel/watch');
  return (
    <nav className="stay-tabs" aria-label="เมนูโรงแรม">
      <NavLink
        to="/pet-owner/cat-hotel"
        end
        className={({ isActive }) => (isActive || pathname === '/pet-owner/cat-hotel/book' ? 'active' : undefined)}
      >
        จอง
      </NavLink>
      <NavLink
        to="/pet-owner/cat-hotel/bookings"
        className={({ isActive }) => (isActive || onBookings ? 'active' : undefined)}
      >
        การจองของฉัน
      </NavLink>
    </nav>
  );
}

/**
 * Pet owner hotel stay.
 * The booking never stores a camera. Live picture comes only from an active CCTV grant.
 */
export default function CatHotelPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="stay-page page-wrap">
      <div className="container">
        <header className="stay-mast">
          <div>
            <p className="stay-kicker">โรงแรมสัตว์เลี้ยง</p>
            <h1>จองห้องพักให้น้อง</h1>
            <p>เลือกแพ็กเกจแล้วไปหน้าจอง สแกนมัดจำและแนบสลิป ฝ่ายบัญชีเป็นคนอนุมัติ</p>
          </div>
          <ul className="stay-facts">
            <li><span>ที่ตั้ง</span><strong>99/9 ถนนพหลโยธิน จตุจักร</strong></li>
            <li><span>เวลา</span><strong>เปิด 24 ชั่วโมง</strong></li>
            <li><span>โทร</span><strong>02-123-4567</strong></li>
            <li><span>บัญชี</span><strong className="stay-mail">{currentUser?.email || '—'}</strong></li>
          </ul>
        </header>
        <StayTabs />

        <section className="stay-promo" aria-label="โปรโมชั่นโรงแรม">
          <b>{HOTEL_STAY_PROMO.percent}%</b>
          <div>
            <strong>{HOTEL_STAY_PROMO.title}</strong>
            <p>หักในใบจองเมื่อพักตั้งแต่ {HOTEL_STAY_PROMO.minNights} คืน ถึง 31 ธ.ค. 2569 ไม่ต้องใส่รหัส</p>
          </div>
        </section>

        <section aria-label="แพ็กเกจห้องพัก">
          <div className="stay-section-head">
            <h2>แพ็กเกจห้องพัก</h2>
            <p>ราคาต่อคืน รวมอาหารและการดูแลตามรายการในห้อง</p>
          </div>
          <div className="row g-4">
            {HOTEL_ROOMS.map((item) => (
              <div className="col-md-4" key={item.name}>
                <article className={`hotel-card ${item.featured ? 'featured' : ''}`}>
                  {item.featured ? <span className="ribbon">ยอดนิยม</span> : null}
                  <img className="room-photo" src={item.image} alt={ROOM_THAI[item.name]} />
                  <div className="mitr fs-5">{ROOM_THAI[item.name]}</div>
                  <div className="small text-muted">{item.name}</div>
                  <div className="price">
                    {baht(item.price)}
                    <span className="fs-6 text-muted"> / คืน</span>
                  </div>
                  <ul>
                    {item.features.map((feature) => (
                      <li key={feature}>
                        <i className="bi bi-check-circle-fill" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <button className="btn btn-sky w-100" type="button" onClick={() => navigate(`/pet-owner/cat-hotel/book?room=${item.name}`)}>
                    {`จอง${ROOM_THAI[item.name]}`}
                  </button>
                </article>
              </div>
            ))}
          </div>
        </section>

        <section className="stay-guide" aria-label="วิธีใช้โรงแรม">
          <div className="stay-guide-copy">
            <h2>ฝากยังไง</h2>
            <p>เลือกห้องและวันในหน้านี้ ที่เหลือเจ้าหน้าที่อัปเดตให้หลังนำน้องมาฝาก</p>
            <ol>
              {GUIDE.map((step) => (
                <li key={step.n}>
                  <b>{step.n}</b>
                  <div>
                    <strong>{step.title}</strong>
                    <span>{step.text}</span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <aside className="stay-slip" aria-label="ตัวอย่างใบจอง">
            <header>
              <div>
                <p>ตัวอย่างใบจอง</p>
                <strong>PC-ตัวอย่าง</strong>
              </div>
              <span>รอนำมาฝาก</span>
            </header>
            <h3>ห้องพิเศษ</h3>
            <p>น้องมะลิ · 1 กรง</p>
            <dl>
              <div><dt>เข้าพัก</dt><dd>ศุกร์ 25 พ.ย. 2569</dd></div>
              <div><dt>รับกลับ</dt><dd>อังคาร 29 พ.ย. 2569</dd></div>
              <div><dt>จำนวนคืน</dt><dd>4 คืน</dd></div>
            </dl>
            <div className="stay-slip-tear">
              <p>มัดจำที่ต้องสแกน</p>
              <strong>฿765</strong>
              <span>30% ของยอด ฿2,550 · ส่วนที่เหลือจ่ายตอนใช้บริการ</span>
            </div>
          </aside>
        </section>

        <ul className="stay-perks">
          {HOTEL_PERKS.map((perk) => (
            <li key={perk.title}>
              <i className={`bi ${perk.icon}`} aria-hidden="true" />
              <div>
                <strong>{perk.title}</strong>
                <span>{perk.desc}</span>
              </div>
            </li>
          ))}
        </ul>

      </div>
    </div>
  );
}

export function StayBookPage() {
  const { currentUser } = useAuth();
  const { pets } = usePets();
  const { createBooking } = useHotelBookings();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requested = params.get('room');
  const [roomName, setRoomName] = useState(HOTEL_ROOMS.some((item) => item.name === requested) ? requested : 'Deluxe');
  const [petIds, setPetIds] = useState([]);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [note, setNote] = useState('');
  const [slip, setSlip] = useState('');
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setPetIds((current) => current.filter((id) => pets.some((pet) => pet.id === id) || stayChoice(id)));
  }, [pets]);

  const selectedPets = petIds.flatMap((id) => {
    const pet = pets.find((item) => item.id === id);
    if (pet) return [pet];
    const guest = stayChoice(id);
    return guest ? [guest] : [];
  });
  const plan = cagePlan(selectedPets);
  const nights = stayNights(checkIn, checkOut);
  const quote = useMemo(
    () => quoteStay({ roomName, checkIn, checkOut, cages: plan.cages || 1 }),
    [roomName, checkIn, checkOut, plan.cages],
  );
  const room = HOTEL_ROOMS.find((item) => item.name === roomName);
  const priced = quote && selectedPets.length ? quote : null;
  const deposit = priced ? depositOf(priced.total) : null;
  const booker = `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim();

  useEffect(() => {
    if (!deposit) {
      setQr('');
      return undefined;
    }
    let gone = false;
    QRCode.toDataURL(promptPayPayload(PAY_ACCOUNT.promptpay, deposit), {
      margin: 1,
      width: 220,
      color: { dark: '#17324d', light: '#ffffff' },
    }).then((url) => {
      if (!gone) setQr(url);
    }).catch(() => {
      if (!gone) setQr('');
    });
    return () => {
      gone = true;
    };
  }, [deposit]);

  async function onFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    try {
      setSlip(await fileToResizedDataUrl(file, 960, 0.82));
    } catch (err) {
      setError(err.message);
    }
  }

  function onSubmit(event) {
    event.preventDefault();
    setError('');
    if (!selectedPets.length) {
      setError('เลือกสัตว์เลี้ยงอย่างน้อย 1 ตัว');
      return;
    }
    if (!priced) {
      setError('เลือกวันเข้าพักและวันรับกลับ');
      return;
    }
    if (!slip) {
      setError('แนบสลิปมัดจำก่อนยืนยัน');
      return;
    }
    try {
      const booking = createBooking({
        pets: selectedPets.map((pet) => ({ id: pet.id, name: pet.name, species: pet.species || 'other' })),
        checkIn,
        checkOut,
        roomName,
      });
      const payment = createPayment({
        kind: PAY_KIND.hotel,
        refId: booking.id,
        ownerId: currentUser.id,
        ownerName: booker,
        email: currentUser.email,
        title: ROOM_THAI[roomName] || roomName,
        detail: `${booking.petName} · ${priced.nights} คืน · ${plan.cages} กรง${note.trim() ? ` · ${note.trim()}` : ''}`,
        total: priced.total,
      });
      submitSlip(payment.id, currentUser.id, slip);
      navigate('/pet-owner/history');
    } catch (err) {
      setError(err.message);
    }
  }

  async function copyAccount() {
    try {
      await navigator.clipboard.writeText(PAY_ACCOUNT.promptpay);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const start = checkIn ? parse(checkIn, 'yyyy-MM-dd', new Date()) : null;
  const end = checkOut ? parse(checkOut, 'yyyy-MM-dd', new Date()) : null;

  return (
    <div className="stay-page page-wrap">
      <div className="container">
        <Link className="stay-back" to="/pet-owner/cat-hotel">กลับไปหน้าโรงแรม</Link>
        <header className="book-head">
          <h1>จองห้องพัก</h1>
          <p>เลือกห้อง วัน และน้อง แล้วโอนมัดจำผ่าน QR</p>
        </header>
        <form className="book-sheet" onSubmit={onSubmit}>
          <div className="book-main">
            <section className="book-card">
              <h2><b>1</b>เลือกห้อง</h2>
              <label className="form-label" htmlFor="stay-room">แพ็กเกจ</label>
              <select id="stay-room" className="form-control" value={roomName} onChange={(event) => setRoomName(event.target.value)}>
                {HOTEL_ROOMS.map((item) => (
                  <option key={item.name} value={item.name}>
                    {ROOM_THAI[item.name]} · {baht(item.price)} ต่อกรงต่อคืน
                  </option>
                ))}
              </select>
              {room ? (
                <div className="book-room">
                  <img src={room.image} alt={ROOM_THAI[room.name]} />
                  <div>
                    <strong>{ROOM_THAI[room.name]}</strong>
                    <span>{room.features[0]}</span>
                    <b>{baht(room.price)} ต่อกรงต่อคืน</b>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="book-card">
              <h2><b>2</b>เลือกวันเข้าพัก</h2>
              <div className="book-dates">
                <DatePicker
                  inline
                  selectsRange
                  startDate={start && isValid(start) ? start : null}
                  endDate={end && isValid(end) ? end : null}
                  onChange={(value) => {
                    const [from, to] = value || [];
                    setCheckIn(from && isValid(from) ? format(from, 'yyyy-MM-dd') : '');
                    setCheckOut(to && isValid(to) ? format(to, 'yyyy-MM-dd') : '');
                  }}
                  locale="th"
                  minDate={new Date()}
                  monthsShown={1}
                  calendarClassName="stay-range-cal"
                />
                <div className="book-span">
                  <div>
                    <p>เข้าพัก</p>
                    <strong>{checkIn ? formatDay(checkIn) : 'ยังไม่เลือก'}</strong>
                  </div>
                  <div>
                    <p>รับกลับ</p>
                    <strong>{checkOut ? formatDay(checkOut) : 'ยังไม่เลือก'}</strong>
                  </div>
                  <div>
                    <p>จำนวนคืน</p>
                    <strong>{nights ? `${nights} คืน` : '—'}</strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="book-card">
              <h2><b>3</b>ข้อมูลผู้จอง</h2>
              <div className="book-who">
                <label>
                  ชื่อผู้จอง
                  <input className="form-control" value={booker || '—'} readOnly />
                </label>
                <label>
                  เบอร์โทร
                  <input className="form-control" value={currentUser?.phone || '—'} readOnly />
                </label>
              </div>
              <PetPicker pets={pets} petIds={petIds} onChange={setPetIds} />
              <label className="form-label" htmlFor="stay-note">รายละเอียดเพิ่มเติม</label>
              <textarea id="stay-note" className="form-control" rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="เช่น อาหารที่น้องกิน หรือเวลาที่จะนำมาฝาก" />
            </section>
          </div>

          <aside className="book-card book-pay">
            <h2><b>4</b>ชำระเงิน</h2>
            <dl>
              <div><dt>ห้อง</dt><dd>{room ? ROOM_THAI[room.name] : '—'}</dd></div>
              <div><dt>เข้าพัก</dt><dd>{checkIn ? formatDay(checkIn) : '—'}</dd></div>
              <div><dt>รับกลับ</dt><dd>{checkOut ? formatDay(checkOut) : '—'}</dd></div>
              <div><dt>น้อง</dt><dd>{selectedPets.length ? selectedPets.map((pet) => pet.name).join(', ') : '—'}</dd></div>
              <div><dt>กรง</dt><dd>{selectedPets.length ? `${plan.cages} กรง` : '—'}</dd></div>
              <div><dt>ค่าห้อง</dt><dd>{priced ? baht(priced.subtotal) : '—'}</dd></div>
              <div><dt>ส่วนลด</dt><dd>{priced?.discount ? `-${baht(priced.discount)}` : '—'}</dd></div>
              <div><dt>ยอดเต็ม</dt><dd>{priced ? baht(priced.total) : '—'}</dd></div>
            </dl>
            <p className="book-promo">{priced?.promoApplied ? `พัก ${HOTEL_STAY_PROMO.minNights} คืนขึ้นไป หัก ${HOTEL_STAY_PROMO.percent}% แล้ว` : `พักครบ ${HOTEL_STAY_PROMO.minNights} คืน ลด ${HOTEL_STAY_PROMO.percent}%`}</p>
            <div className="book-deposit">
              <span>ยอดมัดจำที่ต้องโอน (30%)</span>
              <strong>{deposit ? baht(deposit) : '—'}</strong>
            </div>
            <div className="book-qr">
              {qr ? <img src={qr} alt={deposit ? `QR มัดจำ ${baht(deposit)}` : 'QR มัดจำ'} /> : <p>เลือกวันเข้าพักเพื่อสร้าง QR</p>}
            </div>
            <div className="book-account">
              <span>ช่องทาง</span>
              <b>{PAY_ACCOUNT.bank}</b>
              <span className="book-account-gap" />
              <span>ชื่อบัญชี</span>
              <b>{PAY_ACCOUNT.name}</b>
              <span className="book-account-gap" />
              <span>พร้อมเพย์</span>
              <b>{PAY_ACCOUNT.promptpay}</b>
              <button type="button" onClick={copyAccount}>{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</button>
            </div>
            <label className="book-slip">
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} />
              <span>{slip ? 'เปลี่ยนสลิป' : 'แนบสลิปการโอนเงิน'}</span>
            </label>
            {slip ? <img className="book-slip-preview" src={slip} alt="สลิปที่แนบ" /> : null}
            {plan.note && selectedPets.length ? <p className="book-note">{plan.note}</p> : null}
            {error ? <p className="book-error">{error}</p> : null}
            <button className="btn btn-sky book-confirm" type="submit" disabled={!priced || !selectedPets.length || !slip}>
              ยืนยันการจอง
            </button>
          </aside>
        </form>
      </div>
    </div>
  );
}

const STAY_HEADERS = { 'X-Stay-View': '1' };

function useStayCameras(email) {
  const [cameras, setCameras] = useState(null);

  useEffect(() => {
    if (!email) {
      setCameras([]);
      return undefined;
    }
    let gone = false;
    async function pull() {
      try {
        await api('/api/auth/owner-link', { method: 'POST', body: { email } });
        const data = await api('/api/cameras', { headers: STAY_HEADERS });
        if (!gone) setCameras(data.items || []);
      } catch {
        if (!gone) setCameras([]);
      }
    }
    pull();
    const timer = window.setInterval(pull, 8000);
    return () => {
      gone = true;
      window.clearInterval(timer);
    };
  }, [email]);

  return cameras;
}

function useCameraCare(cameraId, enabled) {
  const [care, setCare] = useState([]);

  useEffect(() => {
    if (!enabled || !cameraId) {
      setCare([]);
      return undefined;
    }
    let gone = false;
    async function pull() {
      try {
        const data = await api(`/api/cameras/${cameraId}/care`, { headers: STAY_HEADERS });
        if (!gone) setCare(data.items || []);
      } catch {
        if (!gone) setCare([]);
      }
    }
    pull();
    const timer = window.setInterval(pull, 8000);
    return () => {
      gone = true;
      window.clearInterval(timer);
    };
  }, [cameraId, enabled]);

  return care;
}

function petNames(booking) {
  const listed = Array.isArray(booking.pets) ? booking.pets.map((pet) => pet.name) : [];
  const typed = String(booking.petName || '').split(',');
  return [...listed, ...typed].map((name) => name.trim().toLowerCase()).filter((name) => name.length >= 2);
}

function cameraHitsBooking(booking, camera) {
  const names = petNames(booking);
  const bits = [camera.catName, camera.name].map((value) => String(value || '').trim().toLowerCase()).filter(Boolean);
  return names.some((name) => bits.some((bit) => bit.includes(name) || name.includes(bit)));
}

function screensByBooking(bookings, cameras) {
  const map = new Map(bookings.map((booking) => [booking.id, []]));
  const spare = [];
  cameras.forEach((camera) => {
    const hit = bookings.find((booking) => cameraHitsBooking(booking, camera));
    if (hit) map.get(hit.id).push(camera);
    else spare.push(camera);
  });
  if (spare.length && bookings.length) {
    const today = new Date().toISOString().slice(0, 10);
    const staying = bookings.filter((booking) => booking.status === HOTEL_STATUS.checkedIn);
    const host = staying.find((booking) => booking.checkIn <= today && today < (booking.checkOut || '9999'))
      || staying[0]
      || bookings[0];
    map.get(host.id).push(...spare);
  }
  return map;
}

export function CatHotelBookingsPage() {
  const { currentUser } = useAuth();
  const { bookings } = useHotelBookings();
  const cameras = useStayCameras(currentUser?.email || '');
  const grouped = useMemo(
    () => screensByBooking(bookings, cameras || []),
    [bookings, cameras],
  );
  const waitingCount = bookings.filter((row) => row.status === HOTEL_STATUS.waiting).length;
  const stayingCount = bookings.filter((row) => row.status === HOTEL_STATUS.checkedIn).length;
  return (
    <div className="stay-page page-wrap">
      <div className="container">
        <header className="stay-mast">
          <div>
            <p className="stay-kicker">โรงแรมสัตว์เลี้ยง</p>
            <h1>{currentUser?.firstName ? `ใบจองของคุณ${currentUser.firstName}` : 'ใบจองเข้าพัก'}</h1>
            <p>รายละเอียดอยู่ซ้าย จอที่เจ้าหน้าที่เปิดให้บัญชีนี้อยู่ขวา กดจอเพื่อดูภาพเต็ม</p>
          </div>
          <ul className="stay-counts">
            <li><span>ใบจองทั้งหมด</span><strong>{bookings.length}</strong></li>
            <li><span>รอนำมาฝาก</span><strong>{waitingCount}</strong></li>
            <li><span>กำลังเข้าพัก</span><strong>{stayingCount}</strong></li>
          </ul>
        </header>
        <StayTabs />
        {bookings.length === 0 ? (
          <div className="stay-empty">
            <p className="stay-kicker">ยังไม่มีใบจอง</p>
            <p>เมื่อยืนยันการจอง ใบเข้าพักจะอยู่ที่หน้านี้</p>
            <Link className="btn btn-sky" to="/pet-owner/cat-hotel">จองห้องพัก</Link>
          </div>
        ) : (
          <div className="stay-list">
            {bookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                cameras={cameras === null ? null : (grouped.get(booking.id) || [])}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const StayRangeInput = forwardRef(function StayRangeInput({ title, className, onChange, ...props }, ref) {
  return (
    <input
      ref={ref}
      {...props}
      className="stay-range-input"
      title=""
      readOnly
      inputMode="none"
      autoComplete="off"
      onChange={() => {}}
      onPaste={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (!['Tab', 'Escape', 'Enter'].includes(event.key)) event.preventDefault();
      }}
    />
  );
});

function PetPicker({ pets, petIds, onChange }) {
  const groups = PET_GROUPS.map((group) => ({
    ...group,
    pets: pets.filter((pet) => petGroup(pet.species) === group.id),
  }));
  const [active, setActive] = useState('dog');
  const [query, setQuery] = useState('');
  const current = groups.find((group) => group.id === active) || groups[0];
  const choices = current.pets.length ? current.pets : [stayChoice(`guest:${current.id}`)];
  const visible = choices.filter((pet) => (
    !query.trim() || pet.name.toLowerCase().includes(query.trim().toLowerCase())
  ));

  function toggle(id) {
    onChange(petIds.includes(id) ? petIds.filter((item) => item !== id) : [...petIds, id]);
  }

  function toggleGroup(list, on) {
    const ids = new Set(petIds);
    list.forEach((pet) => (on ? ids.delete(pet.id) : ids.add(pet.id)));
    onChange([...ids]);
  }

  const pickedInGroup = current.pets.filter((pet) => petIds.includes(pet.id)).length;
  const allOn = current.pets.length > 0 && pickedInGroup === current.pets.length;

  return (
    <div className="stay-pets">
      <div className="stay-pets-head">
        <span className="form-label">สัตว์เลี้ยง</span>
        <span>เลือกแล้ว {petIds.length} ตัว</span>
      </div>
      <div className="stay-pet-tabs" role="tablist">
        {groups.map((group) => (
          <button
            key={group.id}
            type="button"
            role="tab"
            aria-selected={group.id === current.id}
            className={group.id === current.id ? 'is-on' : ''}
            onClick={() => { setActive(group.id); setQuery(''); }}
          >
            {group.label}
            <b>{group.pets.length}</b>
          </button>
        ))}
      </div>
      {current.pets.length > 6 ? (
        <input
          className="form-control stay-pet-find"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`ค้นหาชื่อ${current.label}`}
          aria-label={`ค้นหาชื่อ${current.label}`}
        />
      ) : null}
      <div className="stay-pet-list" role="group" aria-label={current.label}>
        {visible.length === 0 ? <p>ไม่พบชื่อนี้ในหมวด{current.label}</p> : visible.map((pet) => {
          const on = petIds.includes(pet.id);
          return (
            <button key={pet.id} type="button" className={on ? 'is-on' : ''} aria-pressed={on} onClick={() => toggle(pet.id)}>
              <strong>{pet.name}</strong>
              <span>{pet.guest ? 'ยังไม่มีในบัญชี · กดเพื่อเลือก' : speciesOf(pet.species).label}</span>
            </button>
          );
        })}
      </div>
      <div className="stay-pets-foot">
        {current.pets.length ? (
          <button type="button" onClick={() => toggleGroup(current.pets, allOn)}>
            {allOn ? `ยกเลิก${current.label}ทั้งหมด` : `เลือก${current.label}ทั้งหมด`}
          </button>
        ) : <span>ยังไม่มี{current.label}ในบัญชี</span>}
        <Link to="/pet-owner/my-pets/new">เพิ่มสัตว์เลี้ยง</Link>
      </div>
    </div>
  );
}

function StayRange({ id, checkIn, checkOut, onChange }) {
  const start = checkIn ? parse(checkIn, 'yyyy-MM-dd', new Date()) : null;
  const end = checkOut ? parse(checkOut, 'yyyy-MM-dd', new Date()) : null;
  return (
    <DatePicker
      id={id}
      selectsRange
      startDate={start && isValid(start) ? start : null}
      endDate={end && isValid(end) ? end : null}
      onChange={(value) => {
        const [from, to] = value || [];
        onChange({
          checkIn: from && isValid(from) ? format(from, 'yyyy-MM-dd') : '',
          checkOut: to && isValid(to) ? format(to, 'yyyy-MM-dd') : '',
        });
      }}
      locale="th"
      dateFormat="dd/MM/yyyy"
      placeholderText="เลือกวันเข้าพัก – วันรับกลับ"
      minDate={new Date()}
      monthsShown={1}
      shouldCloseOnSelect
      showPopperArrow={false}
      popperPlacement="bottom-start"
      customInput={<StayRangeInput />}
      calendarClassName="stay-range-cal"
      wrapperClassName="stay-range"
      popperClassName="stay-range-pop"
    />
  );
}

function BookingCard({ booking, cameras }) {
  const nights = booking.nights || stayNights(booking.checkIn, booking.checkOut);
  const roomLabel = ROOM_THAI[booking.roomName] || 'ไม่ระบุแพ็กเกจ';
  return (
    <article className="stay-folio">
      <div className="stay-folio-main">
        <header className="stay-folio-top">
          <div>
            <p>{folioNo(booking.id)}{booking.email ? ` · ${booking.email}` : ''}</p>
            <strong>{booking.petName}</strong>
          </div>
          <span className={`stay-status ${booking.status}`}>{HOTEL_STATUS_LABEL[booking.status]}</span>
        </header>
        {booking.cageNote ? <p className="stay-note stay-folio-note">{booking.cageNote}</p> : null}
        <dl className="stay-folio-line">
          <div><dt>ห้อง</dt><dd>{roomLabel}</dd></div>
          <div><dt>กรง</dt><dd>{booking.cages ? `${booking.cages} กรง` : '—'}</dd></div>
          <div><dt>เข้าพัก</dt><dd>{formatDay(booking.checkIn)}</dd></div>
          <div><dt>รับกลับ</dt><dd>{formatDay(booking.checkOut)}</dd></div>
          <div><dt>คืน</dt><dd>{nights || '—'}</dd></div>
          <div><dt>ยอดชำระ</dt><dd>{booking.total ? baht(booking.total) : '—'}</dd></div>
        </dl>
        <p className="stay-note stay-folio-note">สถานะเข้าพักอัปเดตโดยเจ้าหน้าที่โรงแรม</p>
      </div>
      <aside className="stay-screens" aria-label="จอห้องพัก">
        {cameras === null ? <ScreenShell off title="กำลังตรวจจอ" detail="รอสิทธิ์จากหลังบ้าน" /> : null}
        {cameras && cameras.length === 0 ? (
          <ScreenShell off title="ยังไม่เปิดจอ" detail="เจ้าหน้าที่จะเปิดให้เมื่อให้สิทธิ์กล้อง" />
        ) : null}
        {cameras && cameras.length > 0 ? cameras.map((camera) => (
          <StayScreen key={camera.id} camera={camera} />
        )) : null}
      </aside>
    </article>
  );
}

function ScreenShell({ off, title, detail, live, to, care }) {
  const glass = (
    <span className="stay-screen-glass">
      {live ? <span className="stay-screen-live">LIVE</span> : null}
      <strong>{title}</strong>
      <span>{detail}</span>
    </span>
  );
  if (off || !to) {
    return (
      <div className="stay-screen is-off">
        {glass}
      </div>
    );
  }
  return (
    <Link className="stay-screen" to={to}>
      {glass}
      <span className="stay-screen-cap">เปิดจอนี้</span>
      {care ? <span className="stay-screen-care">{care}</span> : null}
    </Link>
  );
}

function StayScreen({ camera }) {
  const care = useCameraCare(camera.id, true);
  const latest = care.length ? care[care.length - 1] : null;
  const live = camera.isEnabled && camera.streamStatus === 'online';
  const careLine = latest
    ? `${CARE_LABEL[latest.kind] || latest.kind}${latest.note ? ` · ${latest.note}` : ''}`
    : '';
  return (
    <ScreenShell
      title={camera.catName || camera.name || 'จอห้องพัก'}
      detail={camera.roomLabel || 'ไม่ได้ระบุห้อง'}
      live={live}
      to={`/pet-owner/cat-hotel/watch/${camera.id}`}
      care={careLine}
    />
  );
}

export function StayWatchPage() {
  const { cameraId } = useParams();
  const { currentUser } = useAuth();
  const cameras = useStayCameras(currentUser?.email || '');
  const camera = (cameras || []).find((item) => String(item.id) === String(cameraId)) || null;
  const care = useCameraCare(camera?.id, Boolean(camera));

  return (
    <div className="stay-page page-wrap">
      <div className="container">
        <header className="stay-mast">
          <div>
            <p className="stay-kicker">จอห้องพัก</p>
            <h1>{camera ? (camera.catName || camera.name || 'จอห้องพัก') : 'จอห้องพัก'}</h1>
            <p>ภาพและรายละเอียดอัปเดตตามที่เจ้าหน้าที่เปิดให้บัญชีนี้</p>
          </div>
        </header>
        <StayTabs />
        <Link className="stay-back" to="/pet-owner/cat-hotel/bookings">กลับไปใบจอง</Link>
        {cameras === null ? <p className="stay-note">กำลังเปิดจอ</p> : null}
        {cameras && !camera ? (
          <div className="stay-empty">
            <p className="stay-kicker">จอนี้ยังไม่เปิด</p>
            <p>สิทธิ์อาจถูกปิด หรือเจ้าหน้าที่ยังไม่ได้ให้กล้องนี้กับบัญชีของคุณ</p>
          </div>
        ) : null}
        {camera ? (
          <article className="stay-folio stay-watch">
            <div className="stay-folio-main">
              <header className="stay-folio-top">
                <div>
                  <p>{camera.roomLabel || 'ไม่ได้ระบุห้อง'}</p>
                  <strong>{camera.catName || camera.name}</strong>
                </div>
                <span className={`stay-status ${camera.isEnabled ? 'checked_in' : ''}`}>
                  {camera.isEnabled ? 'เปิดจอแล้ว' : 'ปิดจอ'}
                </span>
              </header>
              <dl className="stay-folio-line stay-watch-facts">
                <div><dt>ชื่อจอ</dt><dd>{camera.name || '—'}</dd></div>
                <div><dt>ห้อง</dt><dd>{camera.roomLabel || '—'}</dd></div>
                <div><dt>น้อง</dt><dd>{camera.catName || '—'}</dd></div>
                <div><dt>ดูได้ถึง</dt><dd>{camera.accessEndsAt ? formatWhen(camera.accessEndsAt) : '—'}</dd></div>
              </dl>
              {camera.description ? <p className="stay-note stay-folio-note">{camera.description}</p> : null}
              <h2 className="stay-care-title">บันทึกการดูแลวันนี้</h2>
              {care.length === 0 ? <p className="stay-note">ยังไม่มีบันทึกใหม่ รายการจะขึ้นเมื่อเจ้าหน้าที่อัปเดต</p> : (
                <ul className="stay-care">
                  {care.map((item) => (
                    <li key={item.id}>
                      <span>{CARE_LABEL[item.kind] || item.kind}{item.note ? ` · ${item.note}` : ''}</span>
                      {item.loggedAt ? <time>{formatWhen(item.loggedAt)}</time> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="hotel-watch">
              <Player cameraId={camera.id} mode="customer" />
            </div>
          </article>
        ) : null}
      </div>
    </div>
  );
}
