import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { soundEnabled } from '../lib/settings';

// ───────────────────────── Retro-Sound ─────────────────────────

let audio: AudioContext | undefined;

function audioCtx(): AudioContext | undefined {
  if (!audio) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return undefined;
    audio = new AC();
  }
  if (audio.state === 'suspended') void audio.resume();
  return audio;
}

/** iOS spielt Töne erst nach einer Berührung – deshalb beim „Los geht's“-Tipp aufwecken. */
export function unlockAudio() {
  if (soundEnabled()) audioCtx();
}

/** Ein 8-Bit-Piepser. */
export function tone(freq: number, ms = 90, type: OscillatorType = 'square', vol = 0.05, slideTo?: number) {
  if (!soundEnabled()) return;
  try {
    const c = audioCtx();
    if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + ms / 1000);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + ms / 1000 + 0.02);
  } catch {
    // Kein Ton – das Spiel läuft trotzdem.
  }
}

/** Leises Motorbrummen für Rennspiele: `set` passt Tonhöhe und Lautstärke an, `stop` beendet es. */
export function hum(): { set(freq: number, vol: number): void; stop(): void } | null {
  if (!soundEnabled()) return null;
  try {
    const c = audioCtx();
    if (!c) return null;
    const o = c.createOscillator();
    const lp = c.createBiquadFilter();
    const g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.value = 60;
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    g.gain.value = 0;
    o.connect(lp).connect(g).connect(c.destination);
    o.start();
    return {
      set(freq, vol) {
        const t = c.currentTime;
        o.frequency.setTargetAtTime(freq, t, 0.06);
        g.gain.setTargetAtTime(!soundEnabled() ? 0 : vol, t, 0.08);
      },
      stop() {
        const t = c.currentTime;
        g.gain.setTargetAtTime(0, t, 0.05);
        o.stop(t + 0.4);
      },
    };
  } catch {
    return null;
  }
}

/** Kurzes Rauschen – für Schläge, Wusch und Aufprall. `freq`: Mitte des Klangs, `to`: dahin gleitet er. */
export function noise(ms = 80, vol = 0.08, freq = 1200, to?: number) {
  if (!soundEnabled()) return;
  try {
    const c = audioCtx();
    if (!c) return;
    const t = c.currentTime;
    const len = Math.max(1, Math.round((c.sampleRate * ms) / 1000));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(freq, t);
    if (to) bp.frequency.exponentialRampToValueAtTime(to, t + ms / 1000);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    src.connect(bp).connect(g).connect(c.destination);
    src.start(t);
  } catch {
    // Kein Ton – das Spiel läuft trotzdem.
  }
}

function melody(notes: number[], step = 110, ms = 140, type: OscillatorType = 'square') {
  notes.forEach((f, i) => window.setTimeout(() => tone(f, ms, type), i * step));
}

// ───────────────────────── Weiche Klänge ─────────────────────────
// Xylofon, Glöckchen und Holz für die Lern- und Brettspiele. Die Arcade-Spiele behalten den 8-Bit-Klang.

/** Ein Ton aus mehreren Sinus-Teiltönen: [Vielfaches der Frequenz, Lautstärke, Anteil der Ausklingzeit]. */
function partials(freq: number, at: number, dur: number, vol: number, parts: [number, number, number][]) {
  if (!soundEnabled()) return;
  try {
    const c = audioCtx();
    if (!c) return;
    const t = c.currentTime + at;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 5200;
    lp.connect(c.destination);
    for (const [mul, amp, decay] of parts) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq * mul, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol * amp, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur * decay);
      o.connect(g).connect(lp);
      o.start(t);
      o.stop(t + dur * decay + 0.05);
    }
  } catch {
    // Kein Ton – das Spiel läuft trotzdem.
  }
}

const marimba = (f: number, at = 0, vol = 0.22, dur = 0.55) =>
  partials(f, at, dur, vol, [
    [1, 1, 1],
    [3.93, 0.28, 0.35],
    [9.2, 0.07, 0.15],
  ]);
