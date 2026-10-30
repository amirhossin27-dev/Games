import type { GameDef } from '../../engine/game';
import type { Level } from '../../lib/store';
import { placesFromScores, type Rnd } from '../../lib/util';

/**
 * Würfelglück (Regeln wie Kniffel, nach Arta) für 1–4 Kinder: 5 Würfel, bis zu 3 Würfe pro Zug.
 * Auf „Leicht“ gibt es einen kürzeren Block (nur Einser bis Sechser, Chance und Würfelglück).
 */

export type KCat = 'ones' | 'twos' | 'threes' | 'fours' | 'fives' | 'sixes' | 'three' | 'four' | 'full' | 'small' | 'large' | 'lucky' | 'chance';

export const UPPER: KCat[] = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
export const LOWER: KCat[] = ['three', 'four', 'full', 'small', 'large', 'lucky', 'chance'];
export const EASY_LOWER: KCat[] = ['chance', 'lucky'];

export const catsFor = (level: Level): KCat[] => [...UPPER, ...(level === 0 ? EASY_LOWER : LOWER)];

export const KCAT_LABEL: Record<KCat, string> = {
  ones: 'Einser',
  twos: 'Zweier',
  threes: 'Dreier',
  fours: 'Vierer',
  fives: 'Fünfer',
  sixes: 'Sechser',
  three: 'Dreierpasch',
  four: 'Viererpasch',
  full: 'Full House',
  small: 'Kleine Straße',
  large: 'Große Straße',
  lucky: 'Würfelglück',
  chance: 'Chance',
};

export const KCAT_HINT: Record<KCat, string> = {
  ones: 'Einser zusammenzählen',
  twos: 'Zweier zusammenzählen',
  threes: 'Dreier zusammenzählen',
  fours: 'Vierer zusammenzählen',
  fives: 'Fünfer zusammenzählen',
  sixes: 'Sechser zusammenzählen',
  three: '3 gleiche – alle Augen',
  four: '4 gleiche – alle Augen',
  full: '3 + 2 gleiche – 25',
  small: '4 in einer Reihe – 30',
  large: '5 in einer Reihe – 40',
  lucky: '5 gleiche – 50',
  chance: 'alle Augen zählen',
};

export const BONUS_AT = 63;
export const BONUS = 35;

export type Sheet = Partial<Record<KCat, number>>;

export interface WuerfelState {
  n: number;
  cats: KCat[];
  dice: number[];
  rolls: number;
  held: boolean[];
  sheets: Sheet[];
  turn: number;
  last: { by: number; cat: KCat; pts: number } | null;
}

export type WuerfelAction = { t: 'roll'; hold: boolean[] } | { t: 'score'; cat: KCat };

const sum = (d: number[]) => d.reduce((a, b) => a + b, 0);
const counts = (d: number[]) => [1, 2, 3, 4, 5, 6].map((f) => d.filter((x) => x === f).length);
const hasRun = (d: number[], n: number) => {
  const set = new Set(d);
  for (let start = 1; start + n - 1 <= 6; start++) if (Array.from({ length: n }, (_, k) => start + k).every((x) => set.has(x))) return true;
  return false;
};

export function catScore(cat: KCat, d: number[]): number {
  const c = counts(d);
  const max = Math.max(...c);
  const up = UPPER.indexOf(cat);
  if (up >= 0) return c[up] * (up + 1);
  switch (cat) {
    case 'three':
      return max >= 3 ? sum(d) : 0;
    case 'four':
      return max >= 4 ? sum(d) : 0;
    case 'full':
      return (c.includes(3) && c.includes(2)) || max === 5 ? 25 : 0;
    case 'small':
      return hasRun(d, 4) ? 30 : 0;
    case 'large':
      return hasRun(d, 5) ? 40 : 0;
    case 'lucky':
      return max === 5 ? 50 : 0;
    default:
      return sum(d);
  }
}

export const upperSum = (s: Sheet) => UPPER.reduce((a, k) => a + (s[k] ?? 0), 0);
export const bonusOf = (s: Sheet) => (upperSum(s) >= BONUS_AT ? BONUS : 0);
export const total = (s: Sheet, cats: KCat[]) => cats.reduce((a, k) => a + (s[k] ?? 0), 0) + bonusOf(s);
export const sheetFull = (s: Sheet, cats: KCat[]) => cats.every((k) => s[k] !== undefined);

