import {
  LOCATION_KINDS,
  SERVICE_DISTRICTS,
  SERVICE_SUBDISTRICTS,
  ZONES,
  isFacilityKind,
  normalizePlaceKind,
} from '../constants.js';
import { zoneIdFromSubdistrict } from '../pricing.js';
import ClinicPlaceSummary from './ClinicPlaceSummary.jsx';
import { ServiceZonesMap } from './PriceQuote.jsx';

export function emptyZonePlace(address = '', kind = 'custom') {
  return {
    kind: normalizePlaceKind(kind),
    refId: '',
    name: kind === 'home' ? 'บ้าน' : '',
    districtId: SERVICE_DISTRICTS[0]?.id || 'chatuchak',
    subdistrictId: '',
    zoneId: null,
    address: address || '',
    mapUrl: '',
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
    mapUrl: item.mapUrl || '',
  };
}

export default function PlaceFields({
  prefix,
  value,
  onChange,
  clinics = [],
  allowedKinds = null,
  locked = false,
  hideZoneBadge = false,
  hubZonesMap = false,
}) {
  const kinds = allowedKinds?.length
    ? LOCATION_KINDS.filter((k) => allowedKinds.includes(k.id))
    : LOCATION_KINDS;
  const districtId = value.districtId || SERVICE_DISTRICTS[0]?.id || 'chatuchak';
  const subs = SERVICE_SUBDISTRICTS.filter((s) => s.districtId === districtId);
  const zoneMeta = ZONES.find((z) => z.id === value.zoneId);
  const kind = normalizePlaceKind(value.kind || 'custom');
  const catalogLocked = isFacilityKind(kind);
  const facilities = clinics;
  const forceFacilityUi = locked && allowedKinds?.length === 1 && allowedKinds[0] === 'facility';
  const showClinicReadonly = forceFacilityUi || (locked && catalogLocked);

  function setKind(nextKind) {
    if (locked) return;
    const normalized = normalizePlaceKind(nextKind);
    if (normalized === kind) return;

    if (normalized === 'home') {
      onChange({
        ...emptyZonePlace(value.address || '', 'home'),
        address: value.address || '',
        mapUrl: value.mapUrl || '',
      });
      return;
    }
    if (normalized === 'facility') {
      const item = facilities.find((f) => f.id === value.refId) || facilities[0];
      onChange(item ? placeFromCatalog(item, 'facility') : emptyZonePlace('', 'facility'));
      return;
    }
    onChange({
      ...emptyZonePlace(value.address || '', normalized),
      mapUrl: value.mapUrl || '',
    });
  }

  function setCatalogRef(refId) {
    if (locked) return;
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
    return <ClinicPlaceSummary title={prefix} value={value} clinics={facilities} />;
  }

  const showHubZonesAside = hubZonesMap && !catalogLocked;

  return (
    <div
      className={`tp-card ${locked ? 'tp-card--muted' : ''}${showHubZonesAside ? ' tp-card--hub-zones' : ''}`}
    >
      <h3>{prefix}</h3>
      <div className={showHubZonesAside ? 'tp-card__hub-body' : undefined}>
      <div className="tp-form">
        <div className="field">
          <span className="tp-field-label" id={`${prefix}-kind-label`}>ประเภทสถานที่</span>
          <div
            className="tp-kind-toggle"
            role="radiogroup"
            aria-labelledby={`${prefix}-kind-label`}
          >
            {kinds.map((k) => (
              <button
                key={k.id}
                type="button"
                role="radio"
                aria-checked={kind === k.id}
                className={`tp-kind-toggle__btn ${kind === k.id ? 'is-active' : ''}`}
                disabled={locked}
                onClick={() => setKind(k.id)}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>

        {catalogLocked && (
          <div className="field">
            <label htmlFor={`${prefix}-facility`}>คลินิกในระบบ</label>
            <select
              id={`${prefix}-facility`}
              value={value.refId || facilities[0]?.id || ''}
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

        {!hideZoneBadge ? (
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
        ) : null}

        {hideZoneBadge && zoneMeta ? (
          <p className="tp-hub-zone-pick tp-muted small" aria-live="polite">
            แขวงนี้อยู่ <strong>{zoneMeta.label}</strong> · ค่าบริการฐาน ฿{zoneMeta.price}
          </p>
        ) : null}

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

        <div className="field">
          <label htmlFor={`${prefix}-map`}>ลิงก์แผนที่ (Google Maps)</label>
          <input
            id={`${prefix}-map`}
            type="url"
            inputMode="url"
            value={value.mapUrl || ''}
            readOnly={catalogLocked || locked}
            onChange={(e) => onChange({ ...value, mapUrl: e.target.value })}
            placeholder="วางลิงก์จาก Google Maps เช่น https://maps.google.com/..."
          />
          {!catalogLocked && !locked ? (
            <p className="tp-muted">ช่วยให้คนขับเปิดเส้นทางไปยังจุดรับ–ส่งได้ทันที</p>
          ) : null}
          {value.mapUrl && !catalogLocked && !locked ? (
            <p className="tp-muted" style={{ marginTop: '0.35rem' }}>
              <a href={value.mapUrl} target="_blank" rel="noreferrer">เปิดดูลิงก์นี้</a>
            </p>
          ) : null}
        </div>
      </div>
      {showHubZonesAside ? (
        <aside className="tp-hub-zones-map tp-hub-zones-map--inline" aria-label="แผนเขต Zone ค่ารถ">
          <p className="tp-hub-zones-map__lead">แผนโซนค่ารถ · เขตจตุจักร</p>
          <ServiceZonesMap compact />
          <div className="tp-hub-zones-map__rates">
            <p className="tp-hub-zones-map__rates-title">อัตราฐานต่อเที่ยว</p>
            <ul className="tp-hub-zones-map__rate-list">
              {ZONES.map((z) => {
                const wards = SERVICE_SUBDISTRICTS.filter((s) => s.zoneId === z.id).map((s) => s.label);
                return (
                  <li key={z.id} className="tp-hub-zones-map__rate-item">
                    <span className="tp-hub-zones-map__rate-head">
                      <strong>{z.label}</strong>
                      <span className="tp-hub-zones-map__rate-price">฿{z.price}</span>
                    </span>
                    <span className="tp-hub-zones-map__rate-wards">{wards.join(' · ')}</span>
                  </li>
                );
              })}
            </ul>
            <p className="tp-hub-zones-map__rates-note tp-muted small mb-0">
              เลือกแขวงในฟอร์มเพื่อดูโซนของคุณ · ไป–กลับคิดตามจำนวนเที่ยว
            </p>
          </div>
        </aside>
      ) : null}

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

        <div className="field">
          <label htmlFor={`${prefix}-map`}>ลิงก์แผนที่ (Google Maps)</label>
          <input
            id={`${prefix}-map`}
            type="url"
            inputMode="url"
            value={value.mapUrl || ''}
            readOnly={catalogLocked || locked}
            onChange={(e) => onChange({ ...value, mapUrl: e.target.value })}
            placeholder="วางลิงก์จาก Google Maps เช่น https://maps.google.com/..."
          />
          {!catalogLocked && !locked ? (
            <p className="tp-muted">ช่วยให้คนขับเปิดเส้นทางไปยังจุดรับ–ส่งได้ทันที</p>
          ) : null}
          {value.mapUrl && !catalogLocked && !locked ? (
            <p className="tp-muted" style={{ marginTop: '0.35rem' }}>
              <a href={value.mapUrl} target="_blank" rel="noreferrer">เปิดดูลิงก์นี้</a>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
