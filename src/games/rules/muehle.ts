import type { GameDef } from '../../engine/game';
import type { Level } from '../../lib/store';
import { pick, type Rnd } from '../../lib/util';
import type { Cell } from './classic';

/**
 * Mühle (Neunermühle): Erst setzen beide abwechselnd ihre 9 Steine, dann ziehen sie zu einem freien
 * Nachbarpunkt. Drei in einer Linie sind eine Mühle – dann darf man einen fremden Stein wegnehmen
 * (keinen aus einer Mühle, außer es gibt nur noch solche). Mit nur 3 Steinen darf man springen.
 * Verloren hat, wer weniger als 3 Steine hat oder nicht mehr ziehen kann.
 *
 *   0-----------1-----------2
 *   |   3-------4-------5   |
 *   |   |   6---7---8   |   |
 *   9--10--11       12--13--14
 *   |   |  15--16--17   |   |
 *   |  18------19------20   |
 *  21----------22----------23
 */

export const MILL_STONES = 9;

/** Lage der 24 Punkte auf einem 7 × 7-Raster */
export const MILL_XY: [number, number][] = [
  [0, 0], [3, 0], [6, 0], [1, 1], [3, 1], [5, 1], [2, 2], [3, 2], [4, 2],
  [0, 3], [1, 3], [2, 3], [4, 3], [5, 3], [6, 3],
  [2, 4], [3, 4], [4, 4], [1, 5], [3, 5], [5, 5], [0, 6], [3, 6], [6, 6],
];

export const MILLS: number[][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11], [12, 13, 14], [15, 16, 17], [18, 19, 20], [21, 22, 23],
  [0, 9, 21], [3, 10, 18], [6, 11, 15], [1, 4, 7], [16, 19, 22], [8, 12, 17], [5, 13, 20], [2, 14, 23],
];

/** Nachbarn: aufeinanderfolgende Punkte einer Linie */
export const MILL_NEIGHBORS: number[][] = (() => {
  const out: number[][] = Array.from({ length: 24 }, () => []);
  for (const [a, b, c] of MILLS) {
    out[a].push(b);
    out[b].push(a, c);
    out[c].push(b);
  }
  return out;
})();

/** Nach so vielen Zügen ohne weggenommenen Stein ist es unentschieden */
export const MILL_QUIET_LIMIT = 60;

export interface MillState {
  board: Cell[];
  turn: number;
  /** Steine, die jeder noch setzen darf */
  hand: number[];
  /** Wer dran ist, hat eine Mühle und nimmt jetzt einen Stein weg */
  remove: boolean;
  /** Halbzüge seit dem letzten weggenommenen Stein (nur Zieh-Phase) */
  quiet: number;
  last: { from: number | null; to: number } | null;
  /** Zuletzt weggenommener Punkt */
  taken: number | null;
}

export type MillAction = { t: 'place'; to: number } | { t: 'move'; from: number; to: number } | { t: 'remove'; at: number };

export const millStones = (s: MillState, seat: number) => s.board.filter((c) => c === seat).length + s.hand[seat];

export const inMill = (b: Cell[], i: number) => b[i] !== null && MILLS.some((m) => m.includes(i) && m.every((j) => b[j] === b[i]));

/** Welche fremden Steine darf `seat` wegnehmen? */
export function millRemovable(b: Cell[], seat: number): number[] {
  const theirs = b.map((c, i) => (c === 1 - seat ? i : -1)).filter((i) => i >= 0);
  const free = theirs.filter((i) => !inMill(b, i));
  return free.length ? free : theirs;
}

/** Darf `seat` springen (nur noch 3 Steine, alle gesetzt)? */
export const millFlying = (s: MillState, seat: number) => s.hand[seat] === 0 && millStones(s, seat) === 3;

/** Alle erlaubten Setz- oder Zieh-Züge (ohne Wegnehmen) */
export function millMoves(s: MillState, seat: number): MillAction[] {
  const empty = s.board.map((c, i) => (c === null ? i : -1)).filter((i) => i >= 0);
  if (s.hand[seat] > 0) return empty.map((to) => ({ t: 'place', to }));
  const fly = millFlying(s, seat);
  const out: MillAction[] = [];
  s.board.forEach((c, from) => {
    if (c !== seat) return;
    for (const to of fly ? empty : MILL_NEIGHBORS[from]) if (s.board[to] === null) out.push({ t: 'move', from, to });
  });
  return out;
}

export function millResult(s: MillState): { winner: number | 'draw' } | null {
  // Erst wird der Stein weggenommen, dann gewertet
  if (s.remove) return null;
  for (const seat of [0, 1]) if (millStones(s, seat) < 3) return { winner: 1 - seat };
  if (millMoves(s, s.turn).length === 0) return { winner: 1 - s.turn };
  if (s.quiet >= MILL_QUIET_LIMIT) return { winner: 'draw' };
  return null;
}

