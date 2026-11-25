import { useEffect, useRef, useState } from 'react';

const PET_CLASSES = new Set(['cat', 'dog']);
const DETECT_EVERY_MS = 400;

function coverRect(video) {
  if (!video) return null;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const rw = video.clientWidth;
  const rh = video.clientHeight;
  if (!vw || !vh || !rw || !rh) return null;
  const videoRatio = vw / vh;
  const boxRatio = rw / rh;
  let drawW;
  let drawH;
  let offsetX;
  let offsetY;
  if (boxRatio > videoRatio) {
    drawW = rw;
    drawH = rw / videoRatio;
    offsetX = 0;
    offsetY = (rh - drawH) / 2;
  } else {
    drawH = rh;
    drawW = rh * videoRatio;
    offsetX = (rw - drawW) / 2;
    offsetY = 0;
  }
  return { drawW, drawH, offsetX, offsetY, rw, rh };
}

let modelPromise = null;

async function loadPetModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      const tf = await import('@tensorflow/tfjs');
      await tf.ready();
      const cocoSsd = await import('@tensorflow-models/coco-ssd');
      return cocoSsd.load({ base: 'lite_mobilenet_v2' });
    })().catch((err) => {
      modelPromise = null;
      throw err;
    });
  }
  return modelPromise;
}

export default function PetOverlay({ containerRef, videoLive = false }) {
  const [data, setData] = useState({
    status: 'loading',
    message: 'กำลังโหลดโมเดล AI…',
    catCount: 0,
    dogCount: 0,
    petCount: 0,
    boxes: [],
    lastDetectedAt: null,
  });
  const [layout, setLayout] = useState(null);
  const modelRef = useRef(null);
  const busyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setData((prev) => ({ ...prev, status: 'loading', message: 'กำลังโหลดโมเดล AI…' }));
    loadPetModel()
      .then((model) => {
        if (cancelled) return;
        modelRef.current = model;
        setData((prev) => ({
          ...prev,
          status: videoLive ? 'not_found' : 'waiting',
          message: videoLive ? 'พร้อมตรวจจากภาพสด' : 'รอภาพสดเพื่อเริ่มตรวจ',
        }));
      })
      .catch((err) => {
        if (cancelled) return;
        setData((prev) => ({
          ...prev,
          status: 'error',
          message: err?.message || 'โหลดโมเดล AI ไม่สำเร็จ',
          boxes: [],
        }));
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!modelRef.current) return;
    if (!videoLive) {
      setData((prev) => ({
        ...prev,
        status: prev.status === 'error' ? 'error' : 'waiting',
        message: prev.status === 'error' ? prev.message : 'รอภาพสดเพื่อเริ่มตรวจ',
        boxes: [],
        catCount: 0,
        dogCount: 0,
        petCount: 0,
      }));
    }
  }, [videoLive]);

  useEffect(() => {
    const root = containerRef?.current;
    if (!root || !videoLive) return undefined;
    let cancelled = false;
    let timer = 0;

    async function tick() {
      if (cancelled || busyRef.current) return;
      const model = modelRef.current;
      const video = root.querySelector('video');
      if (!model || !video || video.readyState < 2 || video.videoWidth <= 0) {
        setData((prev) => (
          prev.status === 'error'
            ? prev
            : { ...prev, status: 'waiting', message: 'รอภาพสดเพื่อเริ่มตรวจ', boxes: [] }
        ));
        return;
      }

      busyRef.current = true;
      try {
        const predictions = await model.detect(video, 20);
        if (cancelled) return;
        const vw = video.videoWidth || 1;
        const vh = video.videoHeight || 1;
        const boxes = [];
        let catCount = 0;
        let dogCount = 0;
        for (const item of predictions) {
          const name = String(item.class || '').toLowerCase();
          if (!PET_CLASSES.has(name)) continue;
          if ((item.score || 0) < 0.45) continue;
          const [x, y, w, h] = item.bbox || [0, 0, 0, 0];
          boxes.push({
            x: Math.max(0, Math.min(1, x / vw)),
            y: Math.max(0, Math.min(1, y / vh)),
            w: Math.max(0, Math.min(1, w / vw)),
            h: Math.max(0, Math.min(1, h / vh)),
            score: item.score || 0,
            label: name,
          });
          if (name === 'cat') catCount += 1;
          else dogCount += 1;
        }
        const petCount = catCount + dogCount;
        setData({
          status: petCount > 0 ? 'found' : 'not_found',
          message: petCount > 0 ? 'ตรวจจากภาพสด' : 'ยังไม่พบหมาหรือแมว',
          catCount,
          dogCount,
          petCount,
          boxes,
          lastDetectedAt: petCount > 0 ? new Date().toISOString() : null,
        });
        setLayout(coverRect(video));
      } catch (err) {
        if (!cancelled) {
          setData((prev) => ({
            ...prev,
            status: 'error',
            message: err?.message || 'ตรวจจับไม่สำเร็จ',
            boxes: [],
          }));
        }
      } finally {
        busyRef.current = false;
      }
    }

    tick();
    timer = window.setInterval(tick, DETECT_EVERY_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [containerRef, videoLive]);

  useEffect(() => {
    const root = containerRef?.current;
    if (!root) return undefined;
    function measure() {
      const video = root.querySelector('video');
      setLayout(coverRect(video));
    }
    measure();
    const timer = window.setInterval(measure, 500);
    window.addEventListener('resize', measure);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', measure);
    };
  }, [containerRef, videoLive]);

  const boxes = data?.boxes || [];
  if (!layout || boxes.length === 0) return null;

  return (
    <svg className="pet-ai-overlay" width={layout.rw} height={layout.rh} aria-hidden="true">
      {boxes.map((box, index) => {
        const x = layout.offsetX + box.x * layout.drawW;
        const y = layout.offsetY + box.y * layout.drawH;
        const w = box.w * layout.drawW;
        const h = box.h * layout.drawH;
        const kind = box.label === 'dog' ? 'dog' : 'cat';
        const label = kind === 'dog' ? 'หมา' : 'แมว';
        return (
          <g key={`${kind}-${index}`}>
            <rect className={`pet-box ${kind}`} x={x} y={y} width={w} height={h} />
            <rect
              className={`pet-label-bg ${kind}`}
              x={x}
              y={Math.max(0, y - 22)}
              width={Math.max(42, label.length * 14)}
              height={20}
              rx="4"
            />
            <text className="pet-label-text" x={x + 6} y={Math.max(14, y - 7)}>
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
