import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { StayBookPage } from './StayBookPage.jsx';
import TransportPage from './Transport.jsx';
import { usePets } from '../usePets.js';
import { useBookings } from '../useBookings.js';
import { useHotelBookings } from '../useHotelBookings.js';
import {
  BOOKING_SERVICES,
  CLINIC_PHONE,
  clinicServiceLabel,
  clinicServicePrice,
  normalizeServiceCode,
  closureFor,
  fetchClinicAvailability,
  fetchClinicSlots,
  hoursFor,
  hoursSummary,
  todayString,
  useClinicInfo,
} from '../bookingOptions.js';
import HubCheckout from '../components/HubCheckout.jsx';
import {
  clinicPetsFromPetLines,
  createHubLine,
  HUB_CATEGORY_LABEL,
  hubCartTotal,
} from '../hubCart.js';
import { newId } from '../../../shared/utils/storage.js';
import { petPhotoSrc, speciesOf } from '../petUtils.js';
import '../booking-hub.css';

const WEEKDAY_NAMES_TH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const ICON_BY_SERVICE = new Map(BOOKING_SERVICES.map((s) => [s.value, s.icon]));
const BOOKING_SERVICES_HUB = [
  {
    id: 'clinic',
    label: 'นัดคลินิก',
    icon: 'bi-hospital',
    desc: 'ตรวจรักษาและวัคซีน',
  },
  {
    id: 'hotel',
    label: 'โรงแรมสัตว์',
    icon: 'bi-building',
    desc: 'ฝากห้องพัก',
  },
  {
    id: 'transport',
    label: 'รับ–ส่ง',
    icon: 'bi-truck',
    desc: 'เรียกรถรับ–ส่ง',
  },
];

const FLOW_ORDER = BOOKING_SERVICES_HUB.map((s) => s.id);
/** Sentinel until owner picks a vet or clinic assign. */
const VET_UNSET = '_unset';

function initialPickedServices(tab, urlHotelBookingId) {
  if (urlHotelBookingId) return ['clinic'];
  if (BOOKING_SERVICES_HUB.some((t) => t.id === tab)) return [tab];
  return ['clinic'];
}

function baht(value) {
  return `฿${Number(value).toLocaleString('th-TH')}`;
}

function petServiceCodesFromMap(petServices, petId, fallback = 'checkup') {
  const raw = petServices?.[petId];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string' && raw) return [raw];
  return [fallback];
}

function formatClinicPetLinesDetail(petLines) {
  if (!Array.isArray(petLines) || !petLines.length) return '';
  const byPet = new Map();
  for (const line of petLines) {
    const key = line.petName || line.petId;
    if (!byPet.has(key)) byPet.set(key, []);
    byPet.get(key).push(line.serviceLabel);
  }
  return [...byPet.entries()].map(([name, labels]) => `${name}: ${labels.join(', ')}`).join(' · ');
}

const PICK_PREVIEW = {
  clinic: {
    lead: 'เลือกวันที่ แล้วเลือกหมอและเวลาที่ว่าง',
    hint: 'วันที่ → หมอ → เวลา · นัดยืนยันทันที',
  },
  hotel: {
    lead: 'เลือกน้อง ห้อง และวัน — ทีละขั้น',
    hint: 'บันทึกลงตะกร้าก่อนชำระรวม',
  },
  transport: {
    lead: 'กรอกจุดรับ–ส่ง — ถ้ามีนัดคลินิก ระบบเติมปลายทางให้',
    hint: 'กรอกทีละขั้น แล้วยืนยันคำขอรับ–ส่ง',
  },
};

