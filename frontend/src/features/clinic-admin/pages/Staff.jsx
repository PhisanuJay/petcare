import { useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import CaModal from '../components/CaModal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import DataState, { useCaToast } from '../components/DataState.jsx';
import { caRequest } from '../data/caApi.js';
import { ROLE_LABELS, ROLE_TAG_CLASS, generateTempPassword } from '../data/format.js';
import { useCaResource } from '../data/useCaResource.js';

const ROLE_TABS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'veterinarian', label: 'สัตวแพทย์' },
  { key: 'clinic_admin', label: 'แอดมิน' },
];

const INITIAL_CREATE = {
  name: '',
  email: '',
  role: 'veterinarian',
  password: '',
};

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  return false;
}

/**
 * Clinic Admin Staff Management Page
 * Role: clinic_admin
 */
export default function Staff() {
  const { currentStaff } = useAuth();
  const { data: staffList, loading, error, reload } = useCaResource('/staff');
  const { show, toast } = useCaToast();

  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showInactive, setShowInactive] = useState(false);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(INITIAL_CREATE);
  const [createError, setCreateError] = useState('');
  const [createSaving, setCreateSaving] = useState(false);

  // Edit modal
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', role: 'veterinarian' });
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [pendingWarningAck, setPendingWarningAck] = useState(false);

  // Reset password modal
  const [pwTarget, setPwTarget] = useState(null);
  const [pwValue, setPwValue] = useState('');
  const [pwSavedValue, setPwSavedValue] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  // Deactivate confirm modal
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivateError, setDeactivateError] = useState('');
  const [deactivateSaving, setDeactivateSaving] = useState(false);

  // Re-activate busy id
  const [activatingId, setActivatingId] = useState('');

  const filteredStaff = useMemo(() => {
    const list = staffList ?? [];
    const q = appliedQuery.trim().toLowerCase();
    return list.filter((member) => {
      if (!showInactive && !member.active) return false;
      if (roleFilter !== 'all' && member.role !== roleFilter) return false;
      if (!q) return true;
      return [member.name, member.email, member.role].some((v) =>
        String(v || '').toLowerCase().includes(q),
      );
    });
  }, [staffList, appliedQuery, roleFilter, showInactive]);

  function runSearch(event) {
    event?.preventDefault?.();
    setAppliedQuery(query.trim());
  }

  function clearSearch() {
    setQuery('');
    setAppliedQuery('');
  }

  const roleCounts = useMemo(() => {
    const list = (staffList ?? []).filter((m) => showInactive || m.active);
    return {
      all: list.length,
      veterinarian: list.filter((m) => m.role === 'veterinarian').length,
      clinic_admin: list.filter((m) => m.role === 'clinic_admin').length,
    };
  }, [staffList, showInactive]);

  function openCreateModal() {
    setCreateForm(INITIAL_CREATE);
    setCreateError('');
    setCreateOpen(true);
  }

  async function handleCopy(text) {
    try {
      const ok = await copyText(text);
      show(ok ? 'คัดลอกรหัสแล้ว' : 'ไม่สามารถคัดลอกอัตโนมัติได้ กรุณาคัดลอกเอง');
    } catch {
      show('ไม่สามารถคัดลอกอัตโนมัติได้ กรุณาคัดลอกเอง');
    }
  }

  async function handleCreateSubmit(e) {
    e.preventDefault();
    setCreateError('');
    const name = createForm.name.trim();
    const email = createForm.email.trim().toLowerCase();
    const password = createForm.password;

    if (!name) {
      setCreateError('กรุณากรอกชื่อเจ้าหน้าที่');
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setCreateError('กรุณากรอกอีเมลให้ถูกต้อง');
      return;
    }
    if (password.length < 8) {
      setCreateError('รหัสผ่านชั่วคราวต้องมีอย่างน้อย 8 ตัวอักษร');
      return;
    }

    setCreateSaving(true);
    try {
      await caRequest('/staff', {
        method: 'POST',
        body: JSON.stringify({ name, email, role: createForm.role, password }),
      });
      setCreateOpen(false);
      await reload();
      show('เพิ่มบัญชีเจ้าหน้าที่แล้ว');
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreateSaving(false);
    }
  }

  function openEditModal(member) {
    setEditTarget(member);
    setEditForm({ name: member.name, email: member.email, role: member.role });
    setEditError('');
    setPendingWarningAck(false);
  }

  const hasVetPending =
    editTarget?.role === 'veterinarian' && (editTarget?.pendingAssignments ?? 0) > 0;
  const editNameChanged = editTarget ? editForm.name.trim() !== editTarget.name : false;
  const editRoleChanged = editTarget ? editForm.role !== editTarget.role : false;
  const needsVetWarning = hasVetPending && (editNameChanged || editRoleChanged);

  async function handleEditSubmit(e) {
    e.preventDefault();
    if (!editTarget) return;
    setEditError('');

    const name = editForm.name.trim();
    const email = editForm.email.trim().toLowerCase();
    if (!name) {
      setEditError('กรุณากรอกชื่อเจ้าหน้าที่');
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEditError('กรุณากรอกอีเมลให้ถูกต้อง');
      return;
    }

    if (needsVetWarning && !pendingWarningAck) {
      setPendingWarningAck(true);
      return;
    }

    setEditSaving(true);
    try {
      await caRequest(`/staff/${editTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, email, role: editForm.role }),
      });
      setEditTarget(null);
      await reload();
      show('บันทึกข้อมูลเจ้าหน้าที่แล้ว');
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  function openPwModal(member) {
    setPwTarget(member);
    setPwValue('');
    setPwSavedValue('');
    setPwError('');
  }

  async function handlePwSubmit(e) {
    e.preventDefault();
    if (!pwTarget) return;
    setPwError('');
    if (pwValue.length < 8) {
      setPwError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
      return;
    }
    setPwSaving(true);
    try {
      await caRequest(`/staff/${pwTarget.id}/password`, {
        method: 'POST',
        body: JSON.stringify({ password: pwValue }),
      });
      setPwSavedValue(pwValue);
      await reload();
      show('ตั้งรหัสผ่านใหม่แล้ว');
    } catch (err) {
      setPwError(err.message);
    } finally {
      setPwSaving(false);
    }
  }

  async function handleConfirmDeactivate() {
    if (!deactivateTarget) return;
    setDeactivateError('');
    setDeactivateSaving(true);
    try {
      await caRequest(`/staff/${deactivateTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: false }),
      });
      setDeactivateTarget(null);
      await reload();
      show('ปิดใช้งานบัญชีแล้ว');
    } catch (err) {
      setDeactivateError(err.message);
    } finally {
      setDeactivateSaving(false);
    }
  }

  async function handleActivate(member) {
    setActivatingId(member.id);
    try {
      await caRequest(`/staff/${member.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: true }),
      });
      await reload();
      show('เปิดใช้งานบัญชีแล้ว');
    } catch (err) {
      show(err.message);
    } finally {
      setActivatingId('');
    }
  }

  return (
    <div>
      {toast}

      <div className="page-head">
        <div>
          <h1 className="mitr">จัดการเจ้าหน้าที่</h1>
          <p>เพิ่มบัญชี แก้ไขข้อมูล ตำแหน่ง และจัดการสิทธิ์การเข้าใช้งาน</p>
        </div>
        <button type="button" className="btn btn-sky" onClick={openCreateModal}>
          <i className="bi bi-person-plus me-1" aria-hidden="true" />
          เพิ่มเจ้าหน้าที่
        </button>
      </div>

      <DataState loading={loading} error={error} onRetry={reload} hasData={Boolean(staffList)}>
        {staffList && (
          <div className="card-soft">
            <div className="ca-filter-bar mb-3">
              <form className="ca-search-group" onSubmit={runSearch}>
                <label className="visually-hidden" htmlFor="ca-staff-search">
                  ค้นหาชื่อหรืออีเมลเจ้าหน้าที่
                </label>
                <div className="input-group">
                  <span className="input-group-text">
                    <i className="bi bi-search" aria-hidden="true" />
                  </span>
                  <input
                    id="ca-staff-search"
                    type="search"
                    className="form-control"
                    placeholder="ค้นหาชื่อหรืออีเมล..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {appliedQuery ? (
                    <button type="button" className="btn btn-soft" onClick={clearSearch}>
                      ล้าง
                    </button>
                  ) : null}
                  <button type="submit" className="btn btn-sky">
                    ค้นหา
                  </button>
                </div>
              </form>

              <div className="pill-tabs ca-scroll-tabs" role="tablist" aria-label="กรองตามตำแหน่ง">
                {ROLE_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={roleFilter === tab.key}
                    className={roleFilter === tab.key ? 'active' : ''}
                    onClick={() => setRoleFilter(tab.key)}
                  >
                    <span>{tab.label}</span>
                    <span className="count">{roleCounts[tab.key]}</span>
                  </button>
                ))}
              </div>

              <div className="form-check form-switch ms-lg-auto mb-0">
                <input
                  id="ca-show-inactive"
                  type="checkbox"
                  className="form-check-input"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                />
                <label className="form-check-label small" htmlFor="ca-show-inactive">
                  แสดงบัญชีที่ปิดใช้งาน
                </label>
              </div>
            </div>

            {filteredStaff.length === 0 ? (
              <div className="empty-box py-4">
                <i className="bi bi-people" aria-hidden="true" />
                <p className="mb-0">ไม่พบรายชื่อเจ้าหน้าที่ที่ตรงกับเงื่อนไข</p>
              </div>
            ) : (
              <>
                <div className="table-responsive d-none d-md-block">
                  <table className="ca-table">
                    <thead>
                      <tr>
                        <th>ชื่อ</th>
                        <th>อีเมล</th>
                        <th>ตำแหน่ง</th>
                        <th>สถานะ</th>
                        <th className="text-end">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStaff.map((member) => {
                        const isSelf = member.id === currentStaff?.id;
                        const isActivating = activatingId === member.id;
                        return (
                          <tr key={member.id}>
                            <td>
                              <div className="fw-medium">
                                {member.name}
                                {isSelf && <span className="tag sky ms-2">คุณ</span>}
                              </div>
                              {member.role === 'veterinarian' && member.pendingAssignments > 0 && (
                                <div className="small text-muted">
                                  นัดค้าง {member.pendingAssignments} รายการ
                                </div>
                              )}
                            </td>
                            <td className="text-muted small">{member.email}</td>
                            <td>
                              <span className={`tag ${ROLE_TAG_CLASS[member.role] || 'sky'}`}>
                                {ROLE_LABELS[member.role] || member.role}
                              </span>
                            </td>
                            <td>
                              <span className={`tag ${member.active ? 'ok' : 'danger'}`}>
                                {member.active ? 'ใช้งาน' : 'ปิดใช้งาน'}
                              </span>
                            </td>
                            <td>
                              <div className="ca-actions justify-content-end">
                                <button
                                  type="button"
                                  className="btn btn-soft btn-sm"
                                  onClick={() => openEditModal(member)}
                                >
                                  แก้ไข
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-soft btn-sm"
                                  onClick={() => openPwModal(member)}
                                >
                                  ตั้งรหัสผ่านใหม่
                                </button>
                                {!isSelf && member.active && (
                                  <button
                                    type="button"
                                    className="btn btn-soft-danger btn-sm"
                                    onClick={() => {
                                      setDeactivateError('');
                                      setDeactivateTarget(member);
                                    }}
                                  >
                                    ปิดใช้งาน
                                  </button>
                                )}
                                {!isSelf && !member.active && (
                                  <button
                                    type="button"
                                    className="btn btn-sky btn-sm"
                                    disabled={isActivating}
                                    onClick={() => handleActivate(member)}
                                  >
                                    {isActivating && (
                                      <span
                                        className="spinner-border spinner-border-sm me-1"
                                        aria-hidden="true"
                                      />
                                    )}
                                    เปิดใช้งาน
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="d-md-none d-grid gap-2">
                  {filteredStaff.map((member) => {
                    const isSelf = member.id === currentStaff?.id;
                    const isActivating = activatingId === member.id;
                    return (
                      <div key={member.id} className="ca-staff-card">
                        <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
                          <div className="fw-medium">
                            {member.name}
                            {isSelf && <span className="tag sky ms-2">คุณ</span>}
                          </div>
                          <span className={`tag ${member.active ? 'ok' : 'danger'}`}>
                            {member.active ? 'ใช้งาน' : 'ปิดใช้งาน'}
                          </span>
                        </div>
                        <div className="small text-muted mb-2">{member.email}</div>
                        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                          <span className={`tag ${ROLE_TAG_CLASS[member.role] || 'sky'}`}>
                            {ROLE_LABELS[member.role] || member.role}
                          </span>
                          {member.role === 'veterinarian' && member.pendingAssignments > 0 && (
                            <span className="small text-muted">
                              นัดค้าง {member.pendingAssignments} รายการ
                            </span>
                          )}
                        </div>
                        <div className="ca-actions">
                          <button
                            type="button"
                            className="btn btn-soft btn-sm"
                            onClick={() => openEditModal(member)}
                          >
                            แก้ไข
                          </button>
                          <button
                            type="button"
                            className="btn btn-soft btn-sm"
                            onClick={() => openPwModal(member)}
                          >
                            ตั้งรหัสผ่านใหม่
                          </button>
                          {!isSelf && member.active && (
                            <button
                              type="button"
                              className="btn btn-soft-danger btn-sm"
                              onClick={() => {
                                setDeactivateError('');
                                setDeactivateTarget(member);
                              }}
                            >
                              ปิดใช้งาน
                            </button>
                          )}
                          {!isSelf && !member.active && (
                            <button
                              type="button"
                              className="btn btn-sky btn-sm"
                              disabled={isActivating}
                              onClick={() => handleActivate(member)}
                            >
                              เปิดใช้งาน
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </DataState>

      {/* Create Staff Modal */}
      <CaModal
        open={createOpen}
        title="เพิ่มเจ้าหน้าที่"
        icon="bi-person-plus"
        submitting={createSaving}
        error={createError}
        onClose={() => setCreateOpen(false)}
      >
        <form onSubmit={handleCreateSubmit} noValidate>
          <div className="mb-3">
            <label className="form-label" htmlFor="ca-create-name">
              ชื่อ-นามสกุล
            </label>
            <input
              id="ca-create-name"
              type="text"
              className="form-control"
              value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="เช่น สพ.ญ.ใจดี รักสัตว์"
            />
          </div>

          <div className="mb-3">
            <label className="form-label" htmlFor="ca-create-email">
              อีเมล
            </label>
            <input
              id="ca-create-email"
              type="email"
              className="form-control"
              value={createForm.email}
              onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="staff@petcare.clinic"
            />
          </div>

          <div className="mb-3">
            <label className="form-label" htmlFor="ca-create-role">
              ตำแหน่ง
            </label>
            <select
              id="ca-create-role"
              className="form-select"
              value={createForm.role}
              onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
            >
              <option value="veterinarian">{ROLE_LABELS.veterinarian}</option>
              <option value="clinic_admin">{ROLE_LABELS.clinic_admin}</option>
            </select>
          </div>

          <div className="mb-3">
            <label className="form-label" htmlFor="ca-create-pw">
              รหัสผ่านชั่วคราว (อย่างน้อย 8 ตัวอักษร)
            </label>
            <div className="d-flex flex-wrap gap-2">
              <input
                id="ca-create-pw"
                type="text"
                className="form-control flex-grow-1"
                style={{ minWidth: '180px' }}
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="กรอกรหัสผ่านหรือกดสุ่มรหัส"
              />
              <button
                type="button"
                className="btn btn-soft btn-sm"
                onClick={() =>
                  setCreateForm((f) => ({ ...f, password: generateTempPassword(10) }))
                }
              >
                <i className="bi bi-shuffle me-1" aria-hidden="true" />
                สุ่มรหัส
              </button>
              {createForm.password && (
                <button
                  type="button"
                  className="btn btn-soft btn-sm"
                  onClick={() => handleCopy(createForm.password)}
                >
                  <i className="bi bi-clipboard me-1" aria-hidden="true" />
                  คัดลอก
                </button>
              )}
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2 mt-3">
            <button
              type="button"
              className="btn btn-soft"
              disabled={createSaving}
              onClick={() => setCreateOpen(false)}
            >
              ยกเลิก
            </button>
            <button type="submit" className="btn btn-sky" disabled={createSaving}>
              {createSaving && (
                <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
              )}
              บันทึก
            </button>
          </div>
        </form>
      </CaModal>

      {/* Edit Staff Modal */}
      <CaModal
        open={Boolean(editTarget)}
        title="แก้ไขข้อมูลเจ้าหน้าที่"
        icon="bi-pencil-square"
        submitting={editSaving}
        error={editError}
        onClose={() => setEditTarget(null)}
      >
        <form onSubmit={handleEditSubmit} noValidate>
          <div className="mb-3">
            <label className="form-label" htmlFor="ca-edit-name">
              ชื่อ-นามสกุล
            </label>
            <input
              id="ca-edit-name"
              type="text"
              className="form-control"
              value={editForm.name}
              onChange={(e) => {
                setEditForm((f) => ({ ...f, name: e.target.value }));
                setPendingWarningAck(false);
              }}
            />
          </div>

          <div className="mb-3">
            <label className="form-label" htmlFor="ca-edit-email">
              อีเมล
            </label>
            <input
              id="ca-edit-email"
              type="email"
              className="form-control"
              value={editForm.email}
              onChange={(e) => {
                setEditForm((f) => ({ ...f, email: e.target.value }));
                setPendingWarningAck(false);
              }}
            />
          </div>

          <div className="mb-3">
            <label className="form-label" htmlFor="ca-edit-role">
              ตำแหน่ง
            </label>
            <select
              id="ca-edit-role"
              className="form-select"
              value={editForm.role}
              onChange={(e) => {
                setEditForm((f) => ({ ...f, role: e.target.value }));
                setPendingWarningAck(false);
              }}
            >
              <option value="veterinarian">{ROLE_LABELS.veterinarian}</option>
              <option value="clinic_admin">{ROLE_LABELS.clinic_admin}</option>
            </select>
          </div>

          {needsVetWarning && (
            <div className="alert-soft warn mb-3" role="status">
              <i className="bi bi-exclamation-triangle-fill flex-shrink-0" aria-hidden="true" />
              <div>
                <div>
                  หมอคนนี้มีนัดค้างอยู่ {editTarget.pendingAssignments} รายการ ถ้า
                  {editRoleChanged && !editNameChanged ? 'เปลี่ยนตำแหน่ง' : 'เปลี่ยนชื่อ'}
                  ตอนนี้ นัดเหล่านี้อาจไม่แสดงในหน้าของหมอ จนกว่าระบบฝั่งหมอจะอัปเดต
                </div>
                {pendingWarningAck && (
                  <div className="fw-medium mt-1">
                    กด &ldquo;ยืนยันการบันทึก&rdquo; อีกครั้งเพื่อดำเนินการต่อ
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="d-flex justify-content-end gap-2 mt-3">
            <button
              type="button"
              className="btn btn-soft"
              disabled={editSaving}
              onClick={() => setEditTarget(null)}
            >
              ยกเลิก
            </button>
            <button type="submit" className="btn btn-sky" disabled={editSaving}>
              {editSaving && (
                <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
              )}
              {pendingWarningAck ? 'ยืนยันการบันทึก' : 'บันทึก'}
            </button>
          </div>
        </form>
      </CaModal>

      {/* Reset Password Modal */}
      <CaModal
        open={Boolean(pwTarget)}
        title={`ตั้งรหัสผ่านใหม่${pwTarget ? ` — ${pwTarget.name}` : ''}`}
        icon="bi-key"
        submitting={pwSaving}
        error={pwError}
        onClose={() => setPwTarget(null)}
      >
        {pwSavedValue ? (
          <div>
            <div className="alert-soft info mb-3">
              <i className="bi bi-info-circle-fill flex-shrink-0" aria-hidden="true" />
              <span>แจ้งรหัสนี้ให้เจ้าหน้าที่ และให้เปลี่ยนรหัสหลังเข้าระบบ</span>
            </div>
            <div className="ca-list-item mb-3">
              <code className="fs-6">{pwSavedValue}</code>
              <button
                type="button"
                className="btn btn-soft btn-sm"
                onClick={() => handleCopy(pwSavedValue)}
              >
                <i className="bi bi-clipboard me-1" aria-hidden="true" />
                คัดลอกรหัส
              </button>
            </div>
            <div className="d-flex justify-content-end">
              <button type="button" className="btn btn-sky" onClick={() => setPwTarget(null)}>
                ปิด
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handlePwSubmit} noValidate>
            <div className="mb-3">
              <label className="form-label" htmlFor="ca-reset-pw">
                รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)
              </label>
              <div className="d-flex flex-wrap gap-2">
                <input
                  id="ca-reset-pw"
                  type="text"
                  className="form-control flex-grow-1"
                  style={{ minWidth: '180px' }}
                  value={pwValue}
                  onChange={(e) => setPwValue(e.target.value)}
                  placeholder="กรอกรหัสผ่านใหม่หรือกดสุ่มรหัส"
                />
                <button
                  type="button"
                  className="btn btn-soft btn-sm"
                  onClick={() => setPwValue(generateTempPassword(10))}
                >
                  <i className="bi bi-shuffle me-1" aria-hidden="true" />
                  สุ่มรหัส
                </button>
              </div>
            </div>

            <div className="d-flex justify-content-end gap-2 mt-3">
              <button
                type="button"
                className="btn btn-soft"
                disabled={pwSaving}
                onClick={() => setPwTarget(null)}
              >
                ยกเลิก
              </button>
              <button type="submit" className="btn btn-sky" disabled={pwSaving}>
                {pwSaving && (
                  <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
                )}
                บันทึกรหัสผ่านใหม่
              </button>
            </div>
          </form>
        )}
      </CaModal>

      {/* Deactivate Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        title={`ปิดใช้งานบัญชี ${deactivateTarget?.name ?? ''}`}
        message="บัญชีนี้จะออกจากระบบทันทีและเข้าใช้งานไม่ได้ ข้อมูลเดิมยังอยู่"
        confirmLabel="ปิดใช้งาน"
        submitting={deactivateSaving}
        error={deactivateError}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleConfirmDeactivate}
      />
    </div>
  );
}
