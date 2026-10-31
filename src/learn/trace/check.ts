import { dist, length, polyDist, resample, type Pt } from './path';
import { DIGITS, digitLayout } from './shapes';

/**
 * Strichprüfung fürs Nachspuren. Geprüft wird jeder Strich einzeln gegen den Strich, der gerade
 * dran ist: Startpunkt, Richtung (der Finger muss die Soll-Linie von Anfang bis Ende abfahren),
 * Abdeckung (die Soll-Linie ist bedeckt) und Genauigkeit (kein Gekritzel daneben).
 */

export interface Tolerance {
  /** Wie weit der Finger neben der Linie sein darf (Feld-Einheiten) */
  tol: number;
  /** Wie nah am Startpunkt man ansetzen muss */
  start: number;
}

/** Leicht, Mittel, Schwer */
export const TOLERANCE: Tolerance[] = [
  { tol: 14, start: 18 },
  { tol: 10, start: 14 },
  { tol: 8, start: 12 },
];

const N = 48;
/** Wie weit die Ausrichtung pro Punkt nach vorn springen darf (von N) */
const WINDOW = 7;

export interface StrokeResult {
  ok: boolean;
  /** 0–1: wie sauber */
  quality: number;
  /** Warum nicht (für Tests und Hinweise) */
  why?: 'short' | 'start' | 'direction' | 'coverage' | 'messy';
}

/**
 * Fährt die gezeichneten Punkte der Reihe nach an der Soll-Linie entlang – nur vorwärts.
 * Wer andersherum zeichnet, kommt nicht voran und ist weit weg.
 */
function align(drawn: Pt[], target: Pt[]) {
  let cur = 0;
  let sum = 0;
  for (const p of drawn) {
    let best = cur;
    let bd = Infinity;
    const to = Math.min(target.length - 1, cur + WINDOW);
    for (let j = cur; j <= to; j++) {
      const d = dist(p, target[j]);
      if (d < bd) {
        bd = d;
        best = j;
      }
    }
    cur = best;
    sum += bd;
  }
  return { end: cur / (target.length - 1), mean: sum / Math.max(1, drawn.length) };
}

export function checkStroke(drawnRaw: Pt[], targetRaw: Pt[], t: Tolerance): StrokeResult {
  const targetLen = length(targetRaw);
  if (drawnRaw.length < 2 || length(drawnRaw) < Math.min(10, targetLen * 0.3)) return { ok: false, quality: 0, why: 'short' };
  if (dist(drawnRaw[0], targetRaw[0]) > t.start) return { ok: false, quality: 0, why: 'start' };
  const drawn = resample(drawnRaw, N);
  const target = resample(targetRaw, N);
  const a = align(drawn, target);
  const coverage = target.filter((p) => polyDist(p, drawn) <= t.tol).length / N;
  const precision = drawn.filter((p) => polyDist(p, target) <= t.tol * 1.3).length / N;
  const quality = Math.max(0, Math.min(1, (coverage + precision) / 2 - Math.max(0, a.mean - t.tol * 0.5) / (t.tol * 4)));
  // Richtung: Wer ein Viertel geschafft hat, muss auch im ersten Teil der Soll-Linie sein
  // (wichtig bei Formen, die sich kreuzen, wie der 8).
  const early = [0.15, 0.3].every((f) => polyDist(drawn[Math.round(f * (N - 1))], target.slice(0, Math.round((f + 0.2) * N))) <= t.tol * 1.3);
  // Bis (fast) ans Ende: höchstens ein Zehntel oder knapp die Toleranz darf fehlen
  const missing = (1 - a.end) * targetLen;
  if (!early || missing > Math.max(t.tol * 0.8, targetLen * 0.1) || a.mean > t.tol * 1.6) return { ok: false, quality, why: 'direction' };
  if (coverage < 0.8) return { ok: false, quality, why: 'coverage' };
  if (precision < 0.75) return { ok: false, quality, why: 'messy' };
  return { ok: true, quality };
}

/**
 * Wie weit ist der Finger auf der Soll-Linie schon gekommen? Für die „Schiene“: Die Linie füllt
 * sich mit Farbe, solange der Finger nah genug dran bleibt. Gibt den neuen Index zurück und ob der
 * Finger gerade daneben ist.
 */
export function advance(cur: number, p: Pt, target: Pt[], t: Tolerance): { cur: number; off: boolean } {
  let best = cur;
  let bd = Infinity;
  const to = Math.min(target.length - 1, cur + 10);
  for (let j = cur; j <= to; j++) {
    const d = dist(p, target[j]);
    if (d < bd) {
      bd = d;
      best = j;
    }
  }
  if (bd > t.tol * 1.6) return { cur, off: true };
  return { cur: best, off: false };
}

