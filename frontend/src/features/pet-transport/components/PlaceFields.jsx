import {
  LOCATION_KINDS,
  SERVICE_DISTRICTS,
  SERVICE_SUBDISTRICTS,
  ZONES,
  isFacilityKind,
  normalizePlaceKind,
} from '../constants.js';
import { districtLabel, subdistrictById, zoneIdFromSubdistrict } from '../pricing.js';

export function emptyZonePlace(address = '', kind = 'custom') {
  return {
    kind: normalizePlaceKind(kind),
    refId: '',
    name: kind === 'home' ? 'บ้าน' : '',
    districtId: SERVICE_DISTRICTS[0]?.id || 'chatuchak',
    subdistrictId: '',
    zoneId: null,
    address: address || '',
  };
}

export function placeFromCatalog(item, kind = 'facility') {
  if (!item) return emptyZonePlace('', kind);
  return {
    kind: normalizePlaceKind(kind),
    refId: item.id,
    name: item.name || '',
    districtId: item.districtId || SERVICE_DISTRICTS[0]?.id || 'chatuchak',
    subdistrictId: item.subdistrictId || '',
    zoneId: item.zoneId || zoneIdFromSubdistrict(item.subdistrictId) || null,
    address: item.address || '',
    catalogType: item.catalogType || null,
  };
}

/** Partner places for booking = clinics only */
export function mergeFacilities(clinics = [], _hotels = []) {
  return clinics.map((c) => ({ ...c, catalogType: 'clinic' }));
}

export default function PlaceFields({
  prefix,
  value,
  onChange,
  clinics = [],
  hotels = [],
  allowedKinds = null,
  locked = false,
}) {
  const kinds = allowedKinds?.length
    ? LOCATION_KINDS.filter((k) => allowedKinds.includes(k.id))
    : LOCATION_KINDS;
  const districtId = value.districtId || SERVICE_DISTRICTS[0]?.id || 'chatuchak';
  const subs = SERVICE_SUBDISTRICTS.filter((s) => s.districtId === districtId);
  const zoneMeta = ZONES.find((z) => z.id === value.zoneId);
  const kind = normalizePlaceKind(value.kind || 'custom');
  const catalogLocked = isFacilityKind(kind);
  const facilities = mergeFacilities(clinics, hotels);
  const subMeta = value.subdistrictId ? subdistrictById(value.subdistrictId) : null;
  const showClinicReadonly = locked && catalogLocked;

  function setKind(nextKind) {
    if (nextKind === 'home') {
      onChange({
        ...emptyZonePlace(value.address || '', 'home'),
        address: value.address || '',
      });
      return;
    }
    if (nextKind === 'facility' && facilities[0]) {
      onChange(placeFromCatalog(facilities[0], 'facility'));
      return;
    }
    onChange(emptyZonePlace('', nextKind));
  }

  function setCatalogRef(refId) {
    const item = facilities.find((x) => x.id === refId);
    if (item) onChange(placeFromCatalog(item, 'facility'));
  }

  function setDistrict(nextDistrictId) {
    onChange({
      ...value,
      kind,
      districtId: nextDistrictId,
      subdistrictId: '',
      zoneId: null,
      refId: '',
    });
  }

  function setSubdistrict(subdistrictId) {
    onChange({
      ...value,
      kind,
      districtId,
      subdistrictId,
      zoneId: zoneIdFromSubdistrict(subdistrictId),
      refId: '',
    });
  }

  if (showClinicReadonly) {
    return (
      <div className="tp-card tp-card--muted">
        <h3>{prefix}</h3>
        <div className="tp-form">
          <div className="field">
            <label>ประเภทสถานที่</label>
            <div className="tp-readonly-value">คลินิก</div>
          </div>
          <div className="field">
            <label>ชื่อคลินิก</label>
            <div className="tp-readonly-value">{value.name || '—'}</div>
          </div>
          <div className="field">
            <label>รายละเอียดที่อยู่</label>
            <div className="tp-readonly-value tp-readonly-value--block">
              {value.address || '—'}
            </div>
          </div>
          <div className="field">
            <label>เขต / แขวง</label>
            <div className="tp-readonly-value">
              {[districtLabel(value.districtId), subMeta?.label].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
          <div className="field">
            <label>Zone</label>
            <div className="tp-zone-badge" aria-live="polite">
              {zoneMeta ? (
                <>
                  <strong>{zoneMeta.label}</strong>
                  <span className="tp-muted"> · ฿{zoneMeta.price} ฐาน</span>
                </>
              ) : (
                <span className="tp-muted">—</span>
              )}
            </div>
          </div>
          
        </div>
      </div>
    );
  }

  return (
    <div className={`tp-card ${locked ? 'tp-card--muted' : ''}`}>
      <h3>{prefix}</h3>
      <div className="tp-form">
        <div className="field">
          <label htmlFor={`${prefix}-kind`}>ประเภทสถานที่</label>
          <select
            id={`${prefix}-kind`}
            value={kind}
            disabled={locked}
            onChange={(e) => setKind(e.target.value)}
          >
            {kinds.map((k) => (
              <option key={k.id} value={k.id}>{k.label}</option>
            ))}
          </select>
        </div>

        {catalogLocked && (
          <div className="field">
            <label htmlFor={`${prefix}-facility`}>คลินิกในระบบ</label>
            <select
              id={`${prefix}-facility`}
              value={value.refId || ''}
              disabled={locked}
              onChange={(e) => setCatalogRef(e.target.value)}
            >
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        )}

        {!catalogLocked && (
          <>
            <div className="field">
              <label htmlFor={`${prefix}-district`}>เขต</label>
              <select
                id={`${prefix}-district`}
                value={districtId}
                disabled={locked}
                onChange={(e) => setDistrict(e.target.value)}
              >
                {SERVICE_DISTRICTS.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor={`${prefix}-subdistrict`}>แขวง</label>
              <select
                id={`${prefix}-subdistrict`}
                value={value.subdistrictId || ''}
                disabled={locked}
                onChange={(e) => setSubdistrict(e.target.value)}
              >
                <option value="">— เลือกแขวง —</option>
                {subs.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          </>
        )}

        <div className="field">
          <label>Zone</label>
          <div className="tp-zone-badge" aria-live="polite">
            {zoneMeta ? (
              <>
                <strong>{zoneMeta.label}</strong>
                <span className="tp-muted"> · ฿{zoneMeta.price} ฐาน</span>
              </>
            ) : (
              <span className="tp-muted">
                {catalogLocked ? 'เลือกรายการเพื่อดู Zone' : 'เลือกแขวงเพื่อดู Zone'}
              </span>
            )}
          </div>
        </div>

        <div className="field">
          <label htmlFor={`${prefix}-address`}>รายละเอียดที่อยู่</label>
          <textarea
            id={`${prefix}-address`}
            rows={2}
            value={value.address || ''}
            readOnly={catalogLocked || locked}
            onChange={(e) => onChange({ ...value, address: e.target.value })}
            placeholder="บ้านเลขที่ ซอย ถนน จุดสังเกต"
          />
          {catalogLocked && !locked && (
            <p className="tp-muted">ที่อยู่จากคลินิกในระบบ — แก้ไขไม่ได้</p>
          )}
        </div>
      </div>
    </div>
  );
}
