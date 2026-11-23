import {
  SERVICE_DISTRICTS,
  SERVICE_SUBDISTRICTS,
  ZONES,
} from '../constants.js';
import { zoneIdFromSubdistrict } from '../pricing.js';

export function emptyZonePlace(address = '') {
  return {
    districtId: SERVICE_DISTRICTS[0]?.id || 'chatuchak',
    subdistrictId: '',
    zoneId: null,
    address: address || '',
  };
}

export default function PlaceFields({
  prefix,
  value,
  onChange,
}) {
  const districtId = value.districtId || SERVICE_DISTRICTS[0]?.id || 'chatuchak';
  const subs = SERVICE_SUBDISTRICTS.filter((s) => s.districtId === districtId);
  const zoneMeta = ZONES.find((z) => z.id === value.zoneId);

  function setDistrict(nextDistrictId) {
    onChange({
      ...value,
      districtId: nextDistrictId,
      subdistrictId: '',
      zoneId: null,
    });
  }

  function setSubdistrict(subdistrictId) {
    const zoneId = zoneIdFromSubdistrict(subdistrictId);
    onChange({
      ...value,
      districtId,
      subdistrictId,
      zoneId,
    });
  }

  return (
    <div className="tp-card">
      <h3>{prefix}</h3>
      <div className="tp-form">
        <div className="field">
          <label htmlFor={`${prefix}-district`}>เขต</label>
          <select
            id={`${prefix}-district`}
            value={districtId}
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
            onChange={(e) => setSubdistrict(e.target.value)}
          >
            <option value="">— เลือกแขวง —</option>
            {subs.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
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
              <span className="tp-muted">เลือกแขวงเพื่อดู Zone</span>
            )}
          </div>
        </div>

        <div className="field">
          <label htmlFor={`${prefix}-address`}>รายละเอียดที่อยู่</label>
          <textarea
            id={`${prefix}-address`}
            rows={2}
            value={value.address || ''}
            onChange={(e) => onChange({ ...value, address: e.target.value })}
            placeholder="บ้านเลขที่ ซอย ถนน จุดสังเกต"
          />
        </div>
      </div>
    </div>
  );
}