/** Sterne für ein Zeichen: Sauberkeit und wie oft es neu versucht werden musste. */
export function starsFor(qualities: number[], fails: number, helped: boolean): number {
  if (helped) return 1;
  const q = qualities.reduce((a, b) => a + b, 0) / Math.max(1, qualities.length);
  if (q >= 0.85 && fails === 0) return 3;
  if (q >= 0.7 && fails <= 2) return 2;
  return 1;
}

// ───── Freies Schreiben (ohne Vorlage) ─────

/**
 * Bringt die Striche eines Kästchens auf Vorlagen-Größe: gleiche Höhe, gleiche Mitte.
 * So zählt nur die Form, nicht wie groß oder wo genau im Kästchen das Kind geschrieben hat.
 */
function normalize(strokes: Pt[][], box: { x0: number; y0: number; x1: number; y1: number }): Pt[][] {
  const all = strokes.flat();
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const bx0 = Math.min(...xs);
  const bx1 = Math.max(...xs);
  const by0 = Math.min(...ys);
  const by1 = Math.max(...ys);
  const h = Math.max(1, by1 - by0);
  const s = (box.y1 - box.y0) / h;
  const cx = (bx0 + bx1) / 2;
  const cy = (by0 + by1) / 2;
  const tx = (box.x0 + box.x1) / 2;
  const ty = (box.y0 + box.y1) / 2;
  return strokes.map((st) => st.map(([x, y]) => [tx + (x - cx) * s, ty + (y - cy) * s] as Pt));
}

const cloudCache = new Map<string, { pts: Pt[]; lines: Pt[][]; box: { x0: number; y0: number; x1: number; y1: number } }>();
function template(ch: string) {
  let t = cloudCache.get(ch);
  if (!t) {
    const lines = digitLayout(ch).strokes;
    const all = lines.flat();
    const box = {
      x0: Math.min(...all.map((p) => p[0])),
      x1: Math.max(...all.map((p) => p[0])),
      y0: Math.min(...all.map((p) => p[1])),
      y1: Math.max(...all.map((p) => p[1])),
    };
    const total = lines.reduce((a, l) => a + length(l), 0);
    const pts = lines.flatMap((l) => resample(l, Math.max(4, Math.round((64 * length(l)) / total))));
    t = { pts, lines, box };
    cloudCache.set(ch, t);
  }
  return t;
}

/** Wie gut passen die Striche zu einer Ziffer? 0–1, ohne Richtung und Reihenfolge. */
export function matchDigit(strokes: Pt[][], ch: string, tol = 15): number {
  const tpl = template(ch);
  const norm = normalize(strokes, tpl.box);
  const drawn = norm.flatMap((st) => (st.length > 1 ? resample(st, Math.max(4, Math.round(length(st) / 2))) : st));
  if (!drawn.length) return 0;
  const near = (p: Pt, lines: Pt[][]) => Math.min(...lines.map((l) => polyDist(p, l)));
  const coverage = tpl.pts.filter((p) => near(p, norm) <= tol).length / tpl.pts.length;
  const precision = drawn.filter((p) => near(p, tpl.lines) <= tol).length / drawn.length;
  return Math.min(coverage, precision);
}

export interface FreeResult {
  ok: boolean;
  quality: number;
  /** Was das Kind am ehesten geschrieben hat */
  read: string;
}

/**
 * Freies Schreiben einer Zahl in Kästchen: Die Striche werden nach ihrer Mitte den Kästchen
 * zugeordnet; jedes Kästchen muss die richtige Ziffer enthalten und darf keiner anderen Ziffer
 * deutlich ähnlicher sehen.
 */
export function checkFree(strokes: Pt[][], expected: string, cells: { x: number; w: number }[]): FreeResult {
  const groups: Pt[][][] = cells.map(() => []);
  for (const st of strokes) {
    if (!st.length) continue;
    const xs = st.map((p) => p[0]);
    const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
    let k = 0;
    let bd = Infinity;
    cells.forEach((c, i) => {
      const d = Math.abs(c.x + c.w / 2 - mid);
      if (d < bd) {
        bd = d;
        k = i;
      }
    });
    groups[k].push(st);
  }
  let read = '';
  let okAll = true;
  let q = 0;
  [...expected].forEach((ch, i) => {
    const g = groups[i] ?? [];
    if (!g.length || g.every((st) => length(st) < 6)) {
      okAll = false;
      read += '?';
      return;
    }
    const scores = Object.keys(DIGITS).map((d) => ({ d, s: matchDigit(g, d) }));
    scores.sort((a, b) => b.s - a.s);
    const mine = scores.find((x) => x.d === ch)!.s;
    read += scores[0].d;
    q += mine;
    if (mine < 0.72 || scores[0].s - mine > 0.04) okAll = false;
  });
  return { ok: okAll, quality: q / expected.length, read };
}