const bell = (f: number, at = 0, vol = 0.12, dur = 1.3) =>
  partials(f, at, dur, vol, [
    [1, 1, 1],
    [2, 0.45, 0.7],
    [3.01, 0.25, 0.5],
    [4.16, 0.12, 0.35],
  ]);
const sparkle = (at = 0, vol = 0.05) => [2093, 2637, 3136, 4186].forEach((f, i) => bell(f, at + i * 0.045, vol, 0.5));

/** Kurzes Holz-Klopfen (Tippen, Steine setzen). */
function wood(at = 0, vol = 0.16, from = 1150, to = 720) {
  if (!soundEnabled()) return;
  try {
    const c = audioCtx();
    if (!c) return;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + 0.05);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.1);
  } catch {
    // Kein Ton – das Spiel läuft trotzdem.
  }
}

/** Die weichen Klänge einzeln – so wie Amir sie auf der Hörprobe-Seite freigegeben hat. */
export const soft = {
  right: () => {
    marimba(784);
    marimba(1047, 0.1);
    sparkle(0.2, 0.035);
  },
  wrong: () => {
    marimba(392, 0, 0.2, 0.45);
    marimba(330, 0.17, 0.2, 0.6);
  },
  tap: () => wood(),
  flip: () => wood(0, 0.12, 1500, 1000),
  star: () => {
    bell(1319, 0, 0.1);
    bell(1760, 0.08, 0.09);
    sparkle(0.16, 0.04);
  },
  win: () => {
    [523, 659, 784, 1047].forEach((f, i) => marimba(f, i * 0.11, 0.2));
    [1047, 1319, 1568].forEach((f) => bell(f, 0.48, 0.07, 1.8));
    sparkle(0.55, 0.035);
  },
  lose: () => {
    marimba(784, 0, 0.18);
    marimba(659, 0.16, 0.18);
    marimba(523, 0.32, 0.2, 0.9);
  },
  draw: () => {
    marimba(523, 0, 0.18);
    marimba(523, 0.14, 0.18);
    marimba(659, 0.28, 0.2, 0.8);
  },
  /** Würfeln: ein paar schnelle Holz-Klicks */
  dice: () => [0, 0.06, 0.13, 0.21].forEach((at, i) => wood(at, 0.12 - i * 0.015, 900 + Math.random() * 500, 600)),
  /** Karte ziehen */
  take: () => wood(0, 0.12, 800, 520),
  /** Schiffe versenken: Treffer */
  hit: () => {
    marimba(196, 0, 0.26, 0.5);
    noise(120, 0.05, 400, 120);
  },
  /** Schiffe versenken: ins Wasser */
  splash: () => noise(160, 0.05, 1400, 380),
};

export type SoundStyle = 'soft' | 'retro';
let style: SoundStyle = 'soft';

/** Welcher Klang gerade gilt: „soft“ (Lern- und Brettspiele, Menüs) oder „retro“ (Arcade). Setzt der Spiel-Bildschirm. */
export function setSoundStyle(s: SoundStyle) {
  style = s;
}
export const soundStyle = () => style;

const pick = (softSound: () => void, retroSound: () => void) => () => (style === 'soft' ? softSound() : retroSound());

export const sfx = {
  tap: pick(soft.tap, () => tone(660, 45)),
  flip: pick(soft.flip, () => tone(520, 35, 'triangle', 0.06)),
  bounce: () => tone(440, 40),
  wall: () => tone(250, 35),
  brick: () => tone(700 + Math.random() * 300, 45),
  eat: () => tone(880, 70, 'square', 0.05, 1320),
  point: pick(soft.star, () => melody([660, 990], 80, 90)),
  match: pick(soft.right, () => melody([784, 1047], 90, 110, 'triangle')),
  miss: pick(soft.wrong, () => tone(240, 320, 'sawtooth', 0.04, 70)),
  win: pick(soft.win, () => melody([523, 659, 784, 1047, 1319], 100, 150)),
  lose: pick(soft.lose, () => melody([392, 330, 262, 196], 130, 170, 'triangle')),
  draw: pick(soft.draw, () => melody([523, 523, 659], 120, 120, 'triangle')),
  dice: pick(soft.dice, () => tone(480 + Math.random() * 240, 60, 'triangle', 0.05)),
  take: pick(soft.take, () => tone(300, 60, 'triangle', 0.05)),
  hit: pick(soft.hit, () => tone(220, 160, 'sawtooth', 0.05, 90)),
  splash: pick(soft.splash, () => tone(700, 70, 'sine', 0.04, 400)),
};

