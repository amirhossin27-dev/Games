import { useEffect, useRef, useState } from 'react';
import { buzz, sfx } from '../arcade/engine';
import { checkFree, checkStroke, starsFor, TOLERANCE, advance } from '../learn/trace/check';
import { length, type Pt } from '../learn/trace/path';
import type { Layout } from '../learn/trace/shapes';
import type { Level } from '../lib/store';
import { Icon } from './Icon';

/**
 * Zeichenfläche zum Nachspuren. Das Kind fährt mit dem Finger (oder Stift, oder Maus) die Vorlage
 * nach. Ein grüner Punkt mit Nummer zeigt, wo der nächste Strich anfängt, ein Pfeil die Richtung.
 * Leicht: dicke Spur, die sich beim Nachfahren füllt, und die Hand macht es einmal vor.
 * Mittel: gestrichelte Linie. Schwer: dünne Linie – oder (frei) gar keine Vorlage.
 */

export interface TraceResult {
  /** 0 = nicht geschafft (nur frei schreiben), sonst 1–3 */
  stars: number;
  ok: boolean;
  /** Frei schreiben: was erkannt wurde */
  read?: string;
}

interface Props {
  layout: Layout;
  level: Level;
  /** Ohne Vorlage selbst schreiben (wird als Ganzes geprüft) */
  free?: boolean;
  /** Farbe der Striche des Kindes */
  color: string;
  /** Schwung-Strecke: Wer fährt mit, was ist das Ziel? */
  mover?: { e: string; goal: string };
  /** Hand spielt die Vorlage gleich zu Beginn einmal vor */
  autoDemo?: boolean;
  disabled?: boolean;
  /** Nach dem Ende die richtige Lösung zeigen (frei schreiben, nicht geschafft) */
  showAnswer?: boolean;
  onDone(r: TraceResult): void;
}

const PAD = 9;
const GREEN = '#417A4D';
const TRACK = '#E3DDCF';
const GUIDE = '#8C9690';

interface Fade {
  pts: Pt[];
  at: number;
}

