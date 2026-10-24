/**
 * Thin localStorage helpers. Everything is stored locally until the backend is ready.
 */
export const STORAGE_KEYS = {
  users: 'petcare_users',
  session: 'petcare_session',
  pets: 'petcare_pets',
};

export function readJSON(key, fallback, store = localStorage) {
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value, store = localStorage) {
  try {
    store.setItem(key, JSON.stringify(value));
  } catch (err) {
    if (err?.name === 'QuotaExceededError') {
      throw new Error('พื้นที่เก็บข้อมูลในเบราว์เซอร์เต็ม ลองใช้รูปที่เล็กลง');
    }
    throw err;
  }
}

export function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Resize an image file and return it as a JPEG data URL (keeps localStorage small). */
export function fileToResizedDataUrl(file, maxSize = 400, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('กรุณาเลือกไฟล์รูปภาพ'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('ไฟล์รูปไม่ถูกต้อง'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