export function buzz(ms: number | number[] = 18) {
  // Ohne vorheriges Tippen blockt der Browser die Vibration (und meckert in der Konsole).
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Vibration nicht verfügbar
  }
}

// ───────────────────────── Touch ─────────────────────────

/** Elemente, die ihr normales Tippverhalten behalten: Knöpfe, Links, Eingabefelder und Listen zum Scrollen (data-free). */
const TAP_FREE = 'button, a, input, textarea, select, label, [contenteditable], [data-free]';
const EDITABLE = 'input, textarea, select, [contenteditable]';

function editable(t: EventTarget | null) {
  return t instanceof Element && !!t.closest(EDITABLE);
}

/** Liegt der Finger in einer Liste, die gerade wirklich scrollen kann? Dann darf er sie auch scrollen. */
function inScroller(t: Element, root: Element) {
  for (let el: Element | null = t; el && el !== root; el = el.parentElement) {
    const st = getComputedStyle(el);
    if (/auto|scroll/.test(st.overflowY) && el.scrollHeight > el.clientHeight + 1) return true;
    if (/auto|scroll/.test(st.overflowX) && el.scrollWidth > el.clientWidth + 1) return true;
  }
  return false;
}

/**
 * Kein Markieren, keine Lupe, kein Kopieren-Menü – in keinem Spiel: Ein langer Finger auf dem Bildschirm heißt
 * Lenken, Kämpfen oder Ziehen. Gilt für den ganzen Spielbildschirm (und die App dahinter), solange er offen ist.
 * Knöpfe, Eingabefelder und scrollbare Listen bleiben bedienbar.
 */
export function useTouchLock(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const html = document.documentElement;
    html.classList.add('touch-lock');
    const touch = (e: TouchEvent) => {
      const t = e.target;
      if (!(t instanceof Element) || t.closest(TAP_FREE) || inScroller(t, el)) return;
      if (e.cancelable) e.preventDefault();
      // Ohne Standardverhalten schließt ein Tipp daneben die Tastatur nicht mehr von selbst.
      if (e.type === 'touchstart' && editable(document.activeElement)) (document.activeElement as HTMLElement).blur();
    };
    const block = (e: Event) => {
      if (!editable(e.target) && e.cancelable) e.preventDefault();
    };
    const unselect = () => {
      if (editable(document.activeElement)) return;
      const sel = document.getSelection();
      if (sel && !sel.isCollapsed) sel.removeAllRanges();
    };
    const opts = { passive: false } as const;
    el.addEventListener('touchstart', touch, opts);
    el.addEventListener('touchmove', touch, opts);
    document.addEventListener('contextmenu', block);
    document.addEventListener('selectstart', block);
    document.addEventListener('dragstart', block);
    document.addEventListener('gesturestart', block, opts);
    document.addEventListener('selectionchange', unselect);
    return () => {
      html.classList.remove('touch-lock');
      el.removeEventListener('touchstart', touch);
      el.removeEventListener('touchmove', touch);
      document.removeEventListener('contextmenu', block);
      document.removeEventListener('selectstart', block);
      document.removeEventListener('dragstart', block);
      document.removeEventListener('gesturestart', block);
      document.removeEventListener('selectionchange', unselect);
    };
  }, []);
}

// ───────────────────────── Spielschleife ─────────────────────────

/** requestAnimationFrame-Schleife mit Zeitschritt in Sekunden (gedeckelt, damit nach dem App-Wechsel nichts springt). */
export function useLoop(step: (dt: number) => void, running: boolean) {
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      stepRef.current(dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);
}

