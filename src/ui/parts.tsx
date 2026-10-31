import { useEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { SEAT_COLORS, type SeatInfo } from '../engine/game';
import { canSpeak, speak, speakIfAuto, useVoiceReady } from '../lib/speech';
import { cls } from '../lib/util';
import { Avatar } from './Avatar';
import { Icon, Star } from './Icon';
import { Joy, type JoyMood } from './Joy';

export function SpeakButton({ text, className }: { text: string | string[]; className?: string }) {
  useVoiceReady();
  if (!canSpeak(text)) return null;
  return (
    <button type="button" className={cls('icon-btn soft speak', className)} aria-label="Vorlesen" onClick={() => speak(text)}>
      <Icon name="speaker" />
    </button>
  );
}

/** Joy mit Sprechblase. Liest von selbst vor, wenn das für dieses Kind eingeschaltet ist. */
export function JoySays({ text, mood = 'talk', size = 64, children }: { text: string; mood?: JoyMood; size?: number; children?: ReactNode }) {
  useEffect(() => {
    speakIfAuto(text);
  }, [text]);
  const speakable = useVoiceReady() && canSpeak(text);
  return (
    <div className="joy-row">
      <Joy size={size} mood={mood} />
      <div className={cls('bubble', speakable && 'with-speaker')}>
        <p>{text}</p>
        {children}
        <SpeakButton text={text} />
      </div>
    </div>
  );
}

export function Stars({ n, max = 3, size = 18 }: { n: number; max?: number; size?: number }) {
  return (
    <span className="stars" role="img" aria-label={`${n} von ${max} Sternen`}>
      {Array.from({ length: max }, (_, i) => (
        <Star key={i} on={i < n} size={size} />
      ))}
    </span>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    document.body.classList.add('no-scroll');
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => {
      document.body.classList.remove('no-scroll');
      window.removeEventListener('keydown', key);
    };
  }, []);
  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Schließen" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Wer spielt mit – und wer ist dran? */
export function SeatStrip({ seats, active, scores, done }: { seats: SeatInfo[]; active?: number | 'all' | null; scores?: (number | string)[]; done?: boolean[] }) {
  return (
    <div className="seat-strip">
      {seats.map((s, i) => (
        <div key={i} className={cls('seat-chip', (active === i || active === 'all') && 'active')}>
          <Avatar kind={s.avatar} size={34} bg={s.color} />
          <span className="grow">
            <span className="nm" style={{ display: 'block' }}>
              {s.name}
            </span>
            {scores && <span className="pts">{scores[i]}</span>}
          </span>
          <span className="dot" style={{ background: SEAT_COLORS[i] }} aria-hidden="true" />
          {done?.[i] && (
            <span className="done-mark" aria-label="fertig">
              <Icon name="check" size={12} stroke={3.4} />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Sichtschutz, wenn mehrere Kinder ein Gerät teilen. */
export function Curtain({ seat, note, onReveal }: { seat: SeatInfo; note?: string; onReveal: () => void }) {
  const text = `${seat.name} ist dran. Gib das Gerät weiter – nicht spicken!`;
  useEffect(() => {
    speakIfAuto(text);
  }, [text]);
  return (
    <div className="curtain">
      <Avatar kind={seat.avatar} size={110} bg={seat.color} />
      <h2>{seat.name} ist dran</h2>
      {note && <p className="muted">{note}</p>}
      <p>Gib das Gerät weiter – nicht spicken!</p>
      <button type="button" className="btn primary big" onClick={onReveal}>
        Ich bin {seat.name}
      </button>
    </div>
  );
}

const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

export function Die({ value, held, small, rolling, onClick, label }: { value: number; held?: boolean; small?: boolean; rolling?: boolean; onClick?: () => void; label?: string }) {
  const pips = PIPS[value] ?? [];
  const body = Array.from({ length: 9 }, (_, i) => (pips.includes(i) ? <i key={i} /> : <span key={i} />));
  const className = cls('die', held && 'held', small && 'sm', rolling && 'rolling');
  if (onClick)
    return (
      <button type="button" className={className} onClick={onClick} aria-label={label ?? `Würfel ${value}`} aria-pressed={held}>
        {body}
      </button>
    );
  return (
    <span className={className} role="img" aria-label={label ?? `Würfel ${value}`}>
      {body}
    </span>
  );
}

export function AnalogClock({ h, m, size = 150 }: { h: number; m: number; size?: number }) {
  const hourAngle = ((h % 12) + m / 60) * 30;
  const minAngle = m * 6;
  return (
    <svg className="clock-face" width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="Uhr">
      <circle cx="60" cy="60" r="56" fill="#FFFDF8" stroke="#2D3A31" strokeWidth="3" />
      <circle cx="60" cy="60" r="50" fill="none" stroke="#E58F7A" strokeWidth="3" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        const x = 60 + Math.sin(a) * 40;
        const y = 60 - Math.cos(a) * 40 + 5;
        return (
          <text key={i} x={x} y={y} textAnchor="middle" fontSize="13" fontWeight="800" fontFamily="'Grandstander Variable', sans-serif" fill="#2D3A31">
            {i === 0 ? 12 : i}
          </text>
        );
      })}
      {Array.from({ length: 60 }, (_, i) =>
        i % 5 === 0 ? null : (
          <line key={i} x1="60" y1="8" x2="60" y2="11" stroke="#5E6B60" strokeWidth="1" transform={`rotate(${i * 6} 60 60)`} />
        ),
      )}
      <line x1="60" y1="60" x2="60" y2="34" stroke="#8E6BA8" strokeWidth="7" strokeLinecap="round" transform={`rotate(${hourAngle} 60 60)`} />
      <line x1="60" y1="60" x2="60" y2="16" stroke="#2F6E9E" strokeWidth="4" strokeLinecap="round" transform={`rotate(${minAngle} 60 60)`} />
      <circle cx="60" cy="60" r="5" fill="#2D3A31" />
    </svg>
  );
}

/** Zeigehand für Tutorials (Fingerspitze oben links bei 24 % / 10 %). */
export function Hand({ style, className }: { style?: CSSProperties; className?: string }) {
  return (
    <svg className={cls('hand', className)} style={style} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M10 2.5a1.8 1.8 0 0 1 1.8 1.8v6.2l4.6.9a2.5 2.5 0 0 1 2 2.9l-.9 5.1A3 3 0 0 1 14.6 22h-3.9a3 3 0 0 1-2.4-1.2l-3.6-4.8a1.7 1.7 0 0 1 2.6-2.2l.9.9V4.3A1.8 1.8 0 0 1 10 2.5z"
        fill="#FFFFFF"
        stroke="#2D3A31"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ───── Hinweise (Toasts) ─────

interface ToastItem {
  id: number;
  text: string;
  icon?: ReactNode;
}

let toasts: ToastItem[] = [];
let toastId = 0;
const toastListeners = new Set<() => void>();
const emitToasts = () => toastListeners.forEach((l) => l());

export function toast(text: string, icon?: ReactNode, ms = 3200) {
  const id = ++toastId;
  toasts = [...toasts, { id, text, icon }];
  emitToasts();
  window.setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emitToasts();
  }, ms);
}

export function ToastHost() {
  const list = useSyncExternalStore(
    (fn) => {
      toastListeners.add(fn);
      return () => {
        toastListeners.delete(fn);
      };
    },
    () => toasts,
  );
  return (
    <div className="toast-stack" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className="toast">
          {t.icon ?? <Joy size={32} mood="talk" />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

const CONFETTI = ['#D9774F', '#F2C94C', '#6FA8D6', '#5E9C6B', '#8E6BA8'];

export function Confetti() {
  const [pieces] = useState(() =>
    Array.from({ length: 36 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      color: CONFETTI[i % CONFETTI.length],
      rot: Math.random() * 360,
    })),
  );
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <i key={i} style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s`, transform: `rotate(${p.rot}deg)` }} />
      ))}
    </div>
  );
}

/** Ruft `fn` auf, wenn sich `value` ändert (nicht beim ersten Rendern) – z. B. für Töne. */
export function useOnChange<T>(value: T, fn: (prev: T, next: T) => void) {
  const [prev, setPrev] = useState(value);
  useEffect(() => {
    if (Object.is(prev, value)) return;
    fn(prev, value);
    setPrev(value);
  }, [value]);
}
