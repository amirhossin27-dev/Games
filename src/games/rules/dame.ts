import type { GameDef } from '../../engine/game';
import type { Level } from '../../lib/store';
import { pick, type Rnd } from '../../lib/util';

/**
 * Dame: Gespielt wird auf den dunklen Feldern. Steine ziehen schräg ein Feld nach vorn. Geschlagen
 * wird durch Überspringen eines fremden Steins (schräg, auch rückwärts) – Schlagen ist Pflicht, und
 * nach einem Sprung springt man weiter, solange es geht. Wer die andere Seite erreicht, bekommt eine
 * Dame: Sie zieht und schlägt schräg beliebig weit, auch rückwärts. Eine neue Dame beendet den Zug.
 * Verloren hat, wer keinen Stein mehr hat oder nicht mehr ziehen kann.
 *
 * Platz 0 sitzt unten und zieht nach oben, Platz 1 oben und zieht nach unten.
 * Leicht: 6 × 6 mit je 6 Steinen, sonst 8 × 8 mit je 12 Steinen.
 */

/** Feld: leer oder Stein (Platz + 2, wenn es eine Dame ist) */
export type DamePiece = number | null;

export const dameSeat = (p: number) => p % 2;
export const isKing = (p: number) => p >= 2;

export const DAME_SIZE: Record<Level, number> = { 0: 6, 1: 8, 2: 8 };

/** Nach so vielen Zügen ohne Schlagen und ohne Zug mit einem einfachen Stein ist es unentschieden */
export const DAME_QUIET_LIMIT = 40;

export interface DameStep {
  from: number;
  to: number;
  /** Geschlagener Stein */
  cap: number | null;
}

export interface DameState {
  size: number;
  board: DamePiece[];
  turn: number;
  /** Dieser Stein hat gerade geschlagen und muss weiterspringen */
  chain: number | null;
  quiet: number;
  last: DameStep[];
}

export type DameAction = { from: number; to: number };

const DIRS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

export const isDark = (size: number, i: number) => (Math.floor(i / size) + (i % size)) % 2 === 1;

export function dameStart(size: number): DamePiece[] {
  const rows = size === 6 ? 2 : 3;
  return Array.from({ length: size * size }, (_, i) => {
    const r = Math.floor(i / size);
    if (!isDark(size, i)) return null;
    if (r < rows) return 1;
    if (r >= size - rows) return 0;
    return null;
  });
}

/** Züge und Sprünge eines Steins */
function pieceSteps(size: number, b: DamePiece[], from: number): { moves: DameStep[]; jumps: DameStep[] } {
  const p = b[from]!;
  const seat = dameSeat(p);
  const r0 = Math.floor(from / size);
  const c0 = from % size;
  const fwd = seat === 0 ? -1 : 1;
  const on = (r: number, c: number) => r >= 0 && r < size && c >= 0 && c < size;
  const moves: DameStep[] = [];
  const jumps: DameStep[] = [];
  for (const [dr, dc] of DIRS) {
    if (!isKing(p)) {
      const r = r0 + dr;
      const c = c0 + dc;
      if (!on(r, c)) continue;
      const i = r * size + c;
      if (b[i] === null) {
        if (dr === fwd) moves.push({ from, to: i, cap: null });
      } else if (dameSeat(b[i]!) !== seat && on(r + dr, c + dc) && b[(r + dr) * size + c + dc] === null) {
        jumps.push({ from, to: (r + dr) * size + c + dc, cap: i });
      }
      continue;
    }
    // Dame: beliebig weit
    let r = r0 + dr;
    let c = c0 + dc;
    while (on(r, c) && b[r * size + c] === null) {
      moves.push({ from, to: r * size + c, cap: null });
      r += dr;
      c += dc;
    }
    if (!on(r, c) || dameSeat(b[r * size + c]!) === seat) continue;
    const cap = r * size + c;
    r += dr;
    c += dc;
    while (on(r, c) && b[r * size + c] === null) {
      jumps.push({ from, to: r * size + c, cap });
      r += dr;
      c += dc;
    }
  }
  return { moves, jumps };
}

/** Alle erlaubten Schritte für den, der dran ist (mit Schlagpflicht) */
export function dameSteps(s: DameState): DameStep[] {
  if (s.chain !== null) return pieceSteps(s.size, s.board, s.chain).jumps;
  const moves: DameStep[] = [];
  const jumps: DameStep[] = [];
  s.board.forEach((p, i) => {
    if (p === null || dameSeat(p) !== s.turn) return;
    const st = pieceSteps(s.size, s.board, i);
    moves.push(...st.moves);
    jumps.push(...st.jumps);
  });
  return jumps.length ? jumps : moves;
}

/** Muss gerade geschlagen werden? */
export const dameMustJump = (s: DameState) => dameSteps(s).some((x) => x.cap !== null);

