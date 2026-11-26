/**
 * Pick same primary address vs alternate place (within service area).
 */
export default function PlacePointChoice({
  title,
  note = 'ที่อยู่อื่นต้องอยู่ในเขตจตุจักรตามแผน Zone',
  sameLabel = 'ที่อยู่เดิม',
  otherLabel = 'ที่อยู่อื่น',
  useAlternate = false,
  onUseAlternate,
  sameBody = null,
  otherBody = null,
}) {
  return (
    <div className="tp-place-choice">
      {title ? <h4 className="tp-place-choice__title">{title}</h4> : null}
      {note ? <p className="tp-place-choice__note tp-muted small mb-0">{note}</p> : null}
      <div
        className="tp-place-choice__toggle tp-kind-toggle"
        role="radiogroup"
        aria-label={title || 'เลือกที่อยู่'}
      >
        <button
          type="button"
          role="radio"
          aria-checked={!useAlternate}
          className={`tp-kind-toggle__btn ${!useAlternate ? 'is-active' : ''}`}
          onClick={() => onUseAlternate(false)}
        >
          {sameLabel}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={useAlternate}
          className={`tp-kind-toggle__btn ${useAlternate ? 'is-active' : ''}`}
          onClick={() => onUseAlternate(true)}
        >
          {otherLabel}
        </button>
      </div>
      <div className="tp-place-choice__body">
        {useAlternate ? otherBody : sameBody}
      </div>
    </div>
  );
}