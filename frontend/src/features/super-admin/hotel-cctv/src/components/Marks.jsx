import { useId } from 'react';

/** Pet Hotel mark — premium painted-illustration cat (app-icon grade). */
export function CatMark() {
  const uid = useId().replace(/:/g, '');
  const g = (name) => `${uid}-${name}`;

  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id={g('face')} cx="38%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#FFF4E4" />
          <stop offset="100%" stopColor="#F0D0A4" />
        </radialGradient>
        <linearGradient id={g('ear')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF8EF" />
          <stop offset="100%" stopColor="#E8C49A" />
        </linearGradient>
        <linearGradient id={g('inner')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFD0C6" />
          <stop offset="100%" stopColor="#F08A78" />
        </linearGradient>
        <radialGradient id={g('eye')} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#3D4F68" />
          <stop offset="100%" stopColor="#1A2433" />
        </radialGradient>
        <linearGradient id={g('nose')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F2A08A" />
          <stop offset="100%" stopColor="#D45F4A" />
        </linearGradient>
        <linearGradient id={g('collar')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#9EC4FF" />
          <stop offset="45%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#6EA8F5" />
        </linearGradient>
        <radialGradient id={g('gem')} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="45%" stopColor="#C9E0FF" />
          <stop offset="100%" stopColor="#4A8FF0" />
        </radialGradient>
        <radialGradient id={g('blush')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFB4A8" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#FFB4A8" stopOpacity="0" />
        </radialGradient>
        <filter id={g('soft')} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.35" />
        </filter>
      </defs>

      {/* soft ground shadow */}
      <ellipse cx="32" cy="56.5" rx="14" ry="2.2" fill="#2A3B52" opacity="0.12" />

      {/* ears — outer */}
      <path d="M18.5 30C15.2 18 14 8.5 20.8 7.2c3.2-.6 7.4 5.2 10.2 12.8Z" fill={`url(#${g('ear')})`} />
      <path d="M45.5 30C48.8 18 50 8.5 43.2 7.2c-3.2-.6-7.4 5.2-10.2 12.8Z" fill={`url(#${g('ear')})`} />
      {/* ears — inner */}
      <path d="M19.6 26.5C17.6 19.2 17.4 12.8 21.2 12.2c2.2-.4 5.4 3.8 7.4 9.2Z" fill={`url(#${g('inner')})`} opacity="0.92" />
      <path d="M44.4 26.5C46.4 19.2 46.6 12.8 42.8 12.2c-2.2-.4-5.4 3.8-7.4 9.2Z" fill={`url(#${g('inner')})`} opacity="0.92" />

      {/* head base */}
      <circle cx="32" cy="34.5" r="17.8" fill={`url(#${g('face')})`} />
      {/* face shade */}
      <ellipse cx="32" cy="40" rx="17" ry="12" fill="#E6B888" opacity="0.16" filter={`url(#${g('soft')})`} />
      {/* forehead highlight */}
      <ellipse cx="27" cy="26" rx="7" ry="4.5" fill="#FFFFFF" opacity="0.55" filter={`url(#${g('soft')})`} />

      {/* fur suggestion strokes */}
      <path d="M15.8 34c1.2-2.4 2-3.2 3.4-3.6" fill="none" stroke="#E2C09A" strokeWidth="1.1" strokeLinecap="round" opacity="0.7" />
      <path d="M48.2 34c-1.2-2.4-2-3.2-3.4-3.6" fill="none" stroke="#E2C09A" strokeWidth="1.1" strokeLinecap="round" opacity="0.7" />

      {/* muzzle plate */}
      <ellipse cx="32" cy="41" rx="9.2" ry="6.8" fill="#FFF9F1" opacity="0.95" />

      {/* eyes */}
      <ellipse cx="24.8" cy="32.2" rx="3.15" ry="3.7" fill={`url(#${g('eye')})`} />
      <ellipse cx="39.2" cy="32.2" rx="3.15" ry="3.7" fill={`url(#${g('eye')})`} />
      <ellipse cx="24.8" cy="32.5" rx="1.15" ry="1.35" fill="#5B7A9A" opacity="0.45" />
      <ellipse cx="39.2" cy="32.5" rx="1.15" ry="1.35" fill="#5B7A9A" opacity="0.45" />
      <circle cx="25.85" cy="30.85" r="1.15" fill="#FFFFFF" />
      <circle cx="40.25" cy="30.85" r="1.15" fill="#FFFFFF" />
      <circle cx="23.9" cy="33.4" r="0.45" fill="#FFFFFF" opacity="0.7" />
      <circle cx="38.3" cy="33.4" r="0.45" fill="#FFFFFF" opacity="0.7" />

      {/* soft lids */}
      <path d="M21.4 29.4c2.1-1.7 5.2-1.8 7.2-.1" fill="none" stroke="#D4B08A" strokeWidth="1.15" strokeLinecap="round" opacity="0.85" />
      <path d="M35.4 29.3c2.1-1.7 5.2-1.8 7.2-.1" fill="none" stroke="#D4B08A" strokeWidth="1.15" strokeLinecap="round" opacity="0.85" />

      {/* nose */}
      <path d="M32 36.1c-1.7.15-3.2 1.7-3.15 2.85 0 1.35 1.55 2.2 3.15 2.2s3.15-.85 3.15-2.2c.05-1.15-1.45-2.7-3.15-2.85Z" fill={`url(#${g('nose')})`} />
      <ellipse cx="31.2" cy="37.5" rx="0.7" ry="0.45" fill="#FFFFFF" opacity="0.55" />
      <path d="M32 41v3.1" fill="none" stroke="#D45F4A" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M25.6 43.4c2.9 2.5 7.9 2.5 10.8 0" fill="none" stroke="#E8A090" strokeWidth="1.45" strokeLinecap="round" />

      {/* whiskers */}
      <path d="M20 39.5H12.5M20.5 42H13.2M44 39.5h7.5M43.5 42h7.3" fill="none" stroke="#C9A87E" strokeWidth="1.05" strokeLinecap="round" opacity="0.75" />

      {/* blush */}
      <circle cx="20.6" cy="38.6" r="3.2" fill={`url(#${g('blush')})`} />
      <circle cx="43.4" cy="38.6" r="3.2" fill={`url(#${g('blush')})`} />

      {/* premium collar + pearl gem */}
      <path d="M17.2 49.2c4.8 6.2 24.8 6.2 29.6 0" fill="none" stroke={`url(#${g('collar')})`} strokeWidth="3.8" strokeLinecap="round" />
      <path d="M17.2 49.2c4.8 6.2 24.8 6.2 29.6 0" fill="none" stroke="#FFFFFF" strokeWidth="1.1" strokeLinecap="round" opacity="0.45" />
      <circle cx="32" cy="50.2" r="3.35" fill={`url(#${g('gem')})`} />
      <circle cx="32" cy="50.2" r="3.35" fill="none" stroke="#FFFFFF" strokeWidth="0.7" opacity="0.8" />
      <circle cx="30.9" cy="49.2" r="0.85" fill="#FFFFFF" opacity="0.9" />
    </svg>
  );
}

export function HeroCat() {
  return (
    <svg className="hero-cat" viewBox="0 0 280 200" aria-hidden="true">
      <ellipse cx="70" cy="150" rx="54" ry="22" fill="#ffffff" opacity="0.55" />
      <ellipse cx="168" cy="162" rx="78" ry="24" fill="#ffffff" opacity="0.72" />
      <ellipse cx="230" cy="146" rx="36" ry="16" fill="#ffffff" opacity="0.5" />
      <path d="M118 92 128 48l22 34 24-36 12 46" fill="#ffe3b8" />
      <circle cx="154" cy="104" r="38" fill="#fff8ef" />
      <circle cx="140" cy="100" r="5" fill="#2a3b52" />
      <circle cx="170" cy="100" r="5" fill="#2a3b52" />
      <circle cx="142" cy="98" r="1.6" fill="#fff" />
      <circle cx="172" cy="98" r="1.6" fill="#fff" />
      <path d="M154 112c2.4 2.2 5 2.2 7.4 0" fill="none" stroke="#e59b7c" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M128 116c3 2.4 5 2.4 7.6 0M174 116c2.6 2.4 4.6 2.4 7.4 0" fill="none" stroke="#f4b8b0" strokeWidth="2.2" strokeLinecap="round" />
      <ellipse cx="154" cy="156" rx="34" ry="22" fill="#fff8ef" />
      <path d="M126 150c8 16 48 16 56 0" fill="none" stroke="#6ea2ff" strokeWidth="6" strokeLinecap="round" />
      <circle cx="154" cy="148" r="4" fill="#6ea2ff" />
      <path d="M196 132c16 4 24 16 22 28" fill="none" stroke="#ffe3b8" strokeWidth="10" strokeLinecap="round" />
    </svg>
  );
}

export function RoomArt() {
  return (
    <svg className="room-art" viewBox="0 0 320 180" aria-hidden="true">
      <rect x="36" y="28" width="92" height="70" rx="12" fill="#ffffff" opacity="0.72" />
      <rect x="48" y="40" width="68" height="46" rx="8" fill="#cfe6ff" />
      <path d="M48 118h230" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" opacity="0.8" />
      <ellipse cx="214" cy="124" rx="46" ry="16" fill="#ffffff" opacity="0.65" />
      <path d="M196 96 206 62l16 26 18-28 10 36" fill="#ffe3b8" />
      <circle cx="226" cy="104" r="22" fill="#fff8ef" />
      <circle cx="218" cy="102" r="2.4" fill="#2a3b52" />
      <circle cx="236" cy="102" r="2.4" fill="#2a3b52" />
      <path d="M214 128c10 14 28 14 36 0" fill="#fff8ef" />
      <path d="M214 132c8 8 28 8 36 0" fill="none" stroke="#6ea2ff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function IconCamera() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 8.5h3.2L9 6h6l1.8 2.5H20a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18v-8A1.5 1.5 0 0 1 4 8.5Z" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="13.5" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function IconLive() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" fill="currentColor" />
      <path d="M7 8.2a7 7 0 0 0 0 7.6M17 8.2a7 7 0 0 1 0 7.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16.5 20 20.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconExpand() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 4H4v5M15 4h5v5M20 15v5h-5M4 15v5h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconHome() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

export function IconMonitor() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 20h8M12 16v4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function IconDoor() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 21h16M14 12h.01" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function IconUser() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 19c1.5-3.2 3.8-4.8 7-4.8s5.5 1.6 7 4.8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function IconList() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function IconGear() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.9 7.1l1.6 1.5M17.5 15.4l1.6 1.5M3.5 12h2.2M18.3 12h2.2M4.9 16.9l1.6-1.5M17.5 8.6l1.6-1.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function PeekPets() {
  return (
    <svg className="peek-pets" viewBox="0 0 220 100" aria-hidden="true">
      <ellipse cx="110" cy="92" rx="86" ry="8" fill="#0b1220" opacity="0.35" />

      <g className="peek-dog">
        <path d="M28 92c4-28 18-42 36-42s32 14 36 42" fill="#E7C29A" />
        <path d="M42 42c-8-22 8-30 18-12" fill="#C8905E" />
        <path d="M86 42c8-22-8-30-18-12" fill="#C8905E" />
        <circle cx="64" cy="48" r="26" fill="#F6D9B4" />
        <ellipse cx="42" cy="56" rx="8" ry="11" fill="#C8905E" />
        <ellipse cx="86" cy="56" rx="8" ry="11" fill="#C8905E" />
        <circle cx="54" cy="46" r="3.1" fill="#243246" />
        <circle cx="74" cy="46" r="3.1" fill="#243246" />
        <circle cx="55.3" cy="45" r="1" fill="#fff" />
        <circle cx="75.3" cy="45" r="1" fill="#fff" />
        <ellipse cx="64" cy="56" rx="6" ry="4" fill="#4D3528" />
        <path d="M64 60v4.2" stroke="#4D3528" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M58 66c3.6 2.8 8.4 2.8 12 0" fill="none" stroke="#C77966" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="48" cy="56" r="3" fill="#F4A79B" opacity="0.8" />
        <circle cx="80" cy="56" r="3" fill="#F4A79B" opacity="0.8" />
      </g>

      <g className="peek-cat">
        <path d="M120 92c4-28 16-40 34-40s30 12 34 40" fill="#FFF1DF" />
        <path d="M136 34 124 4l26 22Z" fill="#FFE2B8" />
        <path d="M188 34l12-30-26 22Z" fill="#FFE2B8" />
        <path d="M136 34l1-10 16 14Z" fill="#FFB7AB" />
        <path d="M188 34l-1-10-16 14Z" fill="#FFB7AB" />
        <circle cx="162" cy="46" r="25" fill="#FFF8EF" />
        <path d="M148 38q6.5-7.5 13 0" fill="none" stroke="#243246" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M163 38q6.5-7.5 13 0" fill="none" stroke="#243246" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M162 51l-3.6 2.8h7.2Z" fill="#E07A5F" />
        <path d="M162 53.6v3.4" stroke="#E07A5F" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M153 59c3 2 7 2 10 0M162 59c3 2 7 2 10 0" fill="none" stroke="#EFA59C" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M137 50h-14M137 55h-12M187 50h14M187 55h12" stroke="#E6C4A0" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="151" cy="54" r="2.4" fill="#F4A79B" opacity="0.75" />
        <circle cx="173" cy="54" r="2.4" fill="#F4A79B" opacity="0.75" />
      </g>

      <path d="M98 78c5 7 15 7 20 0" fill="none" stroke="#7EB0FF" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="108" cy="76" r="3.6" fill="#7EB0FF" />
    </svg>
  );
}

export function PeekCat() {
  return <PeekPets />;
}
