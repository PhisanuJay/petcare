import { STORAGE_KEYS, readJSON, writeJSON } from '../../../shared/utils/storage.js';
import { useTransport } from '../useTransport.js';

export function getSelectedDriverId(drivers) {
  const saved = readJSON(STORAGE_KEYS.transportActor, null);
  if (saved?.driverId && drivers.some((d) => d.id === saved.driverId)) return saved.driverId;
  return drivers[0]?.id || null;
}

export default function DriverActorBar({ driverId, onChange }) {
  const { drivers } = useTransport();

  function select(id) {
    writeJSON(STORAGE_KEYS.transportActor, { driverId: id });
    onChange(id);
  }

  return (
    <div className="tp-actor">
      <span>จำลองบทบาทคนขับ (MVP ไม่มี login แยก):</span>
      <select value={driverId || ''} onChange={(e) => select(e.target.value)}>
        {drivers.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>
    </div>
  );
}
