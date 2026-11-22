import Player from './Player';
import { IconExpand } from './Marks';
import { statusLabel } from '../api';

export default function CameraCard({ camera, showLive, onOpen, onPicture, variant = 'default' }) {
  const room = camera.roomLabel || 'ไม่ได้ระบุห้อง';
  const cat = camera.catName || camera.name;
  const openable = camera.isEnabled && onOpen;
  const offline = camera.streamStatus === 'offline';
  const connecting = camera.streamStatus === 'connecting';
  const online = camera.streamStatus === 'online';
  const live = variant === 'live';

  return (
    <article className={`thumb-card ${offline ? 'is-off' : ''} ${live ? 'live-card' : ''}`}>
      <div
        className="cam-preview"
        role="button"
        tabIndex={openable ? 0 : -1}
        aria-disabled={!openable}
        aria-label={openable ? `เปิดดู ${cat} ห้อง ${room}` : `${cat} ยังเปิดดูไม่ได้`}
        onClick={() => { if (openable) onOpen(); }}
        onKeyDown={(event) => {
          if (!openable || (event.key !== 'Enter' && event.key !== ' ')) return;
          event.preventDefault();
          onOpen();
        }}
      >
        <img
          className="room-photo"
          src="/cam-bg-3.jpg"
          alt=""
          draggable="false"
        />
        {showLive && camera.isEnabled && !offline ? (
          <Player tile cameraId={camera.id} mode={camera.mode || 'admin'} onPicture={onPicture} />
        ) : null}

        {offline ? (
          <div className="cam-offline">
            <span>!</span>
            <strong>กล้องออฟไลน์</strong>
            <small>{live ? 'ยังเชื่อมต่อไม่ได้ตอนนี้' : 'กล้องออฟไลน์'}</small>
          </div>
        ) : (
          <span className={`cam-badge ${camera.streamStatus}`}>
            {online ? 'LIVE' : statusLabel(camera.streamStatus)}
          </span>
        )}

        {connecting ? <div className="cam-veil" /> : null}

        <div className={`cam-foot ${live ? 'live-foot' : ''}`}>
          {live ? (
            <div className="live-foot-copy">
              <strong>{cat}</strong>
              <span>{room}</span>
            </div>
          ) : (
            <span>{room}{cat ? ` · ${cat}` : ''}</span>
          )}
          {openable ? (
            <span className="live-open-chip">
              {live ? 'เปิดดู' : null}
              <IconExpand />
            </span>
          ) : (
            <IconExpand />
          )}
        </div>
      </div>
    </article>
  );
}