const roll = (dice: number[], hold: boolean[], rnd: Rnd) => dice.map((d, i) => (hold[i] ? d : 1 + Math.floor(rnd() * 6)));

// ───── Robo ─────

const PAR: Record<KCat, number> = { ones: 2, twos: 5, threes: 8, fours: 11, fives: 14, sixes: 17, three: 17, four: 10, full: 12, small: 18, large: 14, lucky: 10, chance: 21 };

function bestValue(d: number[], sheet: Sheet, cats: KCat[]): { cat: KCat; v: number } {
  let best: { cat: KCat; v: number } = { cat: cats.find((c) => sheet[c] === undefined) ?? 'chance', v: -Infinity };
  for (const cat of cats) {
    if (sheet[cat] !== undefined) continue;
    let v = catScore(cat, d) - PAR[cat];
    const up = UPPER.indexOf(cat);
    if (up >= 0) v += (counts(d)[up] - 3) * (up + 1) * 0.6;
    if (v > best.v) best = { cat, v };
  }
  return best;
}

function holdValue(d: number[], hold: boolean[], sheet: Sheet, cats: KCat[], rnd: Rnd): number {
  const free = hold.filter((h) => !h).length;
  if (!free) return bestValue(d, sheet, cats).v;
  const samples = free <= 2 ? 30 : 48;
  let acc = 0;
  for (let k = 0; k < samples; k++) acc += bestValue(roll(d, hold, rnd), sheet, cats).v;
  return acc / samples;
}

export function wuerfelRobo(s: WuerfelState, seat: number, level: Level, rnd: Rnd): WuerfelAction {
  const sheet = s.sheets[seat];
  if (s.rolls === 0) return { t: 'roll', hold: [false, false, false, false, false] };
  const stay = bestValue(s.dice, sheet, s.cats);
  // Auf „Leicht“ überlegt Robo nicht so genau.
  if (s.rolls < 3 && rnd() < [0.6, 0.85, 1][level]) {
    let bestHold: boolean[] | null = null;
    let bestV = stay.v;
    for (let mask = 0; mask < 31; mask++) {
      const hold = [0, 1, 2, 3, 4].map((i) => !!(mask & (1 << i)));
      const v = holdValue(s.dice, hold, sheet, s.cats, rnd);
      if (v > bestV + 0.5) {
        bestV = v;
        bestHold = hold;
      }
    }
    if (bestHold) return { t: 'roll', hold: bestHold };
  }
  return { t: 'score', cat: stay.cat };
}

const allFull = (s: WuerfelState) => s.sheets.every((sh) => sheetFull(sh, s.cats));

export const wuerfelDef: GameDef<WuerfelState, WuerfelAction> = {
  init: ({ n, starter, level }) => ({
    n,
    cats: catsFor(level),
    dice: [1, 2, 3, 4, 5],
    rolls: 0,
    held: [false, false, false, false, false],
    sheets: Array.from({ length: n }, () => ({})),
    turn: starter % n,
    last: null,
  }),
  turn: (s) => (allFull(s) ? null : s.turn),
  apply(s, a, by, rnd) {
    if (by !== s.turn || sheetFull(s.sheets[by], s.cats)) return null;
    if (a.t === 'roll') {
      if (s.rolls >= 3 || !Array.isArray(a.hold) || a.hold.length !== 5) return null;
      const hold = s.rolls === 0 ? [false, false, false, false, false] : a.hold.map(Boolean);
      return { ...s, dice: roll(s.dice, hold, rnd), rolls: s.rolls + 1, held: hold };
    }
    if (s.rolls === 0 || !s.cats.includes(a.cat) || s.sheets[by][a.cat] !== undefined) return null;
    const pts = catScore(a.cat, s.dice);
    const sheets = s.sheets.map((sh, i) => (i === by ? { ...sh, [a.cat]: pts } : sh));
    return { ...s, sheets, rolls: 0, held: [false, false, false, false, false], turn: (by + 1) % s.n, last: { by, cat: a.cat, pts } };
  },
  outcome(s) {
    if (!allFull(s)) return null;
    const scores = s.sheets.map((sh) => total(sh, s.cats));
    return { places: placesFromScores(scores), scores, solo: s.n === 1 ? { score: scores[0] } : undefined };
  },
  robo: (s, seat, level, rnd) => (s.turn === seat ? wuerfelRobo(s, seat, level, rnd) : null),
  roboDelay: (s) => (s.rolls === 0 ? 800 : 1200),
  endDelay: 2000,
};
