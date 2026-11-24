import { LOCATION_KINDS } from '../constants.js';

export default function PlaceFields({
  prefix,
  value,
  onChange,
  clinics = [],
  hotels = [],
  defaultAddress = '',
}) {
  const set = (key, val) => onChange({ ...value, [key]: val });

  function onKind(kind) {
    if (kind === 'home') {
      onChange({ kind, refId: '', name: 'บ้าน', address: defaultAddress || value.address || '' });
      return;
    }
    if (kind === 'clinic' && clinics[0]) {
      onChange({ kind, refId: clinics[0].id, name: clinics[0].name, address: clinics[0].address });
      return;
    }
    if (kind === 'hotel' && hotels[0]) {
      onChange({ kind, refId: hotels[0].id, name: hotels[0].name, address: hotels[0].address });
      return;
    }
    onChange({ kind, refId: '', name: '', address: '' });
  }

  function onRef(refId) {
    if (value.kind === 'clinic') {
      const c = clinics.find((x) => x.id === refId);
      if (c) onChange({ ...value, refId, name: c.name, address: c.address });
      return;
    }
    if (value.kind === 'hotel') {
      const h = hotels.find((x) => x.id === refId);
      if (h) onChange({ ...value, refId, name: h.name, address: h.address });
    }
  }

  return (
    <div className="tp-card">
      <h3>{prefix}</h3>
      <div className="tp-form">
        <div className="field">
          <label htmlFor={`${prefix}-kind`}>ประเภทสถานที่</label>
          <select id={`${prefix}-kind`} value={value.kind} onChange={(e) => onKind(e.target.value)}>
            {LOCATION_KINDS.map((k) => (
              <option key={k.id} value={k.id}>{k.label}</option>
            ))}
          </select>
        </div>

        {value.kind === 'clinic' && (
          <div className="field">
            <label htmlFor={`${prefix}-clinic`}>คลินิก</label>
            <select id={`${prefix}-clinic`} value={value.refId} onChange={(e) => onRef(e.target.value)}>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {value.kind === 'hotel' && (
          <div className="field">
            <label htmlFor={`${prefix}-hotel`}>โรงแรมสัตว์</label>
            <select id={`${prefix}-hotel`} value={value.refId} onChange={(e) => onRef(e.target.value)}>
              {hotels.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>
        )}

        {(value.kind === 'custom' || value.kind === 'home') && (
          <div className="field">
            <label htmlFor={`${prefix}-name`}>ชื่อสถานที่</label>
            <input
              id={`${prefix}-name`}
              value={value.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder={value.kind === 'home' ? 'บ้าน' : 'เช่น คอนโด / สำนักงาน'}
            />
          </div>
        )}

        <div className="field">
          <label htmlFor={`${prefix}-address`}>ที่อยู่</label>
          <textarea
            id={`${prefix}-address`}
            rows={2}
            value={value.address}
            onChange={(e) => set('address', e.target.value)}
            readOnly={value.kind === 'clinic' || value.kind === 'hotel'}
          />
        </div>
      </div>
    </div>
  );
}
