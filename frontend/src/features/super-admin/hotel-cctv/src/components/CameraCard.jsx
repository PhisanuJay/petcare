import Player from './Player';
import { IconExpand } from './Marks';
import { statusLabel } from '../api';

export default function CameraCard({ camera, showLive, onOpen, onPicture }) {
  const room = camera.roomLabel || 'ไม่ได้ระบุห้อง';
  const cat = camera.catName || camera.name;
  const openable = camera.isEnabled && onOpen;
  const offline = camera.streamStatus === 'offline';
  const connecting = camera.streamStatus === 'connecting';

  return (
    <article className={`thumb-card ${offline ? 'is-off' : ''}`}>
      <div
        className="cam-preview"
        role="button"
        tabIndex={openable ? 0 : -1}
        aria-disabled={!openable}
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
        {showLive && camera.isEnabled ? (
          <Player tile cameraId={camera.id} mode={camera.mode || 'admin'} onPicture={onPicture} />
        ) : null}
        {offline ? (
          <div className="cam-offline">
            <span>!</span>
            <small>กล้องออฟไลน์</small>
          </div>
        ) : (
          <span className={`cam-badge ${camera.streamStatus}`}>
            {camera.streamStatus === 'online' ? 'LIVE' : statusLabel(camera.streamStatus)}
          </span>
        )}
        {connecting ? <div className="cam-veil" /> : null}
        <div className="cam-foot">
          <span>{room}{cat ? ` · ${cat}` : ''}</span>
          <IconExpand />
        </div>
      </div>
    </article>
  );
}