function addDaysKey(dateKey, days) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function shortClosureDate(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

/**
 * Booking — Role: Pet Owner (มะแอ่ว)
 * Book a vet appointment for one of the owner's pets and manage existing bookings.
 * Bookings are saved by /api/pet-owner/bookings and auto-confirmed with an assigned vet (status confirmed).
 */

export function BookingForm({
  pets,
  defaultPetId,
  defaultService,
  onSubmit,
  onSuccess,
  embedded = false,
  hubCheckout = false,
}) {
  const { info, loading: infoLoading } = useClinicInfo();

  const onlineServices = useMemo(
    () =>
      (info?.services ?? []).map((s) => {
        const meta = BOOKING_SERVICES.find((item) => item.value === s.code);
        return {
          value: s.code,
          label: s.label,
          hint: meta?.hint ?? '',
          icon: meta?.icon ?? ICON_BY_SERVICE.get(s.code) ?? 'bi-calendar',
        };
      }),
    [info],
  );

  const initialPetId = pets.some((p) => p.id === defaultPetId)
    ? defaultPetId
    : (pets[0]?.id ?? '');
  const defaultSvc = BOOKING_SERVICES.some((s) => s.value === normalizeServiceCode(defaultService))
    ? normalizeServiceCode(defaultService)
    : 'checkup';
  const [form, setForm] = useState({
    petId: initialPetId,
    petIds: initialPetId ? [initialPetId] : [],
    service: defaultSvc,
    petServices: initialPetId ? { [initialPetId]: [defaultSvc] } : {},
    date: '',
    vetId: VET_UNSET,
    time: '',
    note: '',
  });
  const [error, setError] = useState('');
  const [lastConfirmed, setLastConfirmed] = useState(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [dayAvailability, setDayAvailability] = useState(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [daySlots, setDaySlots] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const dutyVets = dayAvailability?.vetsOnDuty ?? [];
  const vetChosen = form.vetId !== VET_UNSET;
  const selectedPets = useMemo(
    () => pets.filter((p) => form.petIds.includes(p.id)),
    [pets, form.petIds],
  );

  const displayServices = useMemo(() => {
    const refSpecies = selectedPets[0]?.species ?? 'dog';
    return onlineServices.map((s) => {
      const price = clinicServicePrice(s.value, refSpecies);
      return {
        ...s,
        label: clinicServiceLabel(s.value, refSpecies),
        price,
        priceLabel: baht(price),
      };
    });
  }, [onlineServices, selectedPets]);

  const hubServicesTotal = useMemo(
    () =>
      selectedPets.reduce((sum, pet) => {
        const codes = petServiceCodesFromMap(form.petServices, pet.id);
        return sum + codes.reduce((lineSum, code) => lineSum + clinicServicePrice(code, pet.species), 0);
      }, 0),
    [selectedPets, form.petServices],
  );

  function toggleHubPet(id) {
    setDone(false);
    setLastConfirmed(null);
    setForm((f) => {
      const has = f.petIds.includes(id);
      const nextIds = has
        ? f.petIds.filter((x) => x !== id)
        : [...f.petIds, id];
      const nextServices = { ...f.petServices };
      if (has) {
        delete nextServices[id];
      } else {
        nextServices[id] = [f.service || 'checkup'];
      }
      return {
        ...f,
        petIds: nextIds,
        petId: nextIds[0] || '',
        petServices: nextServices,
      };
    });
  }

  function togglePetService(petId, service) {
    setDone(false);
    setLastConfirmed(null);
    setForm((f) => {
      const current = petServiceCodesFromMap(f.petServices, petId);
      const has = current.includes(service);
      if (has && current.length <= 1) return f;
      const next = has ? current.filter((code) => code !== service) : [...current, service];
      return {
        ...f,
        petServices: { ...f.petServices, [petId]: next },
      };
    });
  }

  function setSinglePet(e) {
    const petId = e.target.value;
    setDone(false);
    setLastConfirmed(null);
    setForm((f) => ({ ...f, petId, petIds: petId ? [petId] : [] }));
  }

  useEffect(() => {
    if (!form.date) {
      setDayAvailability(null);
      return undefined;
    }
    let cancelled = false;
    setAvailabilityLoading(true);
    fetchClinicAvailability(form.date).then((result) => {
      if (!cancelled) {
        setDayAvailability(result);
        setAvailabilityLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [form.date]);

  useEffect(() => {
    if (!form.date || !vetChosen) {
      setDaySlots(null);
      return undefined;
    }
    let cancelled = false;
    setSlotsLoading(true);
    const vetParam = form.vetId === VET_UNSET ? '' : form.vetId;
    fetchClinicSlots(form.date, vetParam).then((result) => {
      if (!cancelled) {
        setDaySlots(
          result ?? {
            bookable: false,
            reason: 'ไม่สามารถโหลดช่วงเวลาได้ ลองใหม่อีกครั้ง',
            slots: [],
          },
        );
        setSlotsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [form.date, form.vetId, vetChosen]);

  // When live clinic info arrives, clear any selected service/time that is no longer available
  useEffect(() => {
    if (infoLoading) return;
    setForm((prev) => {
      const nextService = onlineServices.some((s) => s.value === prev.service)
        ? prev.service
        : (onlineServices[0]?.value ?? '');
      const validSlots = daySlots?.slots ?? [];
      const nextTime =
        prev.date && prev.time && validSlots.includes(prev.time) ? prev.time : '';
      if (nextService === prev.service && nextTime === prev.time) return prev;
      return { ...prev, service: nextService, time: nextTime };
    });
  }, [info, infoLoading, onlineServices, daySlots?.slots]);

  const disabledRequestedService = useMemo(() => {
    if (infoLoading || !defaultService) return null;
    const code = normalizeServiceCode(defaultService);
    if (onlineServices.some((s) => s.value === code)) return null;
    const match = BOOKING_SERVICES.find((s) => s.value === code);
    return match?.label ?? defaultService;
  }, [infoLoading, defaultService, onlineServices]);

  const set = (key) => (e) => {
    setDone(false);
    setLastConfirmed(null);
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  const slots = useMemo(() => {
    if (!form.date) return [];
    return daySlots?.slots ?? [];
  }, [form.date, daySlots?.slots]);

  const selectedClosure = form.date ? closureFor(form.date, info) : null;
  const selectedHours = form.date ? hoursFor(form.date, info) : null;

  const noSlotMessage = useMemo(() => {
    if (!form.date || slotsLoading) return '';
    if (slots.length > 0) return '';
    if (daySlots?.reason) return daySlots.reason;
    if (selectedClosure) {
      return `คลินิกปิดทำการวันที่เลือก: ${selectedClosure.reason} กรุณาเลือกวันอื่น`;
    }
    if (!selectedHours) {
      const [y, m, d] = form.date.split('-').map(Number);
      const dayName = WEEKDAY_NAMES_TH[new Date(y, m - 1, d).getDay()];
      return `คลินิกไม่เปิดทำการวัน${dayName} กรุณาเลือกวันอื่น`;
    }
    return 'ไม่มีช่วงเวลาว่างในวันนี้ กรุณาเลือกวันอื่น';
  }, [form.date, slots.length, slotsLoading, selectedClosure, selectedHours, daySlots?.reason]);

  const setVet = (e) => {
    const vetId = e.target.value;
    setDone(false);
    setLastConfirmed(null);
    setDaySlots(null);
    setForm((f) => ({ ...f, vetId, time: '' }));
  };

  const setDate = (e) => {
    const date = e.target.value;
    setDone(false);
    setLastConfirmed(null);
    setDaySlots(null);
    setForm((f) => ({
      ...f,
      date,
      vetId: VET_UNSET,
      time: '',
    }));
  };

  const upcomingClosures30d = useMemo(() => {
    const today = todayString();
    const limit30 = addDaysKey(today, 30);
    return (info?.closures ?? []).filter((c) => c.date >= today && c.date <= limit30);
  }, [info]);

  const noServicesAvailable = !infoLoading && onlineServices.length === 0;

  async function handleSubmit(e) {
    e.preventDefault();
    if (noServicesAvailable || !form.service) return setError('ขณะนี้ไม่มีบริการเปิดรับจองออนไลน์');
    if (!form.date) return setError('กรุณาเลือกวันที่');
    if (!vetChosen) return setError('กรุณาเลือกสัตวแพทย์ หรือเลือกให้คลินิกจัดสรร');
    if (!form.time) return setError('กรุณาเลือกเวลา');
    const petIds = hubCheckout ? form.petIds : [form.petId].filter(Boolean);
    if (!petIds.length) return setError('กรุณาเลือกสัตว์เลี้ยงอย่างน้อย 1 ตัว');
    if (hubCheckout) {
      for (const id of petIds) {
        if (!petServiceCodesFromMap(form.petServices, id).length) {
          return setError('กรุณาเลือกบริการอย่างน้อย 1 รายการต่อสัตว์');
        }
      }
    }
    const petLines = hubCheckout
      ? petIds.flatMap((id) => petServiceCodesFromMap(form.petServices, id).map((service) => ({ petId: id, service })))
      : petIds.map((id) => ({ petId: id, service: form.service }));
    setSaving(true);
    setError('');
    try {
      const preferredVet = dutyVets.find((v) => v.id === form.vetId);
      const result = await onSubmit({
        ...form,
        petIds,
        petId: petIds[0],
        petLines,
        vetId: form.vetId === VET_UNSET ? '' : form.vetId,
        vetName: preferredVet?.name ?? '',
      });
      const booking = result?.booking ?? result;
      setLastConfirmed(booking);
      setForm((f) => ({ ...f, date: '', vetId: VET_UNSET, time: '', note: '' }));
      setDone(true);
      onSuccess?.(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className={
        embedded
          ? `booking-form--embed${hubCheckout ? ' booking-form--hub-grid' : ''}`
          : 'card-soft'
      }
      onSubmit={handleSubmit}
    >
      <div className="section-label">
        <i className="bi bi-calendar-plus" />
        จองนัดหมายใหม่
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}
      {done && (
        <div className="alert alert-success py-2">
          {hubCheckout
            ? `บันทึกนัดคลินิกลงตะกร้าแล้ว${
              lastConfirmed?.vetName ? ` (สัตวแพทย์ ${lastConfirmed.vetName})` : ''
            } — ไปสรุปรายการเมื่อครบทุกบริการ`
            : `ยืนยันนัดแล้ว${
              lastConfirmed?.vetName ? ` — สัตวแพทย์ ${lastConfirmed.vetName}` : ''
            }${lastConfirmed?.date && lastConfirmed?.time
              ? ` · ${lastConfirmed.date} ${lastConfirmed.time} น.`
              : ''}`}
        </div>
      )}

      {disabledRequestedService && (
        <div className="alert-soft warn mb-3" role="status">
          <i className="bi bi-info-circle" />
          <span>
            บริการ {disabledRequestedService} ปิดรับจองออนไลน์ชั่วคราว กรุณาโทร {CLINIC_PHONE}
          </span>
        </div>
      )}

      {noServicesAvailable ? (
        <div className="alert-soft warn mb-3" role="status">
          <i className="bi bi-exclamation-triangle" />
          <span>ขณะนี้ปิดรับจองออนไลน์ทุกบริการชั่วคราว กรุณาติดต่อคลินิกโทร {CLINIC_PHONE}</span>
        </div>
      ) : (
        <div className={hubCheckout ? 'booking-form__grid row g-3' : 'row g-3'}>
          {hubCheckout ? (
            <div className="col-12">
              <span className="form-label" id="bk-pets-label">สัตว์เลี้ยง (เลือกได้หลายตัว)</span>
              {pets.length === 0 ? (
                <p className="small text-muted mb-0">ยังไม่มีสัตว์ในโปรไฟล์ — เพิ่มน้องก่อนจอง</p>
              ) : (
                <div
                  className="stay-pet-pick stay-pet-pick--hub booking-form__pet-pick"
                  role="group"
                  aria-labelledby="bk-pets-label"
                >
                  {pets.map((pet) => {
                    const on = form.petIds.includes(pet.id);
                    return (
                      <button
                        key={pet.id}
                        type="button"
                        aria-pressed={on}
                        className={`stay-pet-pick__card stay-pet-pick__card--row${on ? ' stay-pet-pick__card--on' : ''}`}
                        onClick={() => toggleHubPet(pet.id)}
                      >
                        <div className="stay-pet-pick__thumb">
                          <img src={petPhotoSrc(pet)} alt="" loading="lazy" decoding="async" />
                        </div>
                        <div className="stay-pet-pick__body">
                          <strong className="stay-pet-pick__name">{pet.name}</strong>
                          <span className="stay-pet-pick__meta">
                            {speciesOf(pet.species).label}
                            {pet.breed ? ` · ${pet.breed}` : ''}
                          </span>
                        </div>
                        <span className={`stay-pet-pick__tick${on ? ' stay-pet-pick__tick--on' : ''}`} aria-hidden>
                          {on ? <i className="bi bi-check-lg" /> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="form-text text-muted mb-0">
                เลือกแล้ว {form.petIds.length} ตัว — เลือกบริการได้หลายรายการต่อตัวด้านล่าง
              </p>
            </div>
          ) : (
            <div className="col-md-6">
              <label className="form-label" htmlFor="bk-pet">สัตว์เลี้ยง</label>
              <select id="bk-pet" className="form-select" value={form.petId} onChange={setSinglePet}>
                {pets.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
          {hubCheckout ? (
            selectedPets.length > 0 ? (
              <div className="col-12">
                <span className="form-label" id="bk-pet-services-label">บริการต่อสัตว์</span>
                <div className="booking-form__pet-services" aria-labelledby="bk-pet-services-label">
                  {selectedPets.map((pet) => (
                    <div key={pet.id} className="booking-form__pet-service-row">
                      <div className="booking-form__pet-service-head">
                        <strong>{pet.name}</strong>
                        <span className="text-muted small">
                          {speciesOf(pet.species).label}
                          {pet.breed ? ` · ${pet.breed}` : ''}
                        </span>
                      </div>
                      <div
                        className="booking-form__pet-service-choices"
                        role="group"
                        aria-label={`บริการสำหรับ ${pet.name}`}
                      >
                        {onlineServices.map((s) => {
                          const on = petServiceCodesFromMap(form.petServices, pet.id).includes(s.value);
                          const isTriage = s.value === 'triage';
                          return (
                            <label
                              key={s.value}
                              className={[
                                'booking-form__pet-service-card',
                                on ? 'booking-form__pet-service-card--on' : '',
                                isTriage ? 'booking-form__pet-service-card--triage' : '',
                              ].filter(Boolean).join(' ')}
                            >
                              <input
                                type="checkbox"
                                className="booking-form__pet-service-card__input"
                                checked={on}
                                onChange={() => togglePetService(pet.id, s.value)}
                              />
                              <span className="booking-form__pet-service-card__icon" aria-hidden>
                                <i className={`bi ${s.icon}`} />
                              </span>
                              <span className="booking-form__pet-service-card__body">
                                <span className="booking-form__pet-service-card__title">
                                  {clinicServiceLabel(s.value, pet.species)}
                                </span>
                                {s.hint ? (
                                  <span className="booking-form__pet-service-card__hint">{s.hint}</span>
                                ) : null}
                                <span className="booking-form__pet-service-card__price">
                                  {baht(clinicServicePrice(s.value, pet.species))}
                                </span>
                              </span>
                              <span className="booking-form__pet-service-card__tick" aria-hidden>
                                {on ? <i className="bi bi-check-lg" /> : null}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="form-text text-muted mb-0">
                  รวมประมาณ <strong>{baht(hubServicesTotal)}</strong>
                </p>
              </div>
            ) : null
          ) : (
            <div className="col-md-6">
              <label className="form-label" htmlFor="bk-service">บริการ</label>
              <select id="bk-service" className="form-select" value={form.service} onChange={set('service')}>
                {displayServices.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                    {' · '}
                    {s.priceLabel ?? baht(s.price)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className={hubCheckout ? 'col-12 col-lg-6' : 'col-md-6'}>
            <label className="form-label" htmlFor="bk-date">วันที่</label>
            <input
              id="bk-date"
              type="date"
              className="form-control"
              min={todayString()}
              value={form.date}
              onChange={setDate}
            />
            {availabilityLoading && form.date && (
              <div className="form-text text-muted">กำลังตรวจสอบหมอเข้าเวร...</div>
            )}
            {form.date && dayAvailability?.bookable === false && dayAvailability?.reason && (
              <div className="form-text text-danger">{dayAvailability.reason}</div>
            )}
          </div>
          <div className={hubCheckout ? 'col-12 col-lg-6' : 'col-md-6'}>
            <label className="form-label" htmlFor="bk-vet">สัตวแพทย์ที่ต้องการ</label>
            <select
              id="bk-vet"
              className="form-select"
              value={form.vetId}
              onChange={setVet}
              disabled={!form.date || dayAvailability?.bookable === false}
            >
              <option value={VET_UNSET} disabled>
                {!form.date ? 'เลือกวันที่ก่อน' : 'เลือกสัตวแพทย์'}
              </option>
              {form.date && dayAvailability?.bookable !== false ? (
                <>
                  <option value="">ให้คลินิกจัดสรร</option>
                  {dutyVets.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </>
              ) : null}
            </select>
          </div>
          <div className={hubCheckout ? 'col-12 col-lg-6' : 'col-md-6'}>
            <label className="form-label" htmlFor="bk-time">เวลา</label>
            <select
              id="bk-time"
              className="form-select"
              value={form.time}
              onChange={set('time')}
              disabled={!vetChosen || !form.date || slotsLoading || slots.length === 0}
            >
              <option value="">
                {!form.date
                  ? 'เลือกวันที่ก่อน'
                  : !vetChosen
                    ? 'เลือกสัตวแพทย์ก่อน'
                    : slotsLoading
                      ? 'กำลังโหลด...'
                      : 'เลือกเวลา'}
              </option>
              {slots.map((t) => (
                <option key={t} value={t}>{t} น.</option>
              ))}
            </select>
            {noSlotMessage && <div className="form-text text-danger">{noSlotMessage}</div>}
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="bk-note">อาการ / หมายเหตุ</label>
            <textarea
              id="bk-note"
              rows={3}
              maxLength={500}
              className="form-control"
              placeholder="ไม่บังคับ เช่น อาการที่พบ หรือสิ่งที่อยากให้หมอตรวจเป็นพิเศษ"
              value={form.note}
              onChange={set('note')}
            />
          </div>
        </div>
      )}

      <div className="small text-muted mt-3">
        <i className="bi bi-clock me-1" />
        {hoursSummary(info).join(' · ')}
        {upcomingClosures30d.length > 0 && (
          <>
            <br />
            <i className="bi bi-calendar-x me-1" />
            วันปิดทำการ:{' '}
            {upcomingClosures30d
              .map((c) => `${shortClosureDate(c.date)} (${c.reason || 'ปิดทำการ'})`)
              .join(', ')}
          </>
        )}
        <br />
        <i className="bi bi-exclamation-triangle me-1" />
        กรณีฉุกเฉิน (เปิด 24 ชั่วโมง) กรุณาโทร {CLINIC_PHONE} ไม่ต้องจองล่วงหน้า
      </div>

      <div className="text-end mt-3">
        <button type="submit" className="btn btn-sky" disabled={saving || noServicesAvailable}>
          <i className="bi bi-check2 me-1" />
          {saving ? 'กำลังส่ง...' : hubCheckout ? 'บันทึกลงรายการ' : 'ยืนยันการจอง'}
        </button>
      </div>
    </form>
  );
}

function HubPanel({ title, lead, variant = 'default', children }) {
  const minimal = variant === 'minimal';
  return (
    <section className={`booking-hub__panel${minimal ? ' booking-hub__panel--minimal' : ''}`}>
      {!minimal && (title || lead) ? (
        <header className="booking-hub__panel-head">
          <div>
            {title ? <h2 className="booking-hub__panel-title">{title}</h2> : null}
            {lead ? <p className="booking-hub__panel-lead">{lead}</p> : null}
          </div>
        </header>
      ) : null}
      {children}
    </section>
  );
}

function HubCartBar({ lines, onRemove, onCheckout, onAddMore, dockOnMobile = false }) {
  const total = hubCartTotal(lines);
  return (
    <section
      className={`booking-hub__cart${dockOnMobile ? ' booking-hub__cart--dock' : ''}`}
      aria-label="ตะกร้าจองบริการ"
    >
      <h2 className="booking-hub__cart-title">ตะกร้า ({lines.length} รายการ)</h2>
      <ul className="booking-hub__cart-list">
        {lines.map((line) => (
          <li key={line.id} className="booking-hub__cart-item">
            <div>
              <span className="booking-hub__cart-kind">{HUB_CATEGORY_LABEL[line.category]}</span>
              <strong className="d-block">{line.label}</strong>
              {line.detail ? <span className="small text-muted">{line.detail}</span> : null}
            </div>
            <div className="booking-hub__cart-item-end">
              <span>{baht(line.total)}</span>
              <button type="button" className="btn btn-link btn-sm text-danger p-0" onClick={() => onRemove(line.id)}>
                ลบ
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="booking-hub__cart-sum">
        <span>รวมประมาณ {baht(total)}</span>
      </div>
      <div className="booking-hub__cart-actions">
        <button type="button" className="btn btn-soft" onClick={onAddMore}>เพิ่มบริการอื่น</button>
        <button type="button" className="btn btn-sky" onClick={onCheckout} disabled={!lines.length}>
          สรุปรายการ
        </button>
      </div>
    </section>
  );
}

export default function BookingPage() {
  const navigate = useNavigate();
  const [params, setSearchParams] = useSearchParams();
  const tabParam = params.get('tab');
  const { pets, loading: petsLoading, error: petsError } = usePets();
  const { error, reload, addBooking } = useBookings();
  const { bookings: hotelBookings, linkRelatedBooking } = useHotelBookings();
  const urlHotelBookingId = params.get('hotelBookingId') || '';
  const [hubHotelId, setHubHotelId] = useState(urlHotelBookingId);
  const [lastClinicBooking, setLastClinicBooking] = useState(null);
  const initialPicked = initialPickedServices(tabParam, urlHotelBookingId);
  const [currentStep, setCurrentStep] = useState(() => (urlHotelBookingId ? 'clinic' : initialPicked[0]));
  const [pickedServices, setPickedServices] = useState(initialPicked);
  const [flowQueue, setFlowQueue] = useState(() => (urlHotelBookingId ? ['clinic'] : []));
  const [hubPhase, setHubPhase] = useState(() => (urlHotelBookingId ? 'flow' : 'pick'));
  const [hubCart, setHubCart] = useState([]);
  const [hubSessionId, setHubSessionId] = useState(() => newId());
  const [cartNotice, setCartNotice] = useState('');

  const flowIndex = flowQueue.indexOf(currentStep);

  useEffect(() => {
    setHubHotelId(urlHotelBookingId);
  }, [urlHotelBookingId]);

  const effectiveHotelId = hubHotelId || urlHotelBookingId;
  const hubHotelInCart = useMemo(
    () => Boolean(
      effectiveHotelId
      && hubCart.some((line) => line.category === 'hotel' && line.refId === effectiveHotelId),
    ),
    [effectiveHotelId, hubCart],
  );
  /** Legacy local hotel rows only — Hub stays live in cart/API, not hotelBookings. */
  const transportHotelBookingId = hubHotelInCart ? '' : effectiveHotelId;
  const stepMeta = BOOKING_SERVICES_HUB.find((s) => s.id === currentStep);
  const inFlow = hubPhase === 'flow';
  const inCheckout = hubPhase === 'checkout';
  const inPick = hubPhase === 'pick';

  function togglePickedService(id) {
    setPickedServices((current) => {
      if (current.includes(id)) {
        if (current.length <= 1) return current;
        return current.filter((item) => item !== id);
      }
      return FLOW_ORDER.filter((item) => item === id || current.includes(item));
    });
  }

  function goToStep(stepId) {
    setCurrentStep(stepId);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set('tab', stepId);
        return next;
      },
      { replace: true },
    );
  }

  function returnToPick() {
    setHubPhase('pick');
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('tab');
        return next;
      },
      { replace: true },
    );
  }

  function startFlow() {
    const queue = FLOW_ORDER.filter((id) => pickedServices.includes(id));
    if (!queue.length) return;
    const pending = queue.filter((id) => !hubCart.some((line) => line.category === id));
    const firstStep = pending.length ? pending[0] : queue[0];
    setFlowQueue(queue);
    setCartNotice('');
    setHubPhase('flow');
    goToStep(firstStep);
  }

  function advanceAfterLine(completedCategory) {
    const queue = flowQueue.length
      ? flowQueue
      : FLOW_ORDER.filter((id) => pickedServices.includes(id));
    const idx = queue.indexOf(completedCategory);
    const label = HUB_CATEGORY_LABEL[completedCategory] || completedCategory;
    const next = idx >= 0 ? queue[idx + 1] : undefined;
    if (next) {
      setCartNotice(`บันทึก${label}แล้ว — ขั้นถัดไป`);
      setHubPhase('flow');
      goToStep(next);
      return;
    }
    setCartNotice('ครบทุกบริการที่เลือกแล้ว — กดสรุปรายการ');
    setHubPhase('checkout');
  }

  function openCheckout() {
    if (!hubCart.length) return;
    setHubPhase('checkout');
  }

  function openSingleCategoryFlow(category, { removeLineId } = {}) {
    if (removeLineId) {
      setHubCart((current) => current.filter((line) => line.id !== removeLineId));
    }
    setFlowQueue([category]);
    setPickedServices((current) => {
      const categoriesInCart = new Set(
        hubCart
          .filter((line) => line.id !== removeLineId)
          .map((line) => line.category),
      );
      categoriesInCart.add(category);
      return FLOW_ORDER.filter((id) => categoriesInCart.has(id));
    });
    setCartNotice(removeLineId ? 'แก้ไขรายการ — บันทึกเมื่อเสร็จ' : '');
    setHubPhase('flow');
    goToStep(category);
  }

  function editHubCartLine(line) {
    openSingleCategoryFlow(line.category, { removeLineId: line.id });
  }

  function addMissingHubCategory(category) {
    if (hubCart.some((line) => line.category === category)) return;
    openSingleCategoryFlow(category);
  }

  function addHubLine(input) {
    const line = createHubLine(input);
    setHubCart((current) => {
      if (current.some((item) => item.refId === line.refId && item.category === line.category)) {
        return current;
      }
      const withoutSameCategory = current.filter((item) => item.category !== line.category);
      return [...withoutSameCategory, line];
    });
    if (hubPhase === 'flow' && flowQueue.length) {
      advanceAfterLine(input.category);
    } else {
      setCartNotice('บันทึกลงตะกร้าแล้ว เลือกบริการอื่นได้หรือกดสรุปรายการ');
      returnToPick();
    }
  }

  function removeCartLine(lineId) {
    setHubCart((current) => current.filter((line) => line.id !== lineId));
  }

  function onCheckoutPaid() {
    setHubCart([]);
    setHubSessionId(newId());
    setFlowQueue([]);
    setHubPhase('pick');
    setCartNotice('');
    navigate('/pet-owner/history', { replace: true });
  }

  async function addClinicBooking(data) {
    const legacyHotel = effectiveHotelId
      && hotelBookings.some((booking) => booking.id === effectiveHotelId);
    if (effectiveHotelId && !legacyHotel && !hubHotelInCart) {
      throw new Error('ไม่พบการจองโรงแรมที่ต้องการเชื่อม');
    }
    const petIds = Array.isArray(data.petIds) && data.petIds.length
      ? data.petIds
      : [data.petId].filter(Boolean);
    if (!petIds.length) throw new Error('กรุณาเลือกสัตว์เลี้ยง');
    const petLines = Array.isArray(data.petLines) && data.petLines.length
      ? data.petLines
      : petIds.flatMap((id) => {
        const raw = data.petServices?.[id];
        const codes = Array.isArray(raw)
          ? raw
          : (typeof raw === 'string' && raw ? [raw] : [data.service]);
        return codes.map((service) => ({ petId: id, service }));
      });
    const booking = await addBooking({
      ...data,
      petId: petIds[0],
      petIds,
      petLines,
    });
    const totalPrice = petLines.reduce((sum, line) => {
      const pet = pets.find((p) => p.id === line.petId);
      return sum + clinicServicePrice(line.service, pet?.species);
    }, 0);
    if (effectiveHotelId && legacyHotel) {
      linkRelatedBooking(effectiveHotelId, {
        kind: 'clinic',
        id: booking.id,
        label: `${booking.serviceLabel || 'นัดคลินิก'} · ${booking.date || data.date}`,
      });
    }
    setLastClinicBooking({
      id: booking.id,
      date: booking.date || data.date,
      time: booking.time || data.time,
      petId: petIds[0],
      petIds,
    });
    return { booking, price: totalPrice, petIds, petLines };
  }

  return (
    <div className="page-wrap booking-hub">
      <div className="container">
        <header className="booking-hub__hero page-head">
          <div className="booking-hub__hero-text">
            <span className="booking-hub__hero-kicker">
              <i className="bi bi-calendar2-check" aria-hidden />
              Hub จองบริการ
            </span>
            <h1>จองบริการ</h1>
            <p>เลือกบริการ กรอกตามลำดับ แล้วสรุปรายการในตะกร้า</p>
          </div>
          <Link to="/pet-owner/history" className="btn btn-soft booking-hub__history">
            <i className="bi bi-clock-history me-1" />
            ประวัติการจอง
          </Link>
        </header>

        {inCheckout ? (
          <HubCheckout
            sessionId={hubSessionId}
            lines={hubCart}
            onBack={() => {
              setHubPhase('pick');
              requestAnimationFrame(() => {
                const hero = document.querySelector('.booking-hub__hero');
                if (hero) {
                  const top = hero.getBoundingClientRect().top + window.scrollY - 12;
                  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
                }
              });
            }}
            onEditLine={editHubCartLine}
            onAddCategory={addMissingHubCategory}
            onPaid={onCheckoutPaid}
          />
        ) : null}

        {!inCheckout && hubCart.length > 0 && !inFlow ? (
          <HubCartBar
            lines={hubCart}
            onRemove={removeCartLine}
            onCheckout={openCheckout}
            onAddMore={() => setHubPhase('pick')}
          />
        ) : null}

        {cartNotice && (inPick || inFlow) ? (
          <div className="alert alert-success py-2 mb-3" role="status">{cartNotice}</div>
        ) : null}

        {!inCheckout && (
        <div className="booking-hub__steps-wrap mb-3">
          {inFlow ? (
            <>
              <div className="booking-hub__progress-head">
                <strong className="booking-hub__progress-title">{stepMeta?.label}</strong>
                <span className="booking-hub__progress-meta">
                  บริการที่ {flowIndex + 1} จาก {flowQueue.length}
                </span>
              </div>
              <div
                className="booking-hub__steps booking-hub__steps--flow"
                role="group"
                aria-label="ลำดับบริการที่เลือก"
              >
                {flowQueue.map((itemId, index) => {
                  const item = BOOKING_SERVICES_HUB.find((s) => s.id === itemId);
                  const active = currentStep === itemId;
                  const done = hubCart.some((line) => line.category === itemId);
                  return (
                    <div
                      key={itemId}
                      className={`booking-hub__step booking-hub__step--static${active ? ' booking-hub__step--active' : ''}${done ? ' booking-hub__step--done' : ''}`}
                      aria-current={active ? 'step' : undefined}
                    >
                      <span className="booking-hub__step-num">
                        {done && !active ? (
                          <i className="bi bi-check-lg" aria-hidden />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <i className={`bi ${item?.icon}`} aria-hidden />
                      <span className="booking-hub__step-label">{item?.label}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : !inFlow ? (
            <>
              <p className="booking-hub__pick-lead" id="booking-service-menu-label">
                เลือกบริการที่ต้องการจอง (เลือกได้มากกว่า 1)
              </p>
              <div
                className="booking-hub__service-menu"
                role="group"
                aria-labelledby="booking-service-menu-label"
              >
                {BOOKING_SERVICES_HUB.map((item) => {
                  const selected = pickedServices.includes(item.id);
                  const preview = PICK_PREVIEW[item.id];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="checkbox"
                      aria-checked={selected}
                      className={`booking-hub__service-card booking-hub__service-card--${item.id}${selected ? ' booking-hub__service-card--active booking-hub__service-card--selected' : ''}`}
                      onClick={() => togglePickedService(item.id)}
                    >
                      {selected ? (
                        <span className="booking-hub__service-card-check" aria-hidden>
                          <i className="bi bi-check-circle-fill" />
                        </span>
                      ) : null}
                      <span className="booking-hub__service-card-icon" aria-hidden>
                        <i className={`bi ${item.icon}`} />
                      </span>
                      <span className="booking-hub__service-card-title">{item.label}</span>
                      <span className="booking-hub__service-card-desc">{item.desc}</span>
                      {selected && preview?.lead && (
                        <span className="booking-hub__service-card-detail">{preview.lead}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="booking-hub__pick-actions">
                <button
                  type="button"
                  className="btn btn-sky"
                  disabled={pickedServices.length === 0}
                  onClick={startFlow}
                >
                  ดำเนินการต่อ
                  {pickedServices.length > 0 ? ` (เลือก ${pickedServices.length} บริการ)` : ''}
                  <i className="bi bi-chevron-right ms-1" />
                </button>
              </div>
            </>
          ) : null}
        </div>
        )}

        {(petsError || error) && inFlow && (
          <div className="alert alert-danger d-flex align-items-center justify-content-between" role="alert">
            <span>{petsError || error}</span>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={reload}>ลองใหม่</button>
          </div>
        )}

        {inCheckout ? null : !inFlow ? null : petsLoading ? (
          <div className="card-soft empty-box">กำลังโหลดข้อมูล...</div>
        ) : pets.length === 0 ? (
          <div className="card-soft empty-box">
            <i className="bi bi-heart" />
            ต้องมีข้อมูลสัตว์เลี้ยงก่อนจึงจะจองได้
            <div className="mt-3">
              <Link to="/pet-owner/my-pets/new" className="btn btn-sky">เพิ่มสัตว์เลี้ยง</Link>
            </div>
          </div>
        ) : (
          <div className="booking-hub__layout">
            <main className="booking-hub__main">
              {effectiveHotelId && currentStep === 'clinic' && (
                <div className="alert-soft mb-3">
                  เชื่อมกับการจองโรงแรมนี้
                  <Link className="ms-2" to={`/pet-owner/cat-hotel/bookings/${effectiveHotelId}`}>
                    ดูรายละเอียดโรงแรม
                  </Link>
                </div>
              )}
              {currentStep === 'hotel' && (
                <HubPanel variant="minimal">
                  <StayBookPage
                    embedded
                    checkoutMode="hub"
                    onHubLine={addHubLine}
                    onBooked={(booking) => {
                      setHubHotelId(booking.id);
                    }}
                  />
                </HubPanel>
              )}

              {currentStep === 'clinic' && (
                <HubPanel variant="minimal">
                  <BookingForm
                    embedded
                    hubCheckout
                    pets={pets}
                    defaultPetId={params.get('petId') || lastClinicBooking?.petId}
                    defaultService={params.get('service')}
                    onSubmit={addClinicBooking}
                    onSuccess={(result) => {
                      const booking = result?.booking || result;
                      if (!booking?.id) return;
                      const price = result?.price ?? (
                        Array.isArray(booking.petLines) && booking.petLines.length
                          ? booking.petLines.reduce((sum, line) => {
                            const p = pets.find((pet) => pet.id === line.petId);
                            return sum + clinicServicePrice(line.service, p?.species);
                          }, 0)
                          : clinicServicePrice(booking.service, pets.find((p) => p.id === booking.petId)?.species)
                      );
                      const label = booking.serviceLabel || 'นัดคลินิก';
                      const serviceDetail = formatClinicPetLinesDetail(booking.petLines)
                        || booking.petLines?.[0]?.serviceLabel
                        || label;
                      const vetNote = booking.vetName
                        ? booking.vetName
                        : 'ให้คลินิกจัดสรร';
                      addHubLine({
                        category: 'clinic',
                        refId: booking.id,
                        label: serviceDetail,
                        clinicPets: clinicPetsFromPetLines(booking.petLines),
                        detail: `${booking.date} ${booking.time} น. · ${vetNote}`,
                        total: price,
                      });
                    }}
                  />
                </HubPanel>
              )}

              {currentStep === 'transport' && (
                <HubPanel variant="minimal">
                  <TransportPage
                    embedded
                    hubCheckout
                    onHubLine={addHubLine}
                    hotelBookingId={transportHotelBookingId}
                    clinicBookingId={lastClinicBooking?.id}
                    clinicPresetDate={lastClinicBooking?.date}
                    clinicPresetTime={lastClinicBooking?.time}
                  />
                </HubPanel>
              )}

              <nav className="booking-hub__nav" aria-label="กลับเมนู">
                <button type="button" className="btn btn-soft" onClick={returnToPick}>
                  <i className="bi bi-chevron-left me-1" />
                  กลับเมนูบริการ
                </button>
              </nav>
            </main>

            {hubCart.length > 0 ? (
              <aside className="booking-hub__aside d-none d-lg-block">
                <HubCartBar
                  lines={hubCart}
                  onRemove={removeCartLine}
                  onCheckout={openCheckout}
                  onAddMore={returnToPick}
                />
              </aside>
            ) : null}

            {hubCart.length > 0 ? (
              <div className="booking-hub__cart-mobile d-lg-none">
                <HubCartBar
                  lines={hubCart}
                  onRemove={removeCartLine}
                  onCheckout={openCheckout}
                  onAddMore={returnToPick}
                  dockOnMobile
                />
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}