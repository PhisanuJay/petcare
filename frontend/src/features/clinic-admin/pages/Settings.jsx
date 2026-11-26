import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DataState, { useCaToast } from '../components/DataState.jsx';
import { caRequest } from '../data/caApi.js';
import {
  DISPLAY_WEEKDAY_ORDER,
  TIME_OPTIONS_30M,
  WEEKDAYS_FULL_TH,
  formatThaiDateTime,
  minus30Minutes,
  timeToMinutes,
} from '../data/format.js';
import { useCaResource } from '../data/useCaResource.js';

const DEFAULT_HOURS = {
  0: { open: '09:00', close: '21:00' },
  1: { open: '08:00', close: '22:00' },
  2: { open: '08:00', close: '22:00' },
  3: { open: '08:00', close: '22:00' },
  4: { open: '08:00', close: '22:00' },
  5: { open: '08:00', close: '22:00' },
  6: { open: '09:00', close: '21:00' },
};

function hoursEqual(a, b) {
  if (!a || !b) return false;
  for (let d = 0; d <= 6; d += 1) {
    const key = String(d);
    const va = a[key];
    const vb = b[key];
    if (va === null && vb === null) continue;
    if (!va || !vb) return false;
    if (va.open !== vb.open || va.close !== vb.close) return false;
  }
  return true;
}

/**
 * Clinic Admin Settings Page — Opening Hours & Online Bookable Services
 * Role: clinic_admin
 */
