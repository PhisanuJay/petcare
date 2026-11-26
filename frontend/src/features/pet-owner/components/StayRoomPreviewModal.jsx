import { useEffect, useId } from 'react';

function baht(value) {
  return `฿${Number(value).toLocaleString('th-TH')}`;
}

export default function StayRoomPreviewModal({ room, open, onClose, onSelect }) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || !room) return null;

  return (
    <div
      className="modal d-block stay-room-preview"
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-dialog-centered stay-room-preview__dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content stay-room-preview__sheet">
          <div className="stay-room-preview__toolbar">
            <button type="button" className="btn btn-soft stay-room-preview__back" onClick={onClose}>
              <i className="bi bi-chevron-left" aria-hidden />
              กลับ
            </button>
            <button
              type="button"
              className="btn-close"
              aria-label="ปิด"
              onClick={onClose}
            />
          </div>
          <div className="stay-room-preview__media">
            <img src={room.imageUrl} alt="" />
          </div>
          <div className="stay-room-preview__body">
            <h2 id={titleId} className="stay-room-preview__title">{room.titleTh}</h2>
            {room.descriptionTh ? (
              <p className="stay-room-preview__desc">{room.descriptionTh}</p>
            ) : null}
            <p className="stay-room-preview__cap">
              รองรับ {room.maxPetsPerUnit} ตัว/ห้อง
            </p>
            <p className="stay-room-preview__price">
              {baht(room.price)}
              <small>/ คืน</small>
            </p>
            {onSelect ? (
              <button
                type="button"
                className="btn btn-sky w-100 stay-room-preview__pick"
                onClick={() => {
                  onSelect(room.id);
                  onClose();
                }}
              >
                เลือกห้องนี้
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}