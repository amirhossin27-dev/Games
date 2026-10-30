import type { CSSProperties } from 'react';
import type { AvatarKind } from '../lib/names';

const INK = '#2B2340';

function Face({ kind }: { kind: AvatarKind }) {
  switch (kind) {
    case 'fuchs':
      return (
        <>
          <path d="M20 20 L44 35 L26 52 Z" fill="#E8742A" />
          <path d="M80 20 L56 35 L74 52 Z" fill="#E8742A" />
          <path d="M25 27 L38 35 L29 45 Z" fill="#7A3414" />
          <path d="M75 27 L62 35 L71 45 Z" fill="#7A3414" />
          <path d="M17 45 Q50 22 83 45 Q81 70 50 88 Q19 70 17 45 Z" fill="#F28C38" />
          <path d="M25 59 Q38 54 50 63 Q62 54 75 59 Q67 78 50 88 Q33 78 25 59 Z" fill="#FFF4E8" />
          <Eyes l={[38, 52]} r={[62, 52]} size={4.8} />
          <ellipse cx="50" cy="75" rx="5.2" ry="3.8" fill={INK} />
        </>
      );
    case 'frosch':
      return (
        <>
          <circle cx="32" cy="40" r="14" fill="#4DB860" />
          <circle cx="68" cy="40" r="14" fill="#4DB860" />
          <ellipse cx="50" cy="63" rx="35" ry="25" fill="#4DB860" />
          <ellipse cx="50" cy="72" rx="24" ry="13" fill="#8FDB8A" />
          <circle cx="32" cy="40" r="9" fill="#FFFFFF" />
          <circle cx="68" cy="40" r="9" fill="#FFFFFF" />
          <Eyes l={[33.5, 41]} r={[66.5, 41]} size={4.8} />
          <path d="M33 62 Q50 76 67 62" fill="none" stroke="#1E5E2B" strokeWidth="3.6" strokeLinecap="round" />
          <Cheeks y={61} x1={23} x2={77} />
        </>
      );
    case 'loewe':
      return (
        <>
          <circle cx="50" cy="55" r="37" fill="#D9782A" />
          <circle cx="50" cy="55" r="34" fill="none" stroke="#B85E17" strokeWidth="4" strokeDasharray="7 6" />
          <circle cx="31" cy="34" r="8" fill="#F7C548" />
          <circle cx="69" cy="34" r="8" fill="#F7C548" />
          <circle cx="31" cy="34" r="4" fill="#E9A23B" />
          <circle cx="69" cy="34" r="4" fill="#E9A23B" />
          <circle cx="50" cy="57" r="25" fill="#F7C548" />
          <ellipse cx="50" cy="67" rx="12" ry="8.5" fill="#FFE6A8" />
          <Eyes l={[41, 52]} r={[59, 52]} size={4} />
          <path d="M44.5 61 H55.5 L50 66.5 Z" fill="#7A3E1A" />
          <path d="M50 66.5 V70 M44.5 71 Q50 75.5 55.5 71" fill="none" stroke="#7A3E1A" strokeWidth="2.4" strokeLinecap="round" />
        </>
      );
    case 'panda':
      return (
        <>
          <circle cx="26" cy="31" r="11" fill={INK} />
          <circle cx="74" cy="31" r="11" fill={INK} />
          <ellipse cx="50" cy="57" rx="34" ry="30" fill="#FFFFFF" />
          <ellipse cx="37" cy="54" rx="8.5" ry="11" transform="rotate(25 37 54)" fill={INK} />
          <ellipse cx="63" cy="54" rx="8.5" ry="11" transform="rotate(-25 63 54)" fill={INK} />
          <circle cx="38" cy="53" r="3.2" fill="#FFFFFF" />
          <circle cx="62" cy="53" r="3.2" fill="#FFFFFF" />
          <ellipse cx="50" cy="67" rx="5.2" ry="3.6" fill={INK} />
          <path d="M44.5 72 Q50 76.5 55.5 72" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
          <Cheeks y={67} x1={27} x2={73} />
        </>
      );
    case 'katze':
      return (
        <>
          <path d="M20 22 L43 35 L25 53 Z" fill="#8F7BD6" />
          <path d="M80 22 L57 35 L75 53 Z" fill="#8F7BD6" />
          <path d="M25 30 L37 36 L28 45 Z" fill="#F3A6C0" />
          <path d="M75 30 L63 36 L72 45 Z" fill="#F3A6C0" />
          <ellipse cx="50" cy="59" rx="32" ry="28" fill="#8F7BD6" />
          <ellipse cx="38" cy="55" rx="4.6" ry="5.8" fill={INK} />
          <ellipse cx="62" cy="55" rx="4.6" ry="5.8" fill={INK} />
          <circle cx="39.5" cy="53" r="1.5" fill="#FFFFFF" />
          <circle cx="63.5" cy="53" r="1.5" fill="#FFFFFF" />
          <path d="M45.5 64 H54.5 L50 68.5 Z" fill="#F07AA0" />
          <path d="M50 68.5 Q46 74 41.5 71 M50 68.5 Q54 74 58.5 71" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
          <path d="M16 62 H31 M17 70 L31 66.5 M84 62 H69 M83 70 L69 66.5" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case 'eule':
      return (
        <>
          <path d="M23 21 L39 34 L23 42 Z" fill="#8A5A3B" />
          <path d="M77 21 L61 34 L77 42 Z" fill="#8A5A3B" />
          <ellipse cx="50" cy="59" rx="31" ry="32" fill="#A56E47" />
          <ellipse cx="50" cy="74" rx="18" ry="15" fill="#E9C9A3" />
          <path d="M41 70 Q44 73 47 70 M53 70 Q56 73 59 70 M47 78 Q50 81 53 78" fill="none" stroke="#C49A6C" strokeWidth="2" strokeLinecap="round" />
          <circle cx="37.5" cy="50" r="11.5" fill="#FFFFFF" />
          <circle cx="62.5" cy="50" r="11.5" fill="#FFFFFF" />
          <Eyes l={[38.5, 51]} r={[61.5, 51]} size={5.5} />
          <path d="M45 59 H55 L50 67 Z" fill="#F2A33A" />
        </>
      );
    case 'hase':
      return (
        <>
          <ellipse cx="38" cy="25" rx="8.5" ry="21" fill="#F4F0F7" />
          <ellipse cx="62" cy="25" rx="8.5" ry="21" fill="#F4F0F7" />
          <ellipse cx="38" cy="26" rx="4.2" ry="15" fill="#F7A9C4" />
          <ellipse cx="62" cy="26" rx="4.2" ry="15" fill="#F7A9C4" />
          <circle cx="50" cy="63" r="26" fill="#F4F0F7" />
          <Eyes l={[41, 58]} r={[59, 58]} size={4} />
          <ellipse cx="50" cy="67" rx="3.8" ry="2.8" fill="#F07AA0" />
          <path d="M50 69.5 V73" stroke={INK} strokeWidth="2" strokeLinecap="round" />
          <rect x="46.8" y="73" width="6.4" height="5.5" rx="1.4" fill="#FFFFFF" stroke={INK} strokeWidth="1.4" />
          <Cheeks y={68} x1={32} x2={68} />
        </>
      );
    case 'dino':
      return (
        <>
          <path d="M29 33 L35 19 L42 30 L49 15 L56 29 L63 18 L69 32 Z" fill="#1F8C7E" />
          <rect x="19" y="29" width="62" height="56" rx="25" fill="#2EB39F" />
          <ellipse cx="50" cy="71" rx="23" ry="11" fill="#A5E6D7" />
          <circle cx="38" cy="48" r="8.5" fill="#FFFFFF" />
          <circle cx="62" cy="48" r="8.5" fill="#FFFFFF" />
          <Eyes l={[39, 49]} r={[61, 49]} size={4.3} />
          <circle cx="45" cy="67" r="1.9" fill="#1F5E55" />
          <circle cx="55" cy="67" r="1.9" fill="#1F5E55" />
          <path d="M38 74 Q50 81 62 74" fill="none" stroke="#1F5E55" strokeWidth="2.6" strokeLinecap="round" />
        </>
      );
    default:
      return (
        <>
          <path d="M50 14 V25" stroke="#5B6B8C" strokeWidth="3" strokeLinecap="round" />
          <circle cx="50" cy="13" r="5" fill="#D9774F" />
          <rect x="13" y="41" width="10" height="18" rx="4" fill="#9AA9C7" />
          <rect x="77" y="41" width="10" height="18" rx="4" fill="#9AA9C7" />
          <rect x="21" y="24" width="58" height="52" rx="17" fill="#C9D4E8" />
          <rect x="29" y="34" width="42" height="29" rx="10" fill={INK} />
          <circle cx="41" cy="46" r="4.6" fill="#7CF0E0" />
          <circle cx="59" cy="46" r="4.6" fill="#7CF0E0" />
          <path d="M42 55 Q50 60.5 58 55" fill="none" stroke="#7CF0E0" strokeWidth="2.6" strokeLinecap="round" />
          <rect x="35" y="76" width="30" height="16" rx="6" fill="#9AA9C7" />
        </>
      );
  }
}

function Eyes({ l, r, size }: { l: [number, number]; r: [number, number]; size: number }) {
  const hl = size * 0.32;
  return (
    <>
      <circle cx={l[0]} cy={l[1]} r={size} fill={INK} />
      <circle cx={r[0]} cy={r[1]} r={size} fill={INK} />
      <circle cx={l[0] + hl} cy={l[1] - hl} r={size * 0.32} fill="#FFFFFF" />
      <circle cx={r[0] + hl} cy={r[1] - hl} r={size * 0.32} fill="#FFFFFF" />
    </>
  );
}

function Cheeks({ y, x1, x2 }: { y: number; x1: number; x2: number }) {
  return (
    <>
      <circle cx={x1} cy={y} r="4.8" fill="#FF9FB4" opacity="0.7" />
      <circle cx={x2} cy={y} r="4.8" fill="#FF9FB4" opacity="0.7" />
    </>
  );
}

export function Avatar({ kind, size = 48, bg = '#F6D3B8', ring, className, label }: { kind: AvatarKind; size?: number; bg?: string; ring?: string; className?: string; label?: string }) {
  const style: CSSProperties = {
    width: size,
    height: size,
    background: bg,
    boxShadow: ring ? `0 0 0 ${Math.max(2, Math.round(size / 18))}px ${ring}` : undefined,
  };
  return (
    <span className={`avatar ${className ?? ''}`} style={style}>
      {/* Meist steht der Name daneben – dann ist das Bild nur Schmuck. */}
      <svg viewBox="0 0 100 100" width="100%" height="100%" {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
        <Face kind={kind} />
      </svg>
    </span>
  );
}
