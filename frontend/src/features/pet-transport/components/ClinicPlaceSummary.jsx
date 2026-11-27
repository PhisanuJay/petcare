import { ZONES } from '../constants.js';
import { districtLabel, subdistrictById, zoneIdFromSubdistrict } from '../pricing.js';

export default function ClinicPlaceSummary({ title = 'คลินิก', value, clinics = [] }) {
  const facility = value?.refId
    ? value
    : clinics.find((c) => c.id === value?.refId) || clinics[0];
  const name = value?.name || facility?.name || 'คลินิก';
  const address = value?.address || facility?.address || '';
  const mapUrl = value?.mapUrl || facility?.mapUrl || '';
  const zoneId = value?.zoneId || facility?.zoneId || zoneIdFromSubdistrict(facility?.subdistrictId);
  const zoneMeta = ZONES.find((z) => z.id === zoneId);
  const subLabel = subdistrictById(value?.subdistrictId || facility?.subdistrictId)?.label;

  return (
    <div className="tp-clinic-summary">
      <div className="tp-clinic-summary__head">
        <span className="tp-clinic-summary__icon" aria-hidden>
          <i className="bi bi-hospital" />
        </span>
        <div className="tp-clinic-summary__main">
          <span className="tp-clinic-summary__title">{title}</span>
          <strong className="tp-clinic-summary__name">{name}</strong>
        </div>
        {zoneMeta && (
          <span className="tp-clinic-summary__zone">
            {zoneMeta.label} · ฿{zoneMeta.price}
          </span>
        )}
      </div>
      {(address || subLabel) && (
        <details className="tp-clinic-summary__details">
          <summary>ดูที่อยู่คลินิก</summary>
          <p className="tp-muted small mb-1">
            {[districtLabel(value?.districtId || facility?.districtId), subLabel].filter(Boolean).join(' · ')}
          </p>
          {address && <p className="small mb-1">{address}</p>}
          {mapUrl && (
            <a href={mapUrl} target="_blank" rel="noreferrer" className="small">
              เปิดแผนที่
            </a>
          )}
        </details>
      )}
    </div>
  );
}