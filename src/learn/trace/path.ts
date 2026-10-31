/**
 * Kleine Geometrie-Helfer fürs Nachspuren: SVG-Pfade (nur absolute Befehle M L H V Q C A Z)
 * in Punktfolgen umwandeln, Punktfolgen gleichmäßig machen und Abstände messen.
 * Alles in Feld-Einheiten (ein Zeichen steht in einem Feld von 100 × 100).
 */

export type Pt = [number, number];

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Länge einer Punktfolge */
export function length(pts: Pt[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1], pts[i]);
  return l;
}

/** Punktfolge auf `n` gleich weit voneinander entfernte Punkte umrechnen. */
export function resample(pts: Pt[], n: number): Pt[] {
  if (pts.length === 0) return [];
  if (pts.length === 1 || n < 2) return Array.from({ length: Math.max(1, n) }, () => [pts[0][0], pts[0][1]] as Pt);
  const total = length(pts);
  if (total === 0) return Array.from({ length: n }, () => [pts[0][0], pts[0][1]] as Pt);
  const step = total / (n - 1);
  const out: Pt[] = [[pts[0][0], pts[0][1]]];
  let acc = 0;
  let prev = pts[0];
  for (let i = 1; i < pts.length && out.length < n; i++) {
    let cur = pts[i];
    let d = dist(prev, cur);
    while (acc + d >= step && out.length < n) {
      const t = (step - acc) / d;
      const q: Pt = [prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])];
      out.push(q);
      prev = q;
      d = dist(prev, cur);
      acc = 0;
    }
    acc += d;
    prev = cur;
    cur = pts[i];
  }
  while (out.length < n) out.push([pts[pts.length - 1][0], pts[pts.length - 1][1]]);
  return out;
}

/** Kürzester Abstand eines Punkts zu einer Strecke */
export function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Kürzester Abstand eines Punkts zu einer Punktfolge (als Linienzug) */
export function polyDist(p: Pt, line: Pt[]): number {
  if (line.length === 1) return dist(p, line[0]);
  let best = Infinity;
  for (let i = 1; i < line.length; i++) best = Math.min(best, segDist(p, line[i - 1], line[i]));
  return best;
}

export { dist };

// ───── SVG-Pfad → Punkte ─────

function arcPoints(from: Pt, rx: number, ry: number, rotDeg: number, large: boolean, sweep: boolean, to: Pt, out: Pt[]) {
  // Endpunkt- in Mittelpunkt-Darstellung umrechnen (SVG-Spezifikation, Anhang F.6)
  const phi = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (from[0] - to[0]) / 2;
  const dy = (from[1] - to[1]) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lam > 1) {
    rx *= Math.sqrt(lam);
    ry *= Math.sqrt(lam);
  }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  let co = Math.sqrt(Math.max(0, num / den));
  if (large === sweep) co = -co;
  const cx1 = (co * rx * y1) / ry;
  const cy1 = (-co * ry * x1) / rx;
  const cx = cos * cx1 - sin * cy1 + (from[0] + to[0]) / 2;
  const cy = sin * cx1 + cos * cy1 + (from[1] + to[1]) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const t1 = ang(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let dt = ang((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const steps = Math.max(8, Math.ceil(Math.abs(dt) * 12));
  for (let i = 1; i <= steps; i++) {
    const t = t1 + (dt * i) / steps;
    const ex = rx * Math.cos(t);
    const ey = ry * Math.sin(t);
    out.push([cos * ex - sin * ey + cx, sin * ex + cos * ey + cy]);
  }
}

/** Ein SVG-Pfad (ein Strich) als Punktfolge. */
export function pathPoints(d: string): Pt[] {
  const tokens = d.match(/[MLHVQCAZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const out: Pt[] = [];
  let i = 0;
  let cmd = '';
  let cur: Pt = [0, 0];
  let start: Pt = [0, 0];
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++].toUpperCase();
    switch (cmd) {
      case 'M':
        cur = [num(), num()];
        start = cur;
        out.push(cur);
        cmd = 'L';
        break;
      case 'L':
        cur = [num(), num()];
        out.push(cur);
        break;
      case 'H':
        cur = [num(), cur[1]];
        out.push(cur);
        break;
      case 'V':
        cur = [cur[0], num()];
        out.push(cur);
        break;
      case 'Q': {
        const c: Pt = [num(), num()];
        const e: Pt = [num(), num()];
        for (let k = 1; k <= 16; k++) {
          const t = k / 16;
          const u = 1 - t;
          out.push([u * u * cur[0] + 2 * u * t * c[0] + t * t * e[0], u * u * cur[1] + 2 * u * t * c[1] + t * t * e[1]]);
        }
        cur = e;
        break;
      }
      case 'C': {
        const c1: Pt = [num(), num()];
        const c2: Pt = [num(), num()];
        const e: Pt = [num(), num()];
        for (let k = 1; k <= 20; k++) {
          const t = k / 20;
          const u = 1 - t;
          out.push([
            u * u * u * cur[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * e[0],
            u * u * u * cur[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * e[1],
          ]);
        }
        cur = e;
        break;
      }
      case 'A': {
        const rx = num();
        const ry = num();
        const rot = num();
        const large = num() === 1;
        const sweep = num() === 1;
        const e: Pt = [num(), num()];
        arcPoints(cur, rx, ry, rot, large, sweep, e, out);
        cur = e;
        break;
      }
      case 'Z':
        cur = start;
        out.push(cur);
        break;
      default:
        i++;
    }
  }
  return out;
}