/**
 * Canvas, das sich in seinen Container einpasst. Gezeichnet wird in logischen Koordinaten (w × h),
 * Skalierung und Retina-Schärfe übernimmt der Hook.
 */
export function useFitCanvas(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const fit = () => {
      const r = wrap.getBoundingClientRect();
      const s = Math.max(Math.min(r.width / w, r.height / h), 0.1);
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.style.width = `${Math.floor(w * s)}px`;
      canvas.style.height = `${Math.floor(h * s)}px`;
      canvas.width = Math.round(w * s * dpr);
      canvas.height = Math.round(h * s * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(s * dpr, 0, 0, s * dpr, 0, 0);
      drawRef.current(ctx);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [w, h]);

  const paint = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) drawRef.current(ctx);
  };

  /** Bildschirm-Koordinaten → logische Spielfeld-Koordinaten */
  const toLogical = (clientX: number, clientY: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * w, y: ((clientY - r.top) / r.height) * h };
  };

  return { wrapRef, canvasRef, paint, toLogical };
}

/**
 * Canvas, das den ganzen Container ausfüllt (für Spiele, die sich jeder Bildschirmform anpassen).
 * `draw` bekommt die Größe in CSS-Pixeln; die Retina-Schärfe ist schon eingerechnet.
 */
export function useFillCanvas(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, maxDpr = 2) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useRef({ w: 0, h: 0, dpr: 1 });
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const fit = () => {
      const r = wrap.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      size.current = { w: r.width, h: r.height, dpr };
      canvas.style.width = `${r.width}px`;
      canvas.style.height = `${r.height}px`;
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawRef.current(ctx, r.width, r.height);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [maxDpr]);

  const paint = () => {
    const ctx = canvasRef.current?.getContext('2d');
    const { w, h, dpr } = size.current;
    if (!ctx || !w) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawRef.current(ctx, w, h);
  };

  return { wrapRef, canvasRef, paint, size };
}

export function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/** Ganze Ellipse als eigener Teilpfad – mehrere hintereinander verbinden sich so nicht zu Keilen. */
export function oval(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot));
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

/** Herzform als Pfad (Mitte x/y, Größe r) – füllen oder umranden macht der Aufrufer. */
export function heartPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.8, y - r * 1.3, x, y - r * 0.45);
  ctx.bezierCurveTo(x + r * 0.8, y - r * 1.3, x + r * 1.6, y - r * 0.2, x, y + r * 0.9);
  ctx.closePath();
}

/** Kleine Partikel für Treffer, Funken und Konfetti – in Spiel-Koordinaten. */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  /** Schwerkraft (px/s²) */
  g?: number;
  heart?: boolean;
}

export function burst(list: Particle[], x: number, y: number, color: string, n = 12, speed = 120, opts: Partial<Particle> = {}) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.35 + Math.random() * 0.75);
    const life = 0.35 + Math.random() * 0.45;
    list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, size: 1.5 + Math.random() * 2.5, color, g: 0, ...opts });
  }
}

export function stepParticles(list: Particle[], dt: number) {
  for (const p of list) {
    p.life -= dt;
    p.vy += (p.g ?? 0) * dt;
    p.vx *= 1 - dt * 1.8;
    p.vy *= 1 - dt * 1.2;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  let w = 0;
  for (const p of list) if (p.life > 0) list[w++] = p;
  list.length = w;
}

export function drawParticles(ctx: CanvasRenderingContext2D, list: Particle[]) {
  for (const p of list) {
    const k = Math.max(0, p.life / p.max);
    ctx.globalAlpha = Math.min(1, k * 1.6);
    ctx.fillStyle = p.color;
    if (p.heart) {
      heartPath(ctx, p.x, p.y, p.size * (0.6 + k * 0.4));
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.4 + k * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/** Text mit dunklem Rand – für Punktzahlen mitten im Spielfeld. */
export function outlinedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fill = '#fff', stroke = 'rgba(40,10,40,0.55)', width = 4) {
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}
