import type { ReactNode } from 'react';

/** Illustrationen der Spiele im Papierwelt-Stil. Arcade-Spiele bekommen ein großes Bild-Symbol. */
export type ArtKind = 'rechnen' | 'buchstaben' | 'uhr' | 'paare' | 'vier' | 'ttt' | 'ludo' | 'maumau' | 'wuerfel' | 'schiffe' | 'slf' | { emoji: string; bg: string };

const C = { sky: '#6FA8D6', plum: '#8E6BA8', terra: '#D9774F', butter: '#F2C94C', sage: '#5E9C6B', peach: '#E58F7A', ink: '#2D3A31', paper: '#FFFDF8' };

const BG: Record<string, string> = {
  rechnen: '#DCE9F3',
  buchstaben: '#DDEBDD',
  uhr: '#F3E4D3',
  paare: '#F6E1D8',
  vier: '#E9E1F0',
  ttt: '#DCE9F3',
  ludo: '#F7EDC8',
  maumau: '#DDEBDD',
  wuerfel: '#F6E1D8',
  schiffe: '#DCE9F3',
  slf: '#F7EDC8',
};

const FONT = "'Grandstander Variable', Grandstander, sans-serif";

function Tile({ x, y, w, h, fill, text, rotate, size = 28, color = C.paper }: { x: number; y: number; w: number; h: number; fill: string; text: string; rotate?: number; size?: number; color?: string }) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  return (
    <g transform={rotate ? `rotate(${rotate} ${cx} ${cy})` : undefined}>
      <rect x={x} y={y} width={w} height={h} rx="9" fill={fill} stroke={C.ink} strokeWidth="2" />
      <text x={cx} y={cy + size * 0.36} textAnchor="middle" fontSize={size} fontWeight="800" fontFamily={FONT} fill={color}>
        {text}
      </text>
    </g>
  );
}

const STAR = '0,-11 2.7,-3.72 10.46,-3.4 4.37,1.42 6.47,8.9 0,4.6 -6.47,8.9 -4.37,1.42 -10.46,-3.4 -2.7,-3.72';