export function millApply(s: MillState, a: MillAction, by: number): MillState | null {
  if (by !== s.turn || millResult(s)) return null;
  if (a.t === 'remove') {
    if (!s.remove || !millRemovable(s.board, by).includes(a.at)) return null;
    const board = s.board.slice();
    board[a.at] = null;
    return { ...s, board, remove: false, turn: 1 - by, quiet: 0, taken: a.at };
  }
  if (s.remove) return null;
  const legal = millMoves(s, by).some((m) => m.t === a.t && m.to === a.to && (a.t === 'place' || (m.t === 'move' && m.from === a.from)));
  if (!legal) return null;
  const board = s.board.slice();
  const hand = s.hand.slice();
  if (a.t === 'move') board[a.from] = null;
  else hand[by]--;
  board[a.to] = by;
  const mill = MILLS.some((m) => m.includes(a.to) && m.every((j) => board[j] === by)) && millRemovable(board, by).length > 0;
  const placing = s.hand[0] + s.hand[1] > 0;
  return {
    board,
    hand,
    turn: mill ? by : 1 - by,
    remove: mill,
    quiet: placing ? 0 : s.quiet + 1,
    last: { from: a.t === 'move' ? a.from : null, to: a.to },
    taken: null,
  };
}

// ───── Robo ─────

/** Ein ganzer Zug: Setzen/Ziehen und – bei einer Mühle – Wegnehmen */
function fullTurns(s: MillState): { first: MillAction; next: MillState }[] {
  const seat = s.turn;
  if (s.remove) return millRemovable(s.board, seat).map((at) => ({ first: { t: 'remove', at }, next: millApply(s, { t: 'remove', at }, seat)! }));
  const out: { first: MillAction; next: MillState }[] = [];
  for (const m of millMoves(s, seat)) {
    const after = millApply(s, m, seat)!;
    if (!after.remove) out.push({ first: m, next: after });
    else for (const at of millRemovable(after.board, seat)) out.push({ first: m, next: millApply(after, { t: 'remove', at }, seat)! });
  }
  // Mühlen zuerst ansehen – das macht die Suche schneller
  return out.sort((x, y) => Number(y.next.taken !== null) - Number(x.next.taken !== null));
}

function millEvaluate(s: MillState, me: number): number {
  const opp = 1 - me;
  let score = (millStones(s, me) - millStones(s, opp)) * 100;
  for (const m of MILLS) {
    let mine = 0;
    let theirs = 0;
    for (const j of m) {
      if (s.board[j] === me) mine++;
      else if (s.board[j] === opp) theirs++;
    }
    if (mine === 2 && theirs === 0) score += 12;
    if (theirs === 2 && mine === 0) score -= 14;
    if (mine === 3) score += 6;
  }
  if (s.hand[me] === 0 && s.hand[opp] === 0) score += (millMoves({ ...s, turn: me }, me).length - millMoves({ ...s, turn: opp }, opp).length) * 2;
  return score;
}

function millSearch(s: MillState, me: number, depth: number, alpha: number, beta: number): number {
  const r = millResult(s);
  if (r) return r.winner === 'draw' ? 0 : r.winner === me ? 10_000 + depth : -10_000 - depth;
  if (depth === 0) return millEvaluate(s, me);
  const maxing = s.turn === me;
  let best = maxing ? -Infinity : Infinity;
  for (const { next } of fullTurns(s)) {
    const v = millSearch(next, me, depth - 1, alpha, beta);
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

/** Robo denkt je nach Stufe 1, 2 oder 3 ganze Züge voraus; auf Leicht zieht er öfter einfach irgendwohin. */
export function millRoboMove(s: MillState, me: number, level: Level, rnd: Rnd = Math.random): MillAction {
  const turns = fullTurns(s);
  if (level === 0 && rnd() < 0.4) return pick(turns, rnd).first;
  const depth = [1, 2, 3][level];
  let best = -Infinity;
  let moves: MillAction[] = [];
  for (const { first, next } of turns) {
    const v = millSearch(next, me, depth - 1, -Infinity, Infinity) + (level === 0 ? rnd() * 30 : rnd());
    if (v > best) {
      best = v;
      moves = [first];
    } else if (v === best) moves.push(first);
  }
  return pick(moves, rnd);
}

export const millDef: GameDef<MillState, MillAction> = {
  init: ({ starter }) => ({ board: Array(24).fill(null), turn: starter % 2, hand: [MILL_STONES, MILL_STONES], remove: false, quiet: 0, last: null, taken: null }),
  turn: (s) => (millResult(s) ? null : s.turn),
  apply: (s, a, by) => millApply(s, a, by),
  outcome(s) {
    const r = millResult(s);
    if (!r) return null;
    return { places: r.winner === 'draw' ? [1, 1] : r.winner === 0 ? [1, 2] : [2, 1] };
  },
  robo: (s, seat, level, rnd) => (s.turn === seat ? millRoboMove(s, seat, level, rnd) : null),
  roboDelay: (s) => (s.remove ? 700 : 800 + Math.random() * 500),
  endDelay: 1600,
};