export default function Settings() {
  const { data: settings, setData, loading, error, reload } = useCaResource('/settings');
  const { show, toast } = useCaToast();

  const [draftHours, setDraftHours] = useState(null);
  const [hoursError, setHoursError] = useState('');
  const [hoursSaving, setHoursSaving] = useState(false);

  const [togglingService, setTogglingService] = useState('');
  const [servicesError, setServicesError] = useState('');

  useEffect(() => {
    if (settings?.hours) {
      setDraftHours(structuredClone(settings.hours));
    }
  }, [settings]);

  const hoursDirty = useMemo(
    () => Boolean(settings?.hours && draftHours && !hoursEqual(settings.hours, draftHours)),
    [settings, draftHours],
  );

  const rowErrors = useMemo(() => {
    const map = {};
    if (!draftHours) return map;
    for (let d = 0; d <= 6; d += 1) {
      const key = String(d);
      const val = draftHours[key];
      if (!val) continue;
      if (timeToMinutes(val.close) - timeToMinutes(val.open) < 30) {
        map[key] = 'เวลาปิดต้องหลังเวลาเปิดอย่างน้อย 30 นาที';
      }
    }
    return map;
  }, [draftHours]);

  const hasRowErrors = Object.keys(rowErrors).length > 0;

  function toggleDayOpen(dayKey, isOpen) {
    setHoursError('');
    setDraftHours((prev) => ({
      ...prev,
      [dayKey]: isOpen ? { ...DEFAULT_HOURS[dayKey] } : null,
    }));
  }

  function changeDayTime(dayKey, field, value) {
    setHoursError('');
    setDraftHours((prev) => ({
      ...prev,
      [dayKey]: { ...prev[dayKey], [field]: value },
    }));
  }

  function copyMondayToWeekdays() {
    if (!draftHours) return;
    setHoursError('');
    const mon = draftHours['1'] ? { ...draftHours['1'] } : null;
    setDraftHours((prev) => ({
      ...prev,
      2: mon ? { ...mon } : null,
      3: mon ? { ...mon } : null,
      4: mon ? { ...mon } : null,
      5: mon ? { ...mon } : null,
    }));
  }

  function fillDefaultHours() {
    setHoursError('');
    setDraftHours(structuredClone(DEFAULT_HOURS));
  }

  async function handleSaveHours(e) {
    e.preventDefault();
    if (!draftHours || hasRowErrors) return;
    setHoursError('');
    setHoursSaving(true);
    try {
      await caRequest('/settings/hours', {
        method: 'PUT',
        body: JSON.stringify({ hours: draftHours }),
      });
      await reload();
      show('บันทึกเวลาทำการแล้ว');
    } catch (err) {
      setHoursError(err.message);
    } finally {
      setHoursSaving(false);
    }
  }

  async function handleToggleService(service) {
    if (!settings) return;
    const nextOnline = !service.online;
    setServicesError('');
    setTogglingService(service.code);

    const previous = settings.services;
    setData((prev) =>
      prev
        ? {
            ...prev,
            services: prev.services.map((s) =>
              s.code === service.code ? { ...s, online: nextOnline } : s,
            ),
          }
        : prev,
    );

    try {
      const updatedList = await caRequest('/settings/services', {
        method: 'PUT',
        body: JSON.stringify({ services: { [service.code]: nextOnline } }),
      });
      setData((prev) =>
        prev
          ? {
              ...prev,
              services: updatedList,
              updatedAt: new Date().toISOString(),
            }
          : prev,
      );
      show(
        nextOnline
          ? `เปิดรับจองบริการ "${service.label}" แล้ว`
          : `ปิดรับจองบริการ "${service.label}" แล้ว`,
      );
    } catch (err) {
      setData((prev) => (prev ? { ...prev, services: previous } : prev));
      setServicesError(err.message);
    } finally {
      setTogglingService('');
    }
  }

  const mondayCloseExample = draftHours?.['1']?.close
    ? `เช่น วันจันทร์ปิด ${draftHours['1'].close} → ช่วงจองสุดท้ายคือ ${minus30Minutes(draftHours['1'].close)}`
    : '';

  return (
    <div>
      {toast}

      <div className="page-head">
        <div>
          <h1 className="mitr">ตั้งค่าคลินิก</h1>
          <p>
            กำหนดเวลาทำการแต่ละวัน และบริการที่เปิดให้เจ้าของสัตว์จองออนไลน์
            {settings?.updatedAt && (
              <span className="ms-2">· แก้ไขล่าสุด {formatThaiDateTime(settings.updatedAt)}</span>
            )}
          </p>
        </div>
      </div>

      <DataState loading={loading} error={error} onRetry={reload} hasData={Boolean(settings)}>
        {settings && draftHours && (
          <div className="d-grid gap-4">
            {/* Opening hours */}
            <form className="card-soft" onSubmit={handleSaveHours} noValidate>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <div className="section-label mb-0">
                    <i className="bi bi-clock" aria-hidden="true" />
                    <span>ก. เวลาทำการ</span>
                  </div>
                  {hoursDirty && <span className="tag warn">ยังไม่ได้บันทึก</span>}
                </div>

                <div className="d-flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-soft btn-sm"
                    disabled={hoursSaving}
                    onClick={copyMondayToWeekdays}
                  >
                    คัดลอกเวลา จ. ไปทุกวันธรรมดา
                  </button>
                  <button
                    type="button"
                    className="btn btn-soft btn-sm"
                    disabled={hoursSaving}
                    onClick={fillDefaultHours}
                  >
                    คืนค่าเริ่มต้น
                  </button>
                </div>
              </div>

              {hoursError && (
                <div className="alert-soft danger mb-3" role="alert">
                  <i className="bi bi-exclamation-circle" aria-hidden="true" />
                  <span>{hoursError}</span>
                </div>
              )}

              <div className="d-grid gap-2 mb-3">
                {DISPLAY_WEEKDAY_ORDER.map((day) => {
                  const key = String(day);
                  const val = draftHours[key];
                  const isOpen = val !== null;
                  const rowErr = rowErrors[key];

                  return (
                    <div key={key} className="ca-hours-row">
                      <div className="d-flex align-items-center gap-3">
                        <div className="form-check form-switch mb-0">
                          <input
                            id={`ca-hour-switch-${key}`}
                            type="checkbox"
                            className="form-check-input"
                            checked={isOpen}
                            onChange={(e) => toggleDayOpen(key, e.target.checked)}
                          />
                          <label
                            className="form-check-label fw-medium"
                            htmlFor={`ca-hour-switch-${key}`}
                          >
                            {WEEKDAYS_FULL_TH[day]}
                          </label>
                        </div>
                        <span className={`tag ${isOpen ? 'ok' : 'danger'}`}>
                          {isOpen ? 'เปิดทำการ' : 'ปิดทำการ'}
                        </span>
                      </div>

                      <div>
                        <div className="ca-hours-times">
                          <label className="small text-muted mb-0" htmlFor={`ca-open-${key}`}>
                            เปิด
                          </label>
                          <select
                            id={`ca-open-${key}`}
                            className="form-select form-select-sm ca-hours-select"
                            disabled={!isOpen || hoursSaving}
                            value={val?.open ?? DEFAULT_HOURS[key].open}
                            onChange={(e) => changeDayTime(key, 'open', e.target.value)}
                          >
                            {TIME_OPTIONS_30M.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>

                          <span className="text-muted">–</span>

                          <label className="small text-muted mb-0" htmlFor={`ca-close-${key}`}>
                            ปิด
                          </label>
                          <select
                            id={`ca-close-${key}`}
                            className="form-select form-select-sm ca-hours-select"
                            disabled={!isOpen || hoursSaving}
                            value={val?.close ?? DEFAULT_HOURS[key].close}
                            onChange={(e) => changeDayTime(key, 'close', e.target.value)}
                          >
                            {TIME_OPTIONS_30M.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>
                        {rowErr && (
                          <div className="small text-danger mt-1" role="alert">
                            {rowErr}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div className="small text-muted">
                  <i className="bi bi-info-circle me-1" aria-hidden="true" />
                  ช่วงจองสุดท้ายของวัน = เวลาปิด − 30 นาที
                  {mondayCloseExample ? ` (${mondayCloseExample})` : ''}
                </div>
                <button
                  type="submit"
                  className="btn btn-sky"
                  disabled={hoursSaving || hasRowErrors || !hoursDirty}
                >
                  {hoursSaving && (
                    <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
                  )}
                  บันทึกเวลาทำการ
                </button>
              </div>
            </form>

            {/* Online Services */}
            <div className="card-soft">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                <div className="section-label mb-0">
                  <i className="bi bi-toggle-on" aria-hidden="true" />
                  <span>ข. บริการที่เปิดให้จองออนไลน์</span>
                </div>
                <Link className="btn btn-soft btn-sm" to="/clinic-admin/services">
                  จัดการบริการและราคา
                </Link>
              </div>

              {servicesError && (
                <div className="alert-soft danger mb-3" role="alert">
                  <i className="bi bi-exclamation-circle" aria-hidden="true" />
                  <span>{servicesError}</span>
                </div>
              )}

              <div className="d-grid gap-2 mb-3">
                {(settings.services ?? []).map((svc) => {
                  const busy = togglingService === svc.code;
                  return (
                    <div key={svc.code} className="ca-list-item">
                      <div>
                        <div className="fw-medium">{svc.label}</div>
                        <div className="small text-muted">
                          {svc.online ? 'เปิดรับจองออนไลน์' : 'ปิดรับจองออนไลน์ชั่วคราว'}
                        </div>
                      </div>
                      <div className="form-check form-switch mb-0 d-flex align-items-center gap-2">
                        {busy && (
                          <span
                            className="spinner-border spinner-border-sm text-primary"
                            aria-hidden="true"
                          />
                        )}
                        <input
                          id={`ca-svc-${svc.code}`}
                          type="checkbox"
                          className="form-check-input"
                          checked={svc.online}
                          disabled={Boolean(togglingService)}
                          onChange={() => handleToggleService(svc)}
                        />
                        <label className="form-check-label small" htmlFor={`ca-svc-${svc.code}`}>
                          {svc.online ? 'เปิดรับจอง' : 'ปิดรับจอง'}
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="small text-muted mb-0">
                <i className="bi bi-info-circle me-1" aria-hidden="true" />
                ปิดแล้วเจ้าของสัตว์จะจองบริการนี้ออนไลน์ไม่ได้ นัดที่จองไว้แล้วยังอยู่ตามเดิม
              </p>
            </div>
          </div>
        )}
      </DataState>
    </div>
  );
}
