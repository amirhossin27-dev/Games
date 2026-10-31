import type { GameDef } from '../../engine/game';
import type { Level } from '../../lib/store';
import type { Rnd } from '../../lib/util';

/**
 * Ludo für 2–4 Kinder (nach Arta, erweitert): Brett 11×11, 40 Felder im Kreis.
 * Position einer Figur: -1 = im Haus, 0–39 = Schritte ab dem eigenen Startfeld, 40–43 = Ziel.
 * Jedes Kind sitzt an einer Ecke des Bretts (`corner`); zu zweit sitzt man sich gegenüber.
 */

type XY = [number, number];

/** Laufweg im Uhrzeigersinn, beginnend beim Startfeld unten. */
export const LUDO_TRACK: XY[] = [
  [4, 10], [4, 9], [4, 8], [4, 7], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 5],
  [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [4, 3], [4, 2], [4, 1], [4, 0], [5, 0],
  [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [10, 5],
  [10, 6], [9, 6], [8, 6], [7, 6], [6, 6], [6, 7], [6, 8], [6, 9], [6, 10], [5, 10],
];

/** Je Ecke: Zielfelder (von außen nach innen) und Haus. Ecke 0 unten, 1 links, 2 oben, 3 rechts. */
export const LUDO_GOAL: XY[][] = [
  [[5, 9], [5, 8], [5, 7], [5, 6]],
  [[1, 5], [2, 5], [3, 5], [4, 5]],
  [[5, 1], [5, 2], [5, 3], [5, 4]],
  [[9, 5], [8, 5], [7, 5], [6, 5]],
];

export const LUDO_HOME: XY[][] = [
  [[0, 9], [1, 9], [0, 10], [1, 10]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[9, 0], [10, 0], [9, 1], [10, 1]],
  [[9, 9], [10, 9], [9, 10], [10, 10]],
];

/** Startfeld jeder Ecke auf dem Rundweg */
export const LUDO_START = [0, 10, 20, 30];

const GOAL_START = 40;
const LAST = 43;

export interface LudoState {
  n: number;
  /** Ecke je Platz */
  corner: number[];
  pos: number[][];
  turn: number;
  phase: 'roll' | 'move';
  roll: number | null;
  /** Würfelversuche, wenn keine Figur ziehen kann (dann drei). */
  tries: number;
  rolls: number;
  last?: { by: number; roll: number; note?: string };
  /** Reihenfolge, in der Kinder fertig wurden */
  finished: number[];
}

export type LudoAction = { t: 'roll' } | { t: 'move'; i: number };

export const ludoCorners = (n: number) => (n === 2 ? [0, 2] : n === 3 ? [0, 1, 2] : [0, 1, 2, 3]);

/** Feld auf dem Rundweg (0–39) oder `null` (Haus/Ziel). */
export function ludoAbs(s: Pick<LudoState, 'corner'>, seat: number, rel: number): number | null {
  return rel >= 0 && rel < GOAL_START ? (rel + LUDO_START[s.corner[seat]]) % 40 : null;
}

export function ludoCell(s: Pick<LudoState, 'corner'>, seat: number, rel: number, i: number): XY {
  const c = s.corner[seat];
  if (rel < 0) return LUDO_HOME[c][i];
  if (rel >= GOAL_START) return LUDO_GOAL[c][rel - GOAL_START];
  return LUDO_TRACK[ludoAbs(s, seat, rel)!];
}

function target(s: LudoState, seat: number, i: number, n: number): number | null {
  const own = s.pos[seat];
  const rel = own[i];
  if (rel < 0) return n === 6 && !own.includes(0) ? 0 : null;
  if (rel >= GOAL_START && rel + n > LAST) return null;
  const t = rel + n;
  if (t > LAST) return null;
  if (t >= GOAL_START) {
    for (let k = Math.max(rel + 1, GOAL_START); k <= t; k++) if (own.includes(k)) return null;
    return t;
  }
  return own.includes(t) ? null : t;
}

/** Erlaubte Züge – mit „Bei 6 raus“ und „Startfeld räumen“. */
export function ludoMoves(s: LudoState, seat: number, n: number): number[] {
  const own = s.pos[seat];
  const all = own.map((_, i) => i).filter((i) => target(s, seat, i, n) !== null);
  const inHouse = own.some((p) => p < 0);
  if (n === 6 && inHouse) {
    const enter = all.filter((i) => own[i] < 0);
    if (enter.length) return enter.slice(0, 1);
  }
  const onStart = own.indexOf(0);
  if (inHouse && onStart >= 0 && all.includes(onStart)) return [onStart];
  return all;
}

function triesFor(pos: number[]): number {
  if (pos.some((p) => p >= 0 && p < GOAL_START)) return 1;
  const stuck = pos.every((p) => p < 0 || pos.filter((q) => q > p).length === LAST - p);
  return stuck ? 3 : 1;
}

const done = (pos: number[]) => pos.every((p) => p >= GOAL_START);

/** Nächster Platz, der noch spielt */
function nextPlayer(s: LudoState, seat: number): number {
  for (let k = 1; k <= s.n; k++) {
    const p = (seat + k) % s.n;
    if (!s.finished.includes(p)) return p;
  }
  return seat;
}

function nextTurn(s: LudoState, seat: number): LudoState {
  return { ...s, turn: seat, phase: 'roll', roll: null, tries: triesFor(s.pos[seat]) };
}

/** Spielende: Nur noch ein Kind ist nicht fertig (bzw. allein: alle im Ziel). */
const gameOver = (s: LudoState) => s.finished.length >= Math.max(1, s.n - 1);

export const ludoDef: GameDef<LudoState, LudoAction> = {
  init: ({ n, starter }) => ({
    n,
    corner: ludoCorners(n),
    // Schneller für Kinder: Eine Figur steht schon auf dem Startfeld.
    pos: Array.from({ length: n }, () => [0, -1, -1, -1]),
    turn: starter % n,
    phase: 'roll',
    roll: null,
    tries: 1,
    rolls: 0,
    finished: [],
  }),
  turn: (s) => (gameOver(s) ? null : s.turn),
  apply(s, a, by, rnd) {
    if (gameOver(s) || by !== s.turn) return null;
    if (a.t === 'roll') {
      if (s.phase !== 'roll') return null;
      const n = 1 + Math.floor(rnd() * 6);
      const base = { ...s, rolls: s.rolls + 1 };
      const moves = ludoMoves(s, by, n);
      if (moves.length) return { ...base, phase: 'move', roll: n, last: { by, roll: n } };
      if (n === 6) return { ...base, tries: 1, last: { by, roll: n, note: 'Kein Zug möglich – nochmal würfeln' } };
      if (s.tries > 1) return { ...base, tries: s.tries - 1, last: { by, roll: n, note: `Noch ${s.tries - 1}× versuchen` } };
      return { ...nextTurn(base, nextPlayer(base, by)), last: { by, roll: n, note: 'Kein Zug möglich' } };
    }
    if (s.phase !== 'move' || s.roll === null || !ludoMoves(s, by, s.roll).includes(a.i)) return null;
    const t = target(s, by, a.i, s.roll)!;
    const pos = s.pos.map((p, k) => (k === by ? p.map((x, j) => (j === a.i ? t : x)) : p));
    const abs = ludoAbs(s, by, t);
    let note: string | undefined;
    if (abs !== null) {
      for (let o = 0; o < s.n; o++) {
        if (o === by) continue;
        const hit = pos[o].findIndex((p) => ludoAbs(s, o, p) === abs);
        if (hit >= 0) {
          pos[o] = pos[o].map((p, k) => (k === hit ? -1 : p));
          note = 'Rausgeworfen!';
        }
      }
    }
    if (!note && s.pos[by][a.i] < 0) note = 'Neue Figur im Spiel';
    if (!note && t >= GOAL_START && s.pos[by][a.i] < GOAL_START) note = 'Im Ziel!';
    let moved: LudoState = { ...s, pos, last: { by, roll: s.roll, note } };
    if (done(pos[by]) && !s.finished.includes(by)) {
      moved = { ...moved, finished: [...s.finished, by] };
      if (gameOver(moved)) return { ...moved, phase: 'roll', roll: null };
      return nextTurn(moved, nextPlayer(moved, by));
    }
    if (s.roll === 6) return { ...moved, phase: 'roll', roll: null, tries: 1 };
    return nextTurn(moved, nextPlayer(moved, by));
  },
  outcome(s) {
    if (!gameOver(s)) return null;
    const rest = Array.from({ length: s.n }, (_, i) => i).filter((i) => !s.finished.includes(i));
    const order = [...s.finished, ...rest];
    return { places: Array.from({ length: s.n }, (_, i) => order.indexOf(i) + 1) };
  },
  auto(s) {
    if (gameOver(s) || s.phase !== 'move' || s.roll === null) return null;
    const moves = ludoMoves(s, s.turn, s.roll);
    return moves.length === 1 ? { action: { t: 'move', i: moves[0] }, by: s.turn, delay: 750 } : null;
  },
  robo(s, seat, level, rnd) {
    if (s.turn !== seat || gameOver(s)) return null;
    if (s.phase === 'roll') return { t: 'roll' };
    const moves = ludoMoves(s, seat, s.roll!);
    if (moves.length <= 1) return moves.length ? { t: 'move', i: moves[0] } : null;
    return { t: 'move', i: ludoBest(s, seat, moves, level, rnd) };
  },
  roboDelay: (s) => (s.phase === 'roll' ? 800 : 700),
  endDelay: 1600,
};

function ludoBest(s: LudoState, seat: number, moves: number[], level: Level, rnd: Rnd): number {
  const noise = [18, 8, 0][level];
  let best = moves[0];
  let bestScore = -Infinity;
  for (const i of moves) {
    const score = ludoMoveScore(s, seat, i, s.roll!) + rnd() * noise;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

function threatened(s: LudoState, seat: number, abs: number): boolean {
  for (let o = 0; o < s.n; o++) {
    if (o === seat) continue;
    const hit = s.pos[o].some((p) => {
      if (p < 0) return abs === LUDO_START[s.corner[o]];
      const a = ludoAbs(s, o, p);
      if (a === null) return false;
      const d = (abs - a + 40) % 40;
      return d >= 1 && d <= 6 && p + d < GOAL_START;
    });
    if (hit) return true;
  }
  return false;
}

/** Wie gut ist ein Zug? (Für Robo – schlagen, ins Ziel, Gefahr meiden.) */
export function ludoMoveScore(s: LudoState, seat: number, i: number, n: number): number {
  const from = s.pos[seat][i];
  const t = target(s, seat, i, n);
  if (t === null) return -Infinity;
  const abs = ludoAbs(s, seat, t);
  let score = t / 4;
  if (abs !== null) {
    for (let o = 0; o < s.n; o++) {
      if (o === seat) continue;
      const victim = s.pos[o].find((p) => ludoAbs(s, o, p) === abs);
      if (victim !== undefined) score += 50 + victim / 2;
    }
    if (threatened(s, seat, abs)) score -= 18;
  }
  if (t >= GOAL_START && from < GOAL_START) score += 40;
  if (from < 0) score += 30;
  const fromAbs = ludoAbs(s, seat, from);
  if (fromAbs !== null && threatened(s, seat, fromAbs)) score += 15;
  return score;
}

/** Für Tests: Würfel mit fester Zahlenfolge. */
export function dice(...rolls: number[]): Rnd {
  let k = 0;
  return () => (rolls[k++ % rolls.length] - 1) / 6 + 0.01;
}
