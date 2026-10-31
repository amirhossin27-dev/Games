import { pathPoints, resample, type Pt } from './path';

/**
 * Strich-Daten zum Nachspuren. Jedes Zeichen steht in einem Feld von 100 × 100 (y nach unten)
 * und besteht aus Strichen in Schreibreihenfolge. Jeder Strich ist ein SVG-Pfad mit absoluten
 * Befehlen. Ziffern nach der Druckschrift der Grundschule: oben anfangen, Bögen gegen den
 * Uhrzeigersinn, wo es die Schule so lehrt.
 */

export interface Glyph {
  /** Striche in Schreibreihenfolge (SVG-Pfade) */
  d: string[];
}

export const DIGITS: Record<string, Glyph> = {
  '0': { d: ['M 50 8 C 36.7 8 26 26.8 26 50 C 26 73.2 36.7 92 50 92 C 63.3 92 74 73.2 74 50 C 74 26.8 63.3 8 50 8'] },
  '1': { d: ['M 32 30 L 58 8 L 58 92'] },
  '2': { d: ['M 28 28 C 28 15 38 8 50 8 C 63 8 72 16 72 28 C 72 42 60 54 28 92 L 74 92'] },
  '3': { d: ['M 29 19 C 35 11 43 8 51 8 C 63 8 71 15 71 27 C 71 39 61 47 47 47 C 63 47 74 56 74 69 C 74 83 63 92 50 92 C 41 92 33 88 27 81'] },
  '4': { d: ['M 52 8 L 24 64 L 78 64', 'M 64 38 L 64 92'] },
  '5': { d: ['M 34 8 L 31 45 C 37 41 43 39 50 39 C 64 39 74 49 74 65 C 74 81 63 92 49 92 C 40 92 33 88 27 81', 'M 34 8 L 71 8'] },
  '6': { d: ['M 69 13 C 63 9 57 8 51 8 C 36 8 27 26 27 56 C 27 78 37 92 51 92 C 64 92 73 82 73 70 C 73 57 64 48 51 48 C 40 48 31 55 28 65'] },
  '7': { d: ['M 28 8 L 72 8 L 40 92'] },
  '8': { d: ['M 66 20 C 64 12 58 8 50 8 C 40 8 33 14 33 26 C 33 38 44 44 50 48 C 58 53 70 58 70 72 C 70 85 61 92 50 92 C 39 92 30 85 30 72 C 30 58 42 53 50 48 C 57 43 67 35 66 20'] },
  '9': { d: ['M 72 27 C 72 15 63 8 51 8 C 39 8 30 16 30 28 C 30 40 39 47 51 47 C 63 47 72 40 72 27 L 72 92'] },
};