function art(kind: Exclude<ArtKind, object>): ReactNode {
  switch (kind) {
    case 'rechnen':
      return (
        <>
          <Tile x={8} y={32} w={32} h={46} fill={C.sky} text="7" />
          <text x="50" y="64" textAnchor="middle" fontSize="24" fontWeight="800" fontFamily={FONT} fill={C.ink}>+</text>
          <Tile x={60} y={32} w={32} h={46} fill={C.terra} text="5" />
          <text x="102" y="64" textAnchor="middle" fontSize="24" fontWeight="800" fontFamily={FONT} fill={C.ink}>=</text>
          <Tile x={112} y={27} w={40} h={56} fill={C.butter} text="?" size={32} color={C.ink} />
        </>
      );
    case 'buchstaben':
      return (
        <>
          <Tile x={14} y={42} w={40} h={40} fill={C.terra} text="A" rotate={-8} />
          <Tile x={60} y={30} w={40} h={40} fill={C.sky} text="B" rotate={4} />
          <Tile x={106} y={44} w={40} h={40} fill={C.sage} text="C" rotate={10} />
          <path d="M16 98 H144" fill="none" stroke={C.ink} strokeOpacity="0.2" strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case 'uhr':
      return (
        <>
          <circle cx="80" cy="55" r="42" fill={C.paper} stroke={C.ink} strokeWidth="3" />
          <circle cx="80" cy="55" r="36" fill="none" stroke={C.peach} strokeWidth="4" />
          <path d="M80 23 V30 M112 55 H105 M80 87 V80 M48 55 H55" fill="none" stroke={C.ink} strokeWidth="3.2" strokeLinecap="round" />
          <path d="M80 55 H100" fill="none" stroke={C.plum} strokeWidth="6" strokeLinecap="round" />
          <path d="M80 55 V27" fill="none" stroke={C.sky} strokeWidth="4" strokeLinecap="round" />
          <circle cx="80" cy="55" r="5" fill={C.ink} />
        </>
      );
    case 'paare':
      return (
        <>
          <g transform="rotate(-10 46 58)">
            <rect x="26" y="31" width="40" height="54" rx="8" fill={C.paper} stroke={C.ink} strokeWidth="2" />
            <polygon points={STAR} transform="translate(46 58) scale(1.2)" fill={C.butter} stroke={C.ink} strokeWidth="1.2" />
          </g>
          <rect x="62" y="22" width="40" height="54" rx="8" fill={C.terra} stroke={C.ink} strokeWidth="2" />
          <rect x="68" y="28" width="28" height="42" rx="5" fill="none" stroke={C.paper} strokeWidth="2.5" strokeDasharray="4 3" />
          <g transform="rotate(10 114 58)">
            <rect x="94" y="31" width="40" height="54" rx="8" fill={C.paper} stroke={C.ink} strokeWidth="2" />
            <polygon points={STAR} transform="translate(114 58) scale(1.2)" fill={C.butter} stroke={C.ink} strokeWidth="1.2" />
          </g>
        </>
      );
    case 'vier': {
      const Y = new Set(['98,30', '80,48', '62,66', '44,84', '80,84', '116,84']);
      const P = new Set(['98,48', '80,66', '98,66', '62,84', '98,84']);
      const holes: ReactNode[] = [];
      for (const cy of [30, 48, 66, 84])
        for (const cx of [44, 62, 80, 98, 116]) {
          const k = `${cx},${cy}`;
          holes.push(<circle key={k} cx={cx} cy={cy} r="7" fill={Y.has(k) ? C.butter : P.has(k) ? C.terra : C.paper} stroke={C.ink} strokeWidth="1.2" />);
        }
      return (
        <>
          <rect x="30" y="92" width="12" height="12" rx="3" fill={C.plum} />
          <rect x="118" y="92" width="12" height="12" rx="3" fill={C.plum} />
          <rect x="28" y="16" width="104" height="82" rx="12" fill={C.plum} stroke={C.ink} strokeWidth="2" />
          {holes}
        </>
      );
    }
    case 'ttt':
      return (
        <>
          <path d="M66 18 V92 M94 18 V92 M42 42 H118 M42 68 H118" fill="none" stroke={C.ink} strokeWidth="4" strokeLinecap="round" />
          <path d="M48 24 L60 36 M60 24 L48 36" stroke={C.terra} strokeWidth="5" strokeLinecap="round" />
          <circle cx="80" cy="55" r="7.5" fill="none" stroke={C.sky} strokeWidth="5" />
          <path d="M100 74 L112 86 M112 74 L100 86" stroke={C.terra} strokeWidth="5" strokeLinecap="round" />
          <circle cx="106" cy="30" r="7.5" fill="none" stroke={C.sky} strokeWidth="5" />
        </>
      );
    case 'ludo':
      return (
        <>
          <rect x="34" y="5" width="100" height="100" rx="14" fill={C.paper} stroke={C.ink} strokeWidth="2" />
          <rect x="76" y="11" width="16" height="88" rx="4" fill={BG.ludo} />
          <rect x="40" y="47" width="88" height="16" rx="4" fill={BG.ludo} />
          <rect x="40" y="11" width="34" height="34" rx="9" fill={C.sky} />
          <rect x="94" y="11" width="34" height="34" rx="9" fill={C.butter} />
          <rect x="40" y="65" width="34" height="34" rx="9" fill={C.terra} />
          <rect x="94" y="65" width="34" height="34" rx="9" fill={C.sage} />
          {[
            [57, 28],
            [111, 28],
            [57, 82],
            [111, 82],
          ].map(([x, y]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r="7" fill={C.paper} stroke={C.ink} strokeWidth="1.5" />
          ))}
          <g transform="rotate(-12 18 74)">
            <rect x="6" y="62" width="24" height="24" rx="6" fill={C.paper} stroke={C.ink} strokeWidth="2" />
            <circle cx="12" cy="68" r="2.2" fill={C.ink} />
            <circle cx="18" cy="74" r="2.2" fill={C.ink} />
            <circle cx="24" cy="80" r="2.2" fill={C.ink} />
          </g>
        </>
      );
    case 'maumau':
      return (
        <>
          {[
            { r: -14, x: 46, s: '♣', c: C.ink },
            { r: 0, x: 66, s: '★', c: C.terra },
            { r: 14, x: 86, s: '♠', c: C.ink },
          ].map((k) => (
            <g key={k.x} transform={`rotate(${k.r} ${k.x + 14} 90)`}>
              <rect x={k.x} y="22" width="40" height="58" rx="7" fill={C.paper} stroke={C.ink} strokeWidth="2" />
              <text x={k.x + 20} y="62" textAnchor="middle" fontSize="28" fill={k.c}>
                {k.s}
              </text>
            </g>
          ))}
        </>
      );
    case 'wuerfel':
      return (
        <>
          <g transform="rotate(-10 56 56)">
            <rect x="30" y="30" width="52" height="52" rx="12" fill={C.paper} stroke={C.ink} strokeWidth="2.5" />
            {[
              [44, 44],
              [68, 44],
              [56, 56],
              [44, 68],
              [68, 68],
            ].map(([x, y]) => (
              <circle key={`${x}${y}`} cx={x} cy={y} r="4.5" fill={C.terra} />
            ))}
          </g>
          <g transform="rotate(12 112 60)">
            <rect x="90" y="38" width="44" height="44" rx="10" fill={C.butter} stroke={C.ink} strokeWidth="2.5" />
            <circle cx="102" cy="50" r="4" fill={C.ink} />
            <circle cx="122" cy="70" r="4" fill={C.ink} />
          </g>
        </>
      );
    case 'schiffe':
      return (
        <>
          <path d="M10 82 Q25 74 40 82 T70 82 T100 82 T130 82 T160 82" fill="none" stroke={C.sky} strokeWidth="4" strokeLinecap="round" />
          <path d="M10 96 Q25 88 40 96 T70 96 T100 96 T130 96 T160 96" fill="none" stroke={C.sky} strokeWidth="4" strokeLinecap="round" opacity="0.6" />
          <path d="M40 66 H110 L100 80 H50 Z" fill={C.terra} stroke={C.ink} strokeWidth="2" />
          <path d="M74 66 V22 L104 58 H74" fill={C.paper} stroke={C.ink} strokeWidth="2" />
          <circle cx="128" cy="34" r="14" fill="none" stroke={C.ink} strokeWidth="2.5" />
          <path d="M128 14 V54 M108 34 H148" stroke={C.ink} strokeWidth="2" />
        </>
      );
    case 'slf':
      return (
        <>
          <circle cx="56" cy="55" r="36" fill={C.sky} stroke={C.ink} strokeWidth="2" />
          <path d="M34 36 Q46 30 52 42 T44 62 Q36 70 30 60 Z M62 30 Q78 30 82 46 Q74 52 66 46 Z M58 70 Q72 64 80 76 Q70 88 60 84 Z" fill={C.sage} />
          <g transform="rotate(28 118 60)">
            <rect x="110" y="20" width="16" height="70" rx="3" fill={C.butter} stroke={C.ink} strokeWidth="2" />
            <path d="M110 90 L118 104 L126 90 Z" fill="#F3E4D3" stroke={C.ink} strokeWidth="2" />
          </g>
        </>
      );
  }
}

export function GameArt({ kind, height = 96, className }: { kind: ArtKind; height?: number; className?: string }) {
  if (typeof kind === 'object') {
    return (
      <span className={`game-art emoji-art ${className ?? ''}`} style={{ height, background: kind.bg }} aria-hidden="true">
        <span style={{ fontSize: height * 0.52 }}>{kind.emoji}</span>
      </span>
    );
  }
  return (
    <span className={`game-art ${className ?? ''}`} style={{ height, background: BG[kind] }} aria-hidden="true">
      <svg viewBox="0 0 160 110" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        {art(kind)}
      </svg>
    </span>
  );
}
