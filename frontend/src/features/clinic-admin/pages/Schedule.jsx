import { useMemo, useState } from 'react';
import CaModal from '../components/CaModal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import DataState, { useCaToast } from '../components/DataState.jsx';
import { caRequest } from '../data/caApi.js';
import {
  DISPLAY_WEEKDAY_ORDER,
  WEEKDAYS_FULL_TH,
  WEEKDAYS_TH,
  formatThaiDate,
  todayKey,
} from '../data/format.js';
import { useCaResource } from '../data/useCaResource.js';

function sameWeekdays(a = [], b = []) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, idx) => v === sb[idx]);
}

/**
 * Clinic Admin Schedule Page — Vet Roster, Leaves, and Clinic Closures
 * Role: clinic_admin
 */
export default function Schedule() {
  const {
    data: roster,
    loading: rosterLoading,
    error: rosterError,
    reload: reloadRoster,
  } = useCaResource('/roster');
  const {
    data: closures,
    loading: closuresLoading,
    error: closuresError,
    reload: reloadClosures,
  } = useCaResource('/closures');
  const { show, toast } = useCaToast();

  const today = todayKey();

  // Roster weekday drafts keyed by vet.id
  const [draftWeekdays, setDraftWeekdays] = useState({});
  const [savingVetId, setSavingVetId] = useState('');
  const [emptyWeekdaysConfirm, setEmptyWeekdaysConfirm] = useState(null);
  const [rosterActionError, setRosterActionError] = useState('');

  // Leaves
  const [showPastLeaves, setShowPastLeaves] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    staffId: '',
    from: today,
    to: today,
    note: '',
  });
  const [leaveError, setLeaveError] = useState('');
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [leaveWarnMsg, setLeaveWarnMsg] = useState('');
  const [deleteLeaveTarget, setDeleteLeaveTarget] = useState(null);
  const [deleteLeaveError, setDeleteLeaveError] = useState('');
  const [deleteLeaveSaving, setDeleteLeaveSaving] = useState(false);

  // Closures
  const [closureDate, setClosureDate] = useState('');
  const [closureReason, setClosureReason] = useState('');
  const [closureFormError, setClosureFormError] = useState('');
  const [closureSaving, setClosureSaving] = useState(false);
  const [closureWarnMsg, setClosureWarnMsg] = useState('');
  const [deleteClosureTarget, setDeleteClosureTarget] = useState(null);
  const [deleteClosureError, setDeleteClosureError] = useState('');
  const [deleteClosureSaving, setDeleteClosureSaving] = useState(false);

  function getDisplayedWeekdays(vet) {
    return draftWeekdays[vet.id] ?? vet.weekdays ?? [];
  }

  function toggleWeekday(vet, day) {
    setRosterActionError('');
    const current = getDisplayedWeekdays(vet);
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort((a, b) => a - b);
    setDraftWeekdays((prev) => ({ ...prev, [vet.id]: next }));
  }

  function cancelDraft(vetId) {
    setDraftWeekdays((prev) => {
      const next = { ...prev };
      delete next[vetId];
      return next;
    });
  }

  async function commitWeekdays(vet, weekdays) {
    setRosterActionError('');
    setSavingVetId(vet.id);
    try {
      await caRequest(`/roster/${vet.id}/weekdays`, {
        method: 'PUT',
        body: JSON.stringify({ weekdays }),
      });
      cancelDraft(vet.id);
      await reloadRoster();
      show(`บันทึกตารางเวร ${vet.name} แล้ว`);
    } catch (err) {
      setRosterActionError(err.message);
    } finally {
      setSavingVetId('');
    }
  }

  function handleSaveRow(vet) {
    const weekdays = getDisplayedWeekdays(vet);
    if (weekdays.length === 0) {
      setEmptyWeekdaysConfirm({ vet, weekdays });
      return;
    }
    commitWeekdays(vet, weekdays);
  }

  const allLeaves = useMemo(() => {
    const items = [];
    for (const vet of roster ?? []) {
      for (const leave of vet.leaves ?? []) {
        items.push({ ...leave, vetId: vet.id, vetName: vet.name });
      }
    }
    return items.sort((a, b) => a.from.localeCompare(b.from));
  }, [roster]);

  const visibleLeaves = useMemo(
    () => (showPastLeaves ? allLeaves : allLeaves.filter((l) => l.to >= today)),
    [allLeaves, showPastLeaves, today],
  );
  const hasPastLeaves = useMemo(() => allLeaves.some((l) => l.to < today), [allLeaves, today]);

  function openLeaveModal() {
    setLeaveForm({
      staffId: roster?.[0]?.id ?? '',
      from: today,
      to: today,
      note: '',
    });
    setLeaveError('');
    setLeaveModalOpen(true);
  }

  async function handleCreateLeave(e) {
    e.preventDefault();
    setLeaveError('');
    if (!leaveForm.staffId) {
      setLeaveError('กรุณาเลือกสัตวแพทย์');
      return;
    }
    if (!leaveForm.from || !leaveForm.to) {
      setLeaveError('กรุณาระบุวันเริ่มต้นและวันสิ้นสุด');
      return;
    }
    if (leaveForm.to < leaveForm.from) {
      setLeaveError('วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น');
      return;
    }

    setLeaveSaving(true);
    try {
      const created = await caRequest(`/roster/${leaveForm.staffId}/leaves`, {
        method: 'POST',
        body: JSON.stringify({
          from: leaveForm.from,
          to: leaveForm.to,
          note: leaveForm.note.trim(),
        }),
      });
      setLeaveModalOpen(false);
      await reloadRoster();
      show('เพิ่มวันลาแล้ว');
      if (created.affectedBookings > 0) {
        setLeaveWarnMsg(
          `หมอมีนัดที่ยืนยันแล้ว ${created.affectedBookings} รายการในช่วงลา แจ้งผู้ช่วยฯ ให้เปลี่ยนหมอหรือเลื่อนนัด`,
        );
      } else {
        setLeaveWarnMsg('');
      }
    } catch (err) {
      setLeaveError(err.message);
    } finally {
      setLeaveSaving(false);
    }
  }

  async function handleConfirmDeleteLeave() {
    if (!deleteLeaveTarget) return;
    setDeleteLeaveError('');
    setDeleteLeaveSaving(true);
    try {
      await caRequest(`/roster/${deleteLeaveTarget.vetId}/leaves/${deleteLeaveTarget.id}`, {
        method: 'DELETE',
      });
      setDeleteLeaveTarget(null);
      await reloadRoster();
      show('ลบวันลาแล้ว');
    } catch (err) {
      setDeleteLeaveError(err.message);
    } finally {
      setDeleteLeaveSaving(false);
    }
  }

  async function handleCreateClosure(e) {
    e.preventDefault();
    setClosureFormError('');
    if (!closureDate) {
      setClosureFormError('กรุณาเลือกวันที่ต้องการปิดคลินิก');
      return;
    }
    if (closureDate < today) {
      setClosureFormError('ไม่สามารถเพิ่มวันปิดคลินิกย้อนหลังได้');
      return;
    }

    setClosureSaving(true);
    try {
      const created = await caRequest('/closures', {
        method: 'POST',
        body: JSON.stringify({
          date: closureDate,
          reason: closureReason.trim() || undefined,
        }),
      });
      setClosureDate('');
      setClosureReason('');
      await Promise.all([reloadClosures(), reloadRoster()]);
      show('เพิ่มวันปิดคลินิกแล้ว');
      if (created.affectedBookings > 0) {
        setClosureWarnMsg(
          `มีนัดเดิม ${created.affectedBookings} รายการในวันนี้ ระบบจะไม่ยกเลิกให้อัตโนมัติ ผู้ช่วยฯ จะเห็นป้ายเตือนเพื่อโทรเลื่อนนัด`,
        );
      } else {
        setClosureWarnMsg('');
      }
    } catch (err) {
      setClosureFormError(err.message);
    } finally {
      setClosureSaving(false);
    }
  }

  async function handleConfirmDeleteClosure() {
    if (!deleteClosureTarget) return;
    setDeleteClosureError('');
    setDeleteClosureSaving(true);
    try {
      await caRequest(`/closures/${deleteClosureTarget.date}`, { method: 'DELETE' });
      setDeleteClosureTarget(null);
      await Promise.all([reloadClosures(), reloadRoster()]);
      show('ลบวันปิดคลินิกแล้ว');
    } catch (err) {
      setDeleteClosureError(err.message);
    } finally {
      setDeleteClosureSaving(false);
    }
  }

  return (
    <div>
      {toast}

      <div className="page-head">
        <div>
          <h1 className="mitr">ตารางเวรและวันหยุด</h1>
          <p>กำหนดวันเข้าเวรประจำสัปดาห์ วันลาสัตวแพทย์ และวันปิดทำการคลินิก</p>
        </div>
      </div>

      <div className="d-grid gap-4">
        {/* Section A: Vet Roster & Leaves */}
        <div className="card-soft">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <div className="section-label mb-0">
              <i className="bi bi-calendar-week" aria-hidden="true" />
              <span>ตารางเวรหมอประจำสัปดาห์</span>
            </div>
            <button
              type="button"
              className="btn btn-sky btn-sm"
              disabled={!roster || roster.length === 0}
              onClick={openLeaveModal}
            >
              <i className="bi bi-plus-lg me-1" aria-hidden="true" />
              เพิ่มวันลา
            </button>
          </div>

          {rosterActionError && (
            <div className="alert-soft danger mb-3" role="alert">
              <i className="bi bi-exclamation-circle" aria-hidden="true" />
              <span>{rosterActionError}</span>
            </div>
          )}

          {leaveWarnMsg && (
            <div className="alert-soft warn justify-content-between mb-3" role="status">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-exclamation-triangle-fill flex-shrink-0" aria-hidden="true" />
                <span>{leaveWarnMsg}</span>
              </div>
              <button
                type="button"
                className="btn-close"
                aria-label="ปิดคำเตือน"
                onClick={() => setLeaveWarnMsg('')}
              />
            </div>
          )}

          <DataState
            loading={rosterLoading}
            error={rosterError}
            onRetry={reloadRoster}
            hasData={Boolean(roster)}
            empty={Boolean(roster && roster.length === 0)}
            emptyIcon="bi-person-badge"
            emptyText="ยังไม่มีบัญชีสัตวแพทย์ที่เปิดใช้งาน"
          >
            {roster && roster.length > 0 && (
              <>
                <div className="table-responsive">
                  <table className="ca-table">
                    <thead>
                      <tr>
                        <th>สัตวแพทย์</th>
                        {DISPLAY_WEEKDAY_ORDER.map((day) => (
                          <th key={day} className="text-center">
                            {WEEKDAYS_TH[day]}
                          </th>
                        ))}
                        <th className="text-end">บันทึก</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roster.map((vet) => {
                        const displayed = getDisplayedWeekdays(vet);
                        const isDirty = !sameWeekdays(displayed, vet.weekdays);
                        const isSaving = savingVetId === vet.id;
                        return (
                          <tr key={vet.id}>
                            <td>
                              <div className="fw-medium">{vet.name}</div>
                              {vet.onDutyToday && <span className="tag ok mt-1">เข้าเวรวันนี้</span>}
                            </td>
                            {DISPLAY_WEEKDAY_ORDER.map((day) => {
                              const on = displayed.includes(day);
                              return (
                                <td key={day} className="text-center">
                                  <button
                                    type="button"
                                    className={`ca-duty-btn${on ? ' is-on' : ''}`}
                                    aria-pressed={on}
                                    aria-label={`${vet.name} ${WEEKDAYS_FULL_TH[day]} ${on ? 'เข้าเวร' : 'ไม่เข้าเวร'}`}
                                    disabled={isSaving}
                                    onClick={() => toggleWeekday(vet, day)}
                                  >
                                    {on ? '✓' : '–'}
                                  </button>
                                </td>
                              );
                            })}
                            <td>
                              <div className="ca-actions justify-content-end">
                                {isDirty ? (
                                  <>
                                    <button
                                      type="button"
                                      className="btn btn-sky btn-sm"
                                      disabled={isSaving}
                                      onClick={() => handleSaveRow(vet)}
                                    >
                                      {isSaving && (
                                        <span
                                          className="spinner-border spinner-border-sm me-1"
                                          aria-hidden="true"
                                        />
                                      )}
                                      บันทึก
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-soft btn-sm"
                                      disabled={isSaving}
                                      onClick={() => cancelDraft(vet.id)}
                                    >
                                      ยกเลิก
                                    </button>
                                  </>
                                ) : (
                                  <span className="small text-muted">—</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <p className="small text-muted mt-2 mb-4">
                  <i className="bi bi-info-circle me-1" aria-hidden="true" />
                  หมอที่ยังไม่เคยตั้งเวร ระบบถือว่าเข้าเวรทุกวัน
                </p>

                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                  <div className="fw-medium">รายการวันลาสัตวแพทย์</div>
                  {hasPastLeaves && (
                    <button
                      type="button"
                      className="btn btn-soft btn-sm"
                      onClick={() => setShowPastLeaves((v) => !v)}
                    >
                      {showPastLeaves ? 'ซ่อนวันลาที่ผ่านมา' : 'แสดงวันลาที่ผ่านมา'}
                    </button>
                  )}
                </div>

                {visibleLeaves.length === 0 ? (
                  <div className="empty-box py-3">
                    <i className="bi bi-calendar2" aria-hidden="true" />
                    <p className="mb-0 small">ยังไม่มีวันลาที่กำลังจะถึง</p>
                  </div>
                ) : (
                  <div className="d-grid gap-2">
                    {visibleLeaves.map((leave) => (
                      <div key={leave.id} className="ca-list-item">
                        <div>
                          <div className="fw-medium">
                            {leave.vetName}
                            {leave.to < today && <span className="tag ms-2">ผ่านมาแล้ว</span>}
                          </div>
                          <div className="small text-muted">
                            {formatThaiDate(leave.from)}
                            {leave.to !== leave.from ? ` – ${formatThaiDate(leave.to)}` : ''}
                            {leave.note ? ` · ${leave.note}` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-soft-danger btn-sm"
                          onClick={() => {
                            setDeleteLeaveError('');
                            setDeleteLeaveTarget(leave);
                          }}
                        >
                          ลบวันลา
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </DataState>
        </div>

        {/* Section B: Clinic Closures */}
        <div className="card-soft">
          <div className="section-label">
            <i className="bi bi-calendar-x" aria-hidden="true" />
            <span>วันปิดคลินิก</span>
          </div>

          {closureWarnMsg && (
            <div className="alert-soft warn justify-content-between mb-3" role="status">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-exclamation-triangle-fill flex-shrink-0" aria-hidden="true" />
                <span>{closureWarnMsg}</span>
              </div>
              <button
                type="button"
                className="btn-close"
                aria-label="ปิดคำเตือน"
                onClick={() => setClosureWarnMsg('')}
              />
            </div>
          )}

          {closureFormError && (
            <div className="alert-soft danger mb-3" role="alert">
              <i className="bi bi-exclamation-circle" aria-hidden="true" />
              <span>{closureFormError}</span>
            </div>
          )}

          <form className="row g-2 align-items-end mb-4" onSubmit={handleCreateClosure} noValidate>
            <div className="col-sm-4 col-lg-3">
              <label className="form-label" htmlFor="ca-closure-date">
                วันที่ปิดคลินิก
              </label>
              <input
                id="ca-closure-date"
                type="date"
                className="form-control"
                min={today}
                value={closureDate}
                onChange={(e) => setClosureDate(e.target.value)}
              />
            </div>
            <div className="col-sm-5 col-lg-6">
              <label className="form-label" htmlFor="ca-closure-reason">
                เหตุผล (ไม่บังคับ)
              </label>
              <input
                id="ca-closure-reason"
                type="text"
                className="form-control"
                placeholder="เช่น วันหยุดนักขัตฤกษ์"
                value={closureReason}
                onChange={(e) => setClosureReason(e.target.value)}
              />
            </div>
            <div className="col-sm-3 col-lg-3">
              <button type="submit" className="btn btn-sky w-100" disabled={closureSaving}>
                {closureSaving && (
                  <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
                )}
                เพิ่มวันปิดคลินิก
              </button>
            </div>
          </form>

          <DataState
            loading={closuresLoading}
            error={closuresError}
            onRetry={reloadClosures}
            hasData={Boolean(closures)}
            empty={Boolean(closures && closures.length === 0)}
            emptyIcon="bi-calendar-check"
            emptyText="ยังไม่มีวันปิดคลินิกตั้งแต่วันนี้เป็นต้นไป"
          >
            {closures && closures.length > 0 && (
              <div className="d-grid gap-2">
                {closures.map((closure) => (
                  <div key={closure.date} className="ca-list-item">
                    <div>
                      <div className="fw-medium">
                        {formatThaiDate(closure.date, { withWeekday: true })}
                      </div>
                      <div className="small text-muted">{closure.reason || 'ปิดทำการ'}</div>
                    </div>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      {closure.affectedBookings > 0 && (
                        <span className="tag warn">มีนัด {closure.affectedBookings} รายการ</span>
                      )}
                      <button
                        type="button"
                        className="btn btn-soft-danger btn-sm"
                        onClick={() => {
                          setDeleteClosureError('');
                          setDeleteClosureTarget(closure);
                        }}
                      >
                        ลบ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DataState>
        </div>
      </div>

      {/* Add Leave Modal */}
      <CaModal
        open={leaveModalOpen}
        title="เพิ่มวันลาสัตวแพทย์"
        icon="bi-calendar-plus"
        submitting={leaveSaving}
        error={leaveError}
        onClose={() => setLeaveModalOpen(false)}
      >
        <form onSubmit={handleCreateLeave} noValidate>
          <div className="mb-3">
            <label className="form-label" htmlFor="ca-leave-vet">
              สัตวแพทย์
            </label>
            <select
              id="ca-leave-vet"
              className="form-select"
              value={leaveForm.staffId}
              onChange={(e) => setLeaveForm((f) => ({ ...f, staffId: e.target.value }))}
            >
              {(roster ?? []).map((vet) => (
                <option key={vet.id} value={vet.id}>
                  {vet.name}
                </option>
              ))}
            </select>
          </div>

          <div className="row g-2 mb-3">
            <div className="col-6">
              <label className="form-label" htmlFor="ca-leave-from">
                วันที่เริ่มลา
              </label>
              <input
                id="ca-leave-from"
                type="date"
                className="form-control"
                value={leaveForm.from}
                onChange={(e) =>
                  setLeaveForm((f) => ({
                    ...f,
                    from: e.target.value,
                    to: f.to < e.target.value ? e.target.value : f.to,
                  }))
                }
              />
            </div>
            <div className="col-6">
              <label className="form-label" htmlFor="ca-leave-to">
                วันที่สิ้นสุด
              </label>
              <input
                id="ca-leave-to"
                type="date"
                className="form-control"
                min={leaveForm.from || undefined}
                value={leaveForm.to}
                onChange={(e) => setLeaveForm((f) => ({ ...f, to: e.target.value }))}
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label" htmlFor="ca-leave-note">
              หมายเหตุ (ไม่บังคับ)
            </label>
            <input
              id="ca-leave-note"
              type="text"
              className="form-control"
              placeholder="เช่น ลาพักร้อน / ประชุมวิชาการ"
              value={leaveForm.note}
              onChange={(e) => setLeaveForm((f) => ({ ...f, note: e.target.value }))}
            />
          </div>

          <div className="d-flex justify-content-end gap-2 mt-3">
            <button
              type="button"
              className="btn btn-soft"
              disabled={leaveSaving}
              onClick={() => setLeaveModalOpen(false)}
            >
              ยกเลิก
            </button>
            <button type="submit" className="btn btn-sky" disabled={leaveSaving}>
              {leaveSaving && (
                <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
              )}
              บันทึกวันลา
            </button>
          </div>
        </form>
      </CaModal>

      {/* Confirm empty weekdays */}
      <ConfirmDialog
        open={Boolean(emptyWeekdaysConfirm)}
        title="ยืนยันไม่เลือกวันเข้าเวร"
        message={
          emptyWeekdaysConfirm
            ? `${emptyWeekdaysConfirm.vet.name} ไม่มีวันเข้าเวรประจำสัปดาห์เลย ต้องการบันทึกหรือไม่`
            : ''
        }
        confirmLabel="บันทึก"
        confirmVariant="primary"
        submitting={Boolean(savingVetId)}
        onClose={() => setEmptyWeekdaysConfirm(null)}
        onConfirm={async () => {
          const target = emptyWeekdaysConfirm;
          setEmptyWeekdaysConfirm(null);
          if (target) await commitWeekdays(target.vet, target.weekdays);
        }}
      />

      {/* Confirm delete leave */}
      <ConfirmDialog
        open={Boolean(deleteLeaveTarget)}
        title="ลบวันลา"
        message={
          deleteLeaveTarget
            ? `ต้องการลบวันลาของ ${deleteLeaveTarget.vetName} (${formatThaiDate(deleteLeaveTarget.from)}) หรือไม่`
            : ''
        }
        confirmLabel="ลบวันลา"
        submitting={deleteLeaveSaving}
        error={deleteLeaveError}
        onClose={() => setDeleteLeaveTarget(null)}
        onConfirm={handleConfirmDeleteLeave}
      />

      {/* Confirm delete closure */}
      <ConfirmDialog
        open={Boolean(deleteClosureTarget)}
        title="ลบวันปิดคลินิก"
        message={
          deleteClosureTarget
            ? `ต้องการลบวันปิดคลินิก ${formatThaiDate(deleteClosureTarget.date, { withWeekday: true })} (${deleteClosureTarget.reason || 'ปิดทำการ'}) หรือไม่`
            : ''
        }
        confirmLabel="ลบ"
        submitting={deleteClosureSaving}
        error={deleteClosureError}
        onClose={() => setDeleteClosureTarget(null)}
        onConfirm={handleConfirmDeleteClosure}
      />
    </div>
  );
}