/** Spirale von außen nach innen, gegen den Uhrzeigersinn */
function spiral(): string {
  const pts: string[] = [];
  const turns = 2.6;
  const steps = 90;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = -Math.PI / 2 - t * turns * 2 * Math.PI;
    const r = 42 * (1 - t * 0.86);
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)} ${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M ${pts.join(' L ')}`;
}

export interface Schwung extends Glyph {
  id: string;
  name: string;
  /** 0 = Leicht, 1 = Mittel, 2 = Schwer */
  level: 0 | 1 | 2;
}

/** Schwung-Übungen zur Vorbereitung aufs Schreiben, je ein Strich von links nach rechts. */
export const SCHWUNGE: Schwung[] = [
  { id: 'gerade', name: 'Gerade Straße', level: 0, d: ['M 10 50 L 90 50'] },
  { id: 'regen', name: 'Regen', level: 0, d: ['M 50 10 L 50 90'] },
  { id: 'rutsche', name: 'Rutsche', level: 0, d: ['M 14 14 L 86 86'] },
  { id: 'huegel', name: 'Hügel', level: 0, d: ['M 10 78 C 10 18 90 18 90 78'] },
  { id: 'welle', name: 'Welle', level: 0, d: ['M 8 50 C 16 22 32 22 38 50 C 44 78 62 78 68 50 C 72 30 84 26 92 38'] },
  { id: 'zickzack', name: 'Zickzack', level: 1, d: ['M 8 72 L 24 30 L 40 72 L 56 30 L 72 72 L 90 30'] },
  { id: 'girlande', name: 'Girlande', level: 1, d: ['M 8 32 C 8 76 30 76 30 32 C 30 76 52 76 52 32 C 52 76 74 76 74 32 C 74 64 84 70 92 60'] },
  { id: 'bruecke', name: 'Brücken', level: 1, d: ['M 8 72 C 8 28 30 28 30 72 C 30 28 52 28 52 72 C 52 28 74 28 74 72 C 74 28 92 28 92 72'] },
  { id: 'kreis', name: 'Kreis', level: 1, d: ['M 50 12 C 29 12 12 29 12 50 C 12 71 29 88 50 88 C 71 88 88 71 88 50 C 88 29 71 12 50 12'] },
  { id: 'treppe', name: 'Treppe', level: 1, d: ['M 10 88 L 10 68 L 30 68 L 30 48 L 50 48 L 50 28 L 70 28 L 70 10 L 90 10'] },
  { id: 'welle2', name: 'Große Welle', level: 1, d: ['M 6 50 C 12 12 26 12 30 50 C 34 88 48 88 52 50 C 56 12 70 12 74 50 C 78 88 92 88 94 60'] },
  { id: 'schlaufen', name: 'Schlaufen', level: 2, d: ['M 6 72 C 22 72 30 52 30 40 C 30 28 18 28 18 40 C 18 56 30 72 46 72 C 62 72 70 52 70 40 C 70 28 58 28 58 40 C 58 56 70 72 94 72'] },
  { id: 'spirale', name: 'Schneckenhaus', level: 2, d: [spiral()] },
  { id: 'berge', name: 'Berge', level: 2, d: ['M 6 84 L 20 30 L 34 84 L 50 16 L 64 84 L 78 44 L 94 84'] },
  { id: 'acht', name: 'Liegende Acht', level: 2, d: ['M 50 50 C 60 30 90 26 90 50 C 90 74 60 70 50 50 C 40 30 10 26 10 50 C 10 74 40 70 50 50'] },
  { id: 'kringel', name: 'Kringel', level: 2, d: ['M 6 70 C 18 70 26 58 26 48 C 26 38 16 38 16 48 C 16 62 26 70 38 70 C 50 70 58 58 58 48 C 58 38 48 38 48 48 C 48 62 58 70 70 70 C 82 70 90 58 90 48 C 90 38 80 38 80 48 C 80 62 88 70 96 70'] },
  { id: 'zacken', name: 'Zackenkrone', level: 2, d: ['M 8 80 L 8 30 L 30 58 L 50 22 L 70 58 L 92 30 L 92 80 Z'] },
];

export const SCHWUNG_BY_ID: Record<string, Schwung> = Object.fromEntries(SCHWUNGE.map((s) => [s.id, s]));

/** Abstand der Ziffern bei mehrstelligen Zahlen (Feld-Einheiten) */
export const DIGIT_ADVANCE = 64;

/** Dichte der Soll-Linien: ein Punkt etwa alle 1,5 Feld-Einheiten */
const DENSITY = 1.5;

export interface Layout {
  /** Was geschrieben wird (Zahl) bzw. Kennung des Schwungs */
  text: string;
  /** Breite der Zeichenfläche in Feld-Einheiten (Höhe immer 100) */
  w: number;
  /** Alle Striche in Schreibreihenfolge, schon an ihre Stelle geschoben, dicht abgetastet */
  strokes: Pt[][];
  /** Zu welchem Zeichen (Kästchen) gehört der Strich? */
  cellOf: number[];
  /** Linke Kante jedes Kästchens */
  cells: { x: number; w: number }[];
  /** Die SVG-Pfade, verschoben – zum Zeichnen der Vorlage */
  paths: { d: string; dx: number }[];
}

const cache = new Map<string, Pt[]>();
function sampled(d: string): Pt[] {
  let pts = cache.get(d);
  if (!pts) {
    const raw = pathPoints(d);
    let l = 0;
    for (let i = 1; i < raw.length; i++) l += Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]);
    pts = resample(raw, Math.max(12, Math.round(l / DENSITY)));
    cache.set(d, pts);
  }
  return pts;
}

/** Eine Zahl wie „17“ als Zeichenfläche mit Kästchen je Ziffer. */
export function digitLayout(text: string): Layout {
  const strokes: Pt[][] = [];
  const cellOf: number[] = [];
  const cells: { x: number; w: number }[] = [];
  const paths: { d: string; dx: number }[] = [];
  [...text].forEach((ch, i) => {
    const dx = i * DIGIT_ADVANCE;
    cells.push({ x: dx + 22, w: 56 });
    for (const d of DIGITS[ch].d) {
      strokes.push(sampled(d).map(([x, y]) => [x + dx, y] as Pt));
      cellOf.push(i);
      paths.push({ d, dx });
    }
  });
  return { text, w: 100 + (text.length - 1) * DIGIT_ADVANCE, strokes, cellOf, cells, paths };
}

export function schwungLayout(id: string): Layout {
  const s = SCHWUNG_BY_ID[id];
  return {
    text: id,
    w: 100,
    strokes: s.d.map((d) => sampled(d)),
    cellOf: s.d.map(() => 0),
    cells: [{ x: 0, w: 100 }],
    paths: s.d.map((d) => ({ d, dx: 0 })),
  };
}
