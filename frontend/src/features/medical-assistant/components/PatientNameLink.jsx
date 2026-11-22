import { Link } from 'react-router-dom';
import { speciesOf } from '../../pet-owner/petUtils.js';
import { CAUTION_FLAGS } from '../data/constants.js';

export function buildCautionSummary(flags = [], allergies = '') {
  const parts = flags.map((f) => CAUTION_FLAGS[f]?.label).filter(Boolean);
  if (allergies && !flags.includes('drug_allergy')) {
    parts.push(`แพ้ยา/อาหาร: ${allergies}`);
  } else if (allergies && flags.includes('drug_allergy')) {
    parts.push(`รายละเอียดแพ้: ${allergies}`);
  }
  return parts.join(', ');
}

export default function PatientNameLink({
  patientId,
  petName,
  species,
  flags = [],
  allergies = '',
  showEmoji = true,
  className = '',
}) {
  const sp = speciesOf(species);
  const cautionText = buildCautionSummary(flags, allergies);

  return (
    <span className={`d-inline-flex align-items-center gap-1 ${className}`.trim()}>
      <Link
        to={`/medical-assistant/patients/${encodeURIComponent(patientId)}`}
        className="ma-patient-link"
      >
        {showEmoji && (
          <span className="me-1" aria-hidden="true">
            {sp.emoji}
          </span>
        )}
        {petName}
      </Link>
      {cautionText && (
        <span
          className="ma-caution-icon"
          title={`ข้อควรระวัง: ${cautionText}`}
          aria-label={`ข้อควรระวัง: ${cautionText}`}
        >
          <i className="bi bi-exclamation-triangle-fill" />
        </span>
      )}
    </span>
  );
}