export function dameResult(s: DameState): { winner: number | 'draw' } | null {
  if (dameSteps(s).length === 0) return { winner: 1 - s.turn };
  if (s.quiet >= DAME_QUIET_LIMIT) return { winner: 'draw' };
  return null;
}

export function dameApply(s: DameState, a: DameAction, by: number): DameState | null {
  if (by !== s.turn) return null;
  const step = dameSteps(s).find((x) => x.from === a.from && x.to === a.to);
  if (!step) return null;
  const board = s.board.slice();
  let p = board[step.from]!;
  board[step.from] = null;
  if (step.cap !== null) board[step.cap] = null;
  const row = Math.floor(step.to / s.size);
  const crowned = !isKing(p) && row === (by === 0 ? 0 : s.size - 1);
  if (crowned) p += 2;
  board[step.to] = p;
  const quiet = step.cap !== null || !isKing(s.board[step.from]!) ? 0 : s.quiet + 1;
  const last = s.chain !== null ? [...s.last, step] : [step];
  const more = step.cap !== null && !crowned && pieceSteps(s.size, board, step.to).jumps.length > 0;
  return { ...s, board, quiet, last, chain: more ? step.to : null, turn: more ? by : 1 - by };
}

export const dameCount = (b: DamePiece[], seat: number) => b.filter((p) => p !== null && dameSeat(p) === seat).length;

// ───── Robo ─────

/** Alle ganzen Züge (mit allen Sprungfolgen) – jeweils mit dem ersten Schritt */
function fullTurns(s: DameState): { first: DameAction; next: DameState }[] {
  const out: { first: DameAction; next: DameState }[] = [];
  const walk = (st: DameState, first: DameAction | null) => {
    for (const step of dameSteps(st)) {
      const a = { from: step.from, to: step.to };
      const next = dameApply(st, a, st.turn)!;
      if (next.turn === st.turn && next.chain !== null) walk(next, first ?? a);
      else out.push({ first: first ?? a, next });
    }
  };
  walk(s, null);
  return out;
}

function dameEvaluate(s: DameState, me: number): number {
  let score = 0;
  s.board.forEach((p, i) => {
    if (p === null) return;
    const seat = dameSeat(p);
    const row = Math.floor(i / s.size);
    const col = i % s.size;
    let v = isKing(p) ? 30 : 10;
    // Vorrücken und die Mitte lohnen sich ein bisschen
    if (!isKing(p)) v += (seat === 0 ? s.size - 1 - row : row) * 0.6;
    if (col > 0 && col < s.size - 1) v += 0.4;
    score += seat === me ? v : -v;
  });
  return score;
}

function dameSearch(s: DameState, me: number, depth: number, alpha: number, beta: number): number {
  const r = dameResult(s);
  if (r) return r.winner === 'draw' ? 0 : r.winner === me ? 10_000 + depth : -10_000 - depth;
  if (depth === 0) return dameEvaluate(s, me);
  const maxing = s.turn === me;
  let best = maxing ? -Infinity : Infinity;
  for (const { next } of fullTurns(s)) {
    const v = dameSearch(next, me, depth - 1, alpha, beta);
    if (maxing) {
      best = Math.max(best, v);
      alpha = Math.max(alpha, v);
    } else {
      best = Math.min(best, v);
      beta = Math.min(beta, v);
    }
    if (alpha >= beta) break;
  }
  return best;
}

/** Robo denkt je nach Stufe 1, 3 oder 5 Züge voraus; auf Leicht zieht er öfter einfach irgendwohin. */
export function dameRoboMove(s: DameState, me: number, level: Level, rnd: Rnd = Math.random): DameAction {
  const turns = fullTurns(s);
  if (level === 0 && rnd() < 0.35) return pick(turns, rnd).first;
  const depth = [1, 3, 5][level];
  let best = -Infinity;
  let moves: DameAction[] = [];
  for (const { first, next } of turns) {
    const v = dameSearch(next, me, depth - 1, -Infinity, Infinity) + (level === 0 ? rnd() * 8 : rnd() * 0.5);
    if (v > best) {
      best = v;
      moves = [first];
    } else if (v === best) moves.push(first);
  }
  return pick(moves, rnd);
}

export const dameDef: GameDef<DameState, DameAction> = {
  init: ({ starter, level }) => {
    const size = DAME_SIZE[level];
    return { size, board: dameStart(size), turn: starter % 2, chain: null, quiet: 0, last: [] };
  },
  turn: (s) => (dameResult(s) ? null : s.turn),
  apply: (s, a, by) => dameApply(s, a, by),
  outcome(s) {
    const r = dameResult(s);
    if (!r) return null;
    return { places: r.winner === 'draw' ? [1, 1] : r.winner === 0 ? [1, 2] : [2, 1] };
  },
  robo: (s, seat, level, rnd) => (s.turn === seat ? dameRoboMove(s, seat, level, rnd) : null),
  roboDelay: (s) => (s.chain !== null ? 650 : 750 + Math.random() * 450),
  endDelay: 1600,
};
