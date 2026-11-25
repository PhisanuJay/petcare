import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { IconExpand } from './Marks';

function waitForIce(peer, timeoutMs) {
  if (peer.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    peer.addEventListener('icegatheringstatechange', () => {
      if (peer.iceGatheringState === 'complete') {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

function viewerHost() {
  return window.location.hostname || 'localhost';
}

function filterOfferSdp(sdp) {
  const lines = String(sdp || '').split(/\r\n|\n/).filter((line) => line !== '');
  const usable = lines.filter((line) => {
    if (!line.startsWith('a=candidate:')) return false;
    const parts = line.trim().split(/\s+/);
    const address = parts[4] || '';
    if ((parts[2] || '').toLowerCase() !== 'udp') return false;
    if (!address || address.startsWith('169.254.') || address.startsWith('fe80:') || address.includes(':')) return false;
    return true;
  });
  const lan = usable.filter((line) => {
    const address = line.trim().split(/\s+/)[4] || '';
    return address !== '127.0.0.1' && !address.startsWith('127.');
  });
  const allow = new Set(lan.length ? lan : usable);
  const kept = lines.filter((line) => !line.startsWith('a=candidate:') || allow.has(line));
  return `${(kept.length ? kept : lines).join('\r\n')}\r\n`;
}

export default function Player({ cameraId, mode, tile = false, minimal = false, onPicture, onPhase }) {
  const videoRef = useRef(null);
  const stageRef = useRef(null);
  const peerRef = useRef(null);
  const onPictureRef = useRef(onPicture);
  const onPhaseRef = useRef(onPhase);
  const [phase, setPhase] = useState('loading');
  const [message, setMessage] = useState('กำลังเชื่อมต่อภาพสด');
  const [attempt, setAttempt] = useState(0);
  onPictureRef.current = onPicture;
  onPhaseRef.current = onPhase;

  useEffect(() => {
    let cancelled = false;
    const peer = new RTCPeerConnection({ iceServers: [] });
    peerRef.current = peer;
    let pictureTimer = 0;
    let dropTimer = 0;

    let told = false;
    function showPicture() {
      const video = videoRef.current;
      if (cancelled || !video || video.videoWidth <= 0) return;
      window.clearInterval(pictureTimer);
      setPhase('live');
      setMessage('');
      if (!told) {
        told = true;
        onPictureRef.current?.();
      }
    }

    async function connect() {
      setPhase('loading');
      setMessage('กำลังเชื่อมต่อภาพสด');
      try {
        peer.addTransceiver('video', { direction: 'recvonly' });
        peer.ontrack = (event) => {
          if (cancelled || event.track.kind !== 'video') return;
          const [stream] = event.streams;
          if (videoRef.current && stream) videoRef.current.srcObject = stream;
          showPicture();
        };
        function giveUp(text) {
          if (cancelled) return;
          window.clearTimeout(dropTimer);
          peer.close();
          setPhase('error');
          setMessage(text);
        }
        peer.onconnectionstatechange = () => {
          if (cancelled) return;
          const state = peer.connectionState;
          if (state === 'connected') {
            window.clearTimeout(dropTimer);
            return;
          }
          if (state !== 'failed' && state !== 'disconnected') return;
          window.clearTimeout(dropTimer);
          dropTimer = window.setTimeout(() => {
            const now = peer.connectionState;
            if (now === 'failed' || now === 'disconnected') giveUp('ภาพสดหลุด ลองเชื่อมต่อใหม่ได้');
          }, state === 'failed' ? 400 : 5000);
        };
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        await waitForIce(peer, 2500);
        const offerSdp = filterOfferSdp(peer.localDescription.sdp);
        const headers = {
          'Content-Type': 'application/sdp',
          'X-Viewer-Host': viewerHost(),
        };
        if (tile) headers['X-Stream-Preview'] = '1';
        const path = mode === 'admin'
          ? `/api/admin/cameras/${cameraId}/whep`
          : `/api/cameras/${cameraId}/whep`;
        if (mode !== 'admin') {
          const session = await api(`/api/cameras/${cameraId}/session`, {
            method: 'POST',
            headers: { 'X-Stay-View': '1' },
          });
          headers['X-Stream-Token'] = session.token;
          headers['X-Stay-View'] = '1';
        }
        const response = await fetch(path, {
          method: 'POST',
          credentials: 'include',
          headers,
          body: offerSdp,
        });
        const answer = await response.text();
        if (!response.ok) {
          let detail = 'เชื่อมต่อภาพสดไม่สำเร็จ';
          try {
            detail = JSON.parse(answer).error?.message || detail;
          } catch {
            detail = 'เชื่อมต่อภาพสดไม่สำเร็จ';
          }
          throw new Error(detail);
        }
        if (cancelled) return;
        await peer.setRemoteDescription({ type: 'answer', sdp: answer });
        const started = Date.now();
        const waitMs = tile ? 25000 : 22000;
        videoRef.current?.addEventListener('resize', showPicture);
        pictureTimer = window.setInterval(() => {
          if (cancelled) return;
          if (videoRef.current && videoRef.current.videoWidth > 0) {
            showPicture();
            return;
          }
          if (Date.now() - started < waitMs) return;
          window.clearInterval(pictureTimer);
          giveUp('ภาพยังไม่เข้า ลองเชื่อมต่อใหม่ได้');
        }, 400);
      } catch (error) {
        if (cancelled) return;
        setPhase('error');
        setMessage(error.message || 'เชื่อมต่อภาพสดไม่สำเร็จ');
      }
    }

    connect();
    return () => {
      cancelled = true;
      window.clearInterval(pictureTimer);
      window.clearTimeout(dropTimer);
      videoRef.current?.removeEventListener('resize', showPicture);
      peer.close();
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [cameraId, mode, tile, attempt]);

  useEffect(() => {
    onPhaseRef.current?.(phase);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'error') return undefined;
    const wait = tile ? 30000 : attempt === 0 ? 2000 : 0;
    if (!wait) return undefined;
    const timer = window.setTimeout(() => setAttempt((value) => value + 1), wait);
    return () => window.clearTimeout(timer);
  }, [tile, phase, attempt]);

  async function toggleFull() {
    const node = stageRef.current;
    if (!node) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await node.requestFullscreen();
  }

  return (
    <section className={tile ? 'stage tile-stage' : 'stage'} ref={stageRef} data-live={phase === 'live' ? '1' : '0'}>
      <video ref={videoRef} autoPlay playsInline muted />
      {tile || minimal ? null : phase === 'live' ? <span className="live-pill">LIVE</span> : null}
      {!tile && !minimal && phase !== 'live' ? (
        <div className="stage-message">
          <p>{message}</p>
          {phase === 'error' ? (
            <button className="button" type="button" onClick={() => setAttempt((value) => value + 1)}>ลองเชื่อมต่อใหม่</button>
          ) : null}
        </div>
      ) : null}
      {!tile && !minimal && phase === 'live' ? (
        <div className="stage-actions">
          <button className="button ghost" type="button" onClick={() => setAttempt((value) => value + 1)}>ลองใหม่</button>
          <button className="button ghost icon-btn" type="button" onClick={toggleFull} aria-label="เต็มจอ"><IconExpand /></button>
        </div>
      ) : null}
    </section>
  );
}