export function TracePad({ layout, level, free = false, color, mover, autoDemo = false, disabled = false, showAnswer = false, onDone }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [cssW, setCssW] = useState(320);
  const tol = TOLERANCE[level];
  const style: 'thick' | 'dashed' | 'thin' = level === 0 ? 'thick' : level === 1 ? 'dashed' : 'thin';

  // Spielstand der Fläche – in Refs, damit Fingerbewegungen nicht jedes Mal React neu rendern lassen.
  const st = useRef({
    k: 0,
    qualities: [] as number[],
    fails: 0,
    totalFails: 0,
    helped: false,
    ink: null as Pt[] | null,
    rail: 0,
    pointer: -1,
    fades: [] as Fade[],
    freeInk: [] as Pt[][],
    shakeAt: 0,
    demo: null as { from: number; at: number } | null,
    autoFill: null as { at: number } | null,
    finished: false,
    tries: 0,
    dirty: true,
    gen: 0,
  });
  const [done, setDone] = useState(false);
  const [freeCount, setFreeCount] = useState(0);
  const [note, setNote] = useState('');
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Neue Vorlage: alles zurück auf Anfang
  useEffect(() => {
    const s = st.current;
    Object.assign(s, { k: 0, qualities: [], fails: 0, totalFails: 0, helped: false, ink: null, rail: 0, pointer: -1, fades: [], freeInk: [], shakeAt: 0, demo: null, autoFill: null, finished: false, tries: 0, dirty: true, gen: s.gen + 1 });
    setFreeCount(0);
    setDone(false);
    setNote('');
    if (autoDemo && !free) s.demo = { from: 0, at: performance.now() + 350 };
  }, [layout]);

  // Breite messen
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCssW(el.clientWidth));
    ro.observe(el);
    setCssW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const viewW = layout.w + PAD * 2;
  const viewH = 100 + PAD * 2;
  const maxW = Math.min(cssW, layout.w > 100 ? 560 : 400);
  const scale = maxW / viewW;
  const cssH = viewH * scale;

  // Zeichnen (läuft, solange etwas animiert oder sich geändert hat)
  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.round(maxW * dpr);
    cv.height = Math.round(cssH * dpr);
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    st.current.dirty = true;

    const line = (pts: Pt[], w: number, c: string, alpha = 1, dash?: number[]) => {
      if (pts.length < 2) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
      ctx.restore();
    };
    const emoji = (e: string, p: Pt, size: number) => {
      ctx.save();
      ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(e, p[0], p[1] + size * 0.05);
      ctx.restore();
    };
    /** Punkt auf der Linie nach Anteil t (0–1) */
    const at = (pts: Pt[], t: number): Pt => pts[Math.min(pts.length - 1, Math.max(0, Math.round(t * (pts.length - 1))))];

    const draw = (now: number) => {
      const s = st.current;
      const animating = !!s.demo || !!s.autoFill || s.fades.length > 0 || now - s.shakeAt < 600;
      if (!s.dirty && !animating) {
        raf = requestAnimationFrame(draw);
        return;
      }
      s.dirty = false;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, PAD * dpr * scale, PAD * dpr * scale);
      const strokes = layout.strokes;

      if (free) {
        // Kästchen wie im Heft, ohne Vorlage
        for (const c of layout.cells) {
          ctx.save();
          ctx.strokeStyle = '#D6CFBF';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([3, 3]);
          ctx.strokeRect(c.x - 4, 2, c.w + 8, 96);
          ctx.restore();
          line([[c.x - 4, 92], [c.x + c.w + 4, 92]], 1.4, '#C8BFAE');
        }
        if (showAnswer) strokes.forEach((p) => line(p, 3, GUIDE, 0.45, [4, 4]));
        s.freeInk.forEach((p) => line(p, 5.5, color));
        if (s.ink) line(s.ink, 5.5, color);
      } else {
        // Vorlage für die noch offenen Striche
        strokes.forEach((p, i) => {
          if (i < s.k) return;
          if (style === 'thick') line(p, 15, TRACK);
          else if (style === 'dashed') line(p, 2.6, GUIDE, 0.8, [5, 4]);
          else line(p, 1.6, GUIDE, 0.5, [1.5, 3]);
        });
        // Fertige Striche sauber in der Farbe des Kindes
        strokes.forEach((p, i) => i < s.k && line(p, 7, color));
        const cur = strokes[s.k];
        if (cur && !s.finished) {
          // Schiene: so weit, wie der Finger gekommen ist
          if (s.ink && style !== 'thin') line(cur.slice(0, s.rail + 1), 7, color, 0.9);
          // Automatisch ergänzen (nach drei Fehlversuchen)
          if (s.autoFill) {
            const t = Math.min(1, (now - s.autoFill.at) / 900);
            line(cur.slice(0, Math.max(2, Math.round(t * cur.length))), 7, color, 0.7);
          }
          // Schwung-Strecke: Ziel und Fahrer (wartet vor dem Startpunkt, damit der frei bleibt)
          if (mover) {
            emoji(mover.goal, cur[cur.length - 1], 15);
            if (s.ink && s.rail > 0) emoji(mover.e, cur[s.rail], 16);
            else {
              const a = at(cur, Math.min(0.5, 14 / Math.max(14, length(cur))));
              const ang = Math.atan2(a[1] - cur[0][1], a[0] - cur[0][0]);
              emoji(mover.e, [cur[0][0] - Math.cos(ang) * 13, cur[0][1] - Math.sin(ang) * 13], 15);
            }
          }
          // Start: grüner Punkt mit Nummer, wackelt nach einem Fehlversuch
          const shake = now - s.shakeAt < 600 ? Math.sin((now - s.shakeAt) / 30) * 2.5 : 0;
          const [sx, sy] = cur[0];
          {
            // Pfeil in Strichrichtung
            const a = at(cur, Math.min(0.5, 14 / Math.max(14, length(cur))));
            const ang = Math.atan2(a[1] - sy, a[0] - sx);
            ctx.save();
            ctx.translate(sx + Math.cos(ang) * 13, sy + Math.sin(ang) * 13);
            ctx.rotate(ang);
            ctx.fillStyle = GREEN;
            ctx.globalAlpha = 0.85;
            ctx.beginPath();
            ctx.moveTo(4, 0);
            ctx.lineTo(-3, -4);
            ctx.lineTo(-3, 4);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
          ctx.save();
          ctx.fillStyle = GREEN;
          ctx.beginPath();
          ctx.arc(sx + shake, sy, 6.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = '800 8.5px Grandstander, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(s.k + 1), sx + shake, sy + 0.5);
          ctx.restore();
        } else if (mover && strokes.length) {
          emoji(mover.e, strokes[strokes.length - 1][strokes[strokes.length - 1].length - 1], 18);
        }
        // Fehlversuche verblassen
        s.fades = s.fades.filter((f) => now - f.at < 650);
        s.fades.forEach((f) => line(f.pts, 5, '#B5532E', 0.55 * (1 - (now - f.at) / 650)));
        // Eigener Strich des Kindes
        if (s.ink) line(s.ink, style === 'thick' ? 4 : 5, color, style === 'thick' ? 0.45 : 0.85);
        // Vorspielen: ein Finger fährt den Strich ab
        if (s.demo) {
          const d = s.demo;
          const p = strokes[d.from];
          if (!p || now < d.at) {
            if (!p) s.demo = null;
          } else {
            const ms = 600 + length(p) * 9;
            const t = (now - d.at) / ms;
            if (t >= 1.25) {
              s.demo = d.from + 1 < strokes.length && d.from + 1 >= s.k ? { from: d.from + 1, at: now + 150 } : null;
            } else {
              const upto = Math.max(2, Math.round(Math.min(1, t) * p.length));
              line(p.slice(0, upto), 6, '#F2C94C', 0.9);
              const [hx, hy] = p[upto - 1];
              ctx.save();
              ctx.fillStyle = '#FFFDF8';
              ctx.strokeStyle = '#2D3A31';
              ctx.lineWidth = 1.6;
              ctx.beginPath();
              ctx.arc(hx, hy, 5.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
              ctx.restore();
              emoji('👆', [hx + 4, hy + 9], 13);
            }
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [layout, maxW, cssH, scale, color, free, showAnswer, mover?.e]);

  const toUnits = (e: { clientX: number; clientY: number }): Pt => {
    const r = canvas.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / scale - PAD, (e.clientY - r.top) / scale - PAD];
  };

  const finish = (r: TraceResult) => {
    const s = st.current;
    s.finished = true;
    s.dirty = true;
    setDone(true);
    setNote('');
    onDoneRef.current(r);
  };

  /** Strich geschafft (oder ergänzt) – weiter zum nächsten */
  const nextStroke = () => {
    const s = st.current;
    s.k++;
    s.fails = 0;
    s.dirty = true;
    if (s.k >= layout.strokes.length) {
      const stars = starsFor(s.qualities, s.totalFails, s.helped);
      if (stars === 3) sfx.point();
      else sfx.match();
      finish({ stars, ok: true });
    }
  };

  const strokeEnded = (ink: Pt[]) => {
    const s = st.current;
    const target = layout.strokes[s.k];
    if (!target) return;
    // Nur kurz angetippt: einfach ignorieren
    if (length(ink) < 4) return;
    const r = checkStroke(ink, target, tol);
    if (r.ok) {
      s.qualities.push(r.quality);
      sfx.tap();
      nextStroke();
      return;
    }
    s.fails++;
    s.totalFails++;
    s.fades.push({ pts: ink, at: performance.now() });
    s.shakeAt = performance.now();
    buzz(30);
    setNote(r.why === 'start' ? 'Fang beim grünen Punkt an.' : r.why === 'direction' ? 'Folge dem Pfeil bis zum Ende.' : 'Bleib auf der Linie.');
    if (s.fails >= 3) {
      // Nicht verzweifeln lassen: Die Hand zeigt es, dann füllt sich der Strich von selbst.
      s.helped = true;
      s.autoFill = { at: performance.now() + 200 };
      const gen = s.gen;
      window.setTimeout(() => {
        if (s.gen !== gen) return;
        s.autoFill = null;
        s.qualities.push(0.5);
        setNote('');
        nextStroke();
      }, 1200);
    }
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = st.current;
    if (disabled || s.finished || s.autoFill || s.pointer !== -1 || !e.isPrimary) return;
    e.preventDefault();
    canvas.current!.setPointerCapture(e.pointerId);
    s.pointer = e.pointerId;
    s.demo = null;
    setNote('');
    s.ink = [toUnits(e)];
    s.rail = 0;
    s.dirty = true;
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = st.current;
    if (e.pointerId !== s.pointer || !s.ink) return;
    const events = (e.nativeEvent.getCoalescedEvents?.() ?? []) as PointerEvent[];
    const list = events.length ? events : [e.nativeEvent];
    const target = free ? null : layout.strokes[s.k];
    // Die Schiene füllt sich nur, wenn am Startpunkt angesetzt wurde
    const onRail = target && Math.hypot(s.ink[0][0] - target[0][0], s.ink[0][1] - target[0][1]) <= tol.start;
    for (const ev of list) {
      const p = toUnits(ev);
      s.ink.push(p);
      if (target && onRail) s.rail = advance(s.rail, p, target, tol).cur;
    }
    s.dirty = true;
  };
  const up = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = st.current;
    if (e.pointerId !== s.pointer) return;
    s.pointer = -1;
    const ink = s.ink;
    s.ink = null;
    s.dirty = true;
    if (!ink) return;
    if (free) {
      if (length(ink) >= 2 || ink.length === 1) {
        s.freeInk.push(ink.length === 1 ? [ink[0], [ink[0][0] + 0.5, ink[0][1] + 0.5]] : ink);
        setFreeCount(s.freeInk.length);
        setNote('');
      }
      return;
    }
    if (e.type === 'pointercancel') return;
    strokeEnded(ink);
  };

  const undo = () => {
    const s = st.current;
    s.freeInk.pop();
    s.dirty = true;
    setFreeCount(s.freeInk.length);
  };
  const clear = () => {
    const s = st.current;
    s.freeInk = [];
    s.dirty = true;
    setFreeCount(0);
  };
  const submit = (expected: string) => {
    const s = st.current;
    const r = checkFree(s.freeInk, expected, layout.cells);
    if (r.ok) {
      const stars = s.tries === 0 && r.quality >= 0.85 ? 3 : 2;
      if (stars === 3) sfx.point();
      else sfx.match();
      finish({ stars, ok: true, read: r.read });
      return;
    }
    s.tries++;
    sfx.miss();
    buzz(60);
    if (s.tries >= 2) {
      finish({ stars: 0, ok: false, read: r.read });
      return;
    }
    s.freeInk = [];
    s.dirty = true;
    setFreeCount(0);
    setNote('Das passt noch nicht. Schau nochmal genau hin und schreib neu.');
  };

  const showDemo = () => {
    const s = st.current;
    if (s.finished || free) return;
    s.demo = { from: s.k, at: performance.now() };
    s.dirty = true;
  };

  return (
    <div className="trace" ref={wrap}>
      <canvas
        ref={canvas}
        className="trace-canvas"
        style={{ width: maxW, height: cssH }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        aria-label={free ? 'Schreibfläche' : 'Fläche zum Nachspuren'}
      />
      {note && !disabled && (
        <p className="trace-note" role="status">
          {note}
        </p>
      )}
      {!disabled && !done && (
        <div className="row trace-tools">
          {free ? (
            <>
              <button type="button" className="btn ghost small" onClick={undo} disabled={!freeCount}>
                Zurück
              </button>
              <button type="button" className="btn ghost small" onClick={clear} disabled={!freeCount}>
                Löschen
              </button>
              <button type="button" className="btn primary small" onClick={() => submit(layout.text)} disabled={!freeCount}>
                <Icon name="check" size={18} stroke={3} /> Fertig
              </button>
            </>
          ) : (
            <button type="button" className="btn ghost small" onClick={showDemo}>
              👆 Zeig's mir
            </button>
          )}
        </div>
      )}
    </div>
  );
}
