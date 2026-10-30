export type JoyMood = 'happy' | 'cheer' | 'talk' | 'sleep';

/** Joy, das Maskottchen: eine kleine Spielkonsole mit Gesicht (Farben der Papierwelt). */
export function Joy({ size = 80, mood = 'happy', className }: { size?: number; mood?: JoyMood; className?: string }) {
  const body = '#F2C94C';
  const screen = '#2D3A31';
  const eye = '#F6F0E4';
  const btnA = '#D9774F';
  const btnB = '#6FA8D6';
  const up = mood === 'cheer';
  return (
    <svg className={className} viewBox="0 0 120 140" width={size} height={Math.round((size * 7) / 6)} role="img" aria-label="Joy">
      <ellipse cx="60" cy="136" rx="30" ry="3.5" fill="#000" opacity="0.12" />
      {up ? (
        <g>
          <path d="M28 70 Q12 58 14 38" fill="none" stroke={body} strokeWidth="8" strokeLinecap="round" />
          <path d="M92 70 Q108 58 106 38" fill="none" stroke={body} strokeWidth="8" strokeLinecap="round" />
          <circle cx="14" cy="35" r="6.5" fill={body} />
          <circle cx="106" cy="35" r="6.5" fill={body} />
        </g>
      ) : (
        <g>
          <path d="M28 76 Q14 82 12 96" fill="none" stroke={body} strokeWidth="8" strokeLinecap="round" />
          <path d="M92 76 Q106 82 108 96" fill="none" stroke={body} strokeWidth="8" strokeLinecap="round" />
          <circle cx="12" cy="98" r="6.5" fill={body} />
          <circle cx="108" cy="98" r="6.5" fill={body} />
        </g>
      )}
      <rect x="40" y="116" width="13" height="17" rx="5" fill={screen} />
      <rect x="67" y="116" width="13" height="17" rx="5" fill={screen} />
      <rect x="24" y="12" width="72" height="110" rx="18" fill={body} stroke={screen} strokeWidth="2.5" />
      <rect x="32" y="17" width="26" height="4" rx="2" fill="#FFFFFF" opacity="0.55" />
      <rect x="34" y="24" width="52" height="42" rx="10" fill={screen} />
      {mood === 'happy' && (
        <g>
          <ellipse cx="50" cy="42" rx="4.5" ry="6" fill={eye} />
          <ellipse cx="70" cy="42" rx="4.5" ry="6" fill={eye} />
          <path d="M49 53 Q60 61 71 53" fill="none" stroke={eye} strokeWidth="3.5" strokeLinecap="round" />
        </g>
      )}
      {mood === 'cheer' && (
        <g>
          <path d="M44 45 Q50 37 56 45" fill="none" stroke={eye} strokeWidth="3.5" strokeLinecap="round" />
          <path d="M64 45 Q70 37 76 45" fill="none" stroke={eye} strokeWidth="3.5" strokeLinecap="round" />
          <path d="M50 51 Q60 64 70 51 Z" fill={eye} />
        </g>
      )}
      {mood === 'talk' && (
        <g className="joy-talk">
          <ellipse cx="50" cy="41" rx="4.5" ry="6" fill={eye} />
          <ellipse cx="70" cy="41" rx="4.5" ry="6" fill={eye} />
          <ellipse className="joy-mouth" cx="60" cy="55" rx="6" ry="4.5" fill={eye} />
        </g>
      )}
      {mood === 'sleep' && (
        <g>
          <path d="M44 43 Q50 48 56 43" fill="none" stroke={eye} strokeWidth="3.2" strokeLinecap="round" />
          <path d="M64 43 Q70 48 76 43" fill="none" stroke={eye} strokeWidth="3.2" strokeLinecap="round" />
          <ellipse cx="60" cy="56" rx="3.5" ry="2.5" fill={eye} />
        </g>
      )}
      <circle cx="41.5" cy="53" r="3.5" fill={btnA} opacity="0.6" />
      <circle cx="78.5" cy="53" r="3.5" fill={btnA} opacity="0.6" />
      <rect x="36" y="84" width="22" height="7" rx="2.5" fill={screen} />
      <rect x="43.5" y="76.5" width="7" height="22" rx="2.5" fill={screen} />
      <circle cx="76" cy="82" r="5.5" fill={btnA} />
      <circle cx="86" cy="92" r="5.5" fill={btnB} />
      <path d="M70 111 L77 104 M78 113 L85 106" fill="none" stroke={screen} strokeOpacity="0.35" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
