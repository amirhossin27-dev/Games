import type { GameDef } from '../../engine/game';
import type { Level } from '../../lib/store';
import { pick, placesFromScores, shuffle, type Rnd } from '../../lib/util';

/** Feld eines Bretts: Platz 0/1 oder leer. */
export type Cell = number | null;

const placesForWinner = (winner: number | 'draw') => (winner === 'draw' ? [1, 1] : winner === 0 ? [1, 2] : [2, 1]);

// ───────────────────────── Tic-Tac-Toe ─────────────────────────

const TTT_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function tttResult(b: Cell[]): { winner: number | 'draw'; line?: number[] } | null {
  for (const line of TTT_LINES) {
    const [x, y, z] = line;
    if (b[x] !== null && b[x] === b[y] && b[x] === b[z]) return { winner: b[x]!, line };
  }
  return b.every((c) => c !== null) ? { winner: 'draw' } : null;
}

function tttScore(b: Cell[], me: number, turn: number, depth: number): number {
  const r = tttResult(b);
  if (r) return r.winner === 'draw' ? 0 : r.winner === me ? 10 - depth : depth - 10;
  const scores: number[] = [];
  b.forEach((c, i) => {
    if (c !== null) return;
    b[i] = turn;
    scores.push(tttScore(b, me, 1 - turn, depth + 1));
    b[i] = null;
  });
  return turn === me ? Math.max(...scores) : Math.min(...scores);
}

/** Perfekter Zug per Minimax; bei Gleichstand zufällig unter den besten. */
export function tttBestMove(board: Cell[], me: number, rnd: Rnd = Math.random): number {
  if (board.every((c) => c === null)) return pick([0, 2, 4, 6, 8], rnd);
  const b = board.slice();
  let best = -Infinity;
  let moves: number[] = [];
  b.forEach((c, i) => {
    if (c !== null) return;
    b[i] = me;
    const s = tttScore(b, me, 1 - me, 1);
    b[i] = null;
    if (s > best) {
      best = s;
      moves = [i];
    } else if (s === best) moves.push(i);
  });
  return pick(moves, rnd);
}

/** Robo spielt je nach Stufe mal perfekt, mal zufällig – damit Kinder auch gewinnen können. */
export function tttRoboMove(board: Cell[], me: number, level: Level, rnd: Rnd = Math.random): number {
  const free = board.map((c, i) => (c === null ? i : -1)).filter((i) => i >= 0);
  // Auf „Schwer“ macht Robo kaum noch Fehler – dann ist ein Unentschieden schon richtig gut.
  const smart = [0.3, 0.65, 0.97][level];
  return rnd() < smart ? tttBestMove(board, me, rnd) : pick(free, rnd);
}

export interface TttState {
  board: Cell[];
  turn: number;
}

export const tttDef: GameDef<TttState, number> = {
  init: ({ starter }) => ({ board: Array(9).fill(null), turn: starter % 2 }),
  turn: (s) => (tttResult(s.board) ? null : s.turn),
  apply(s, i, by) {
    if (by !== s.turn || s.board[i] !== null || i < 0 || i > 8 || tttResult(s.board)) return null;
    const board = s.board.slice();
    board[i] = by;
    return { board, turn: 1 - by };
  },
  outcome(s) {
    const r = tttResult(s.board);
    return r ? { places: placesForWinner(r.winner) } : null;
  },
  robo: (s, seat, level, rnd) => (s.turn === seat ? tttRoboMove(s.board, seat, level, rnd) : null),
  roboDelay: () => 600 + Math.random() * 400,
  endDelay: 1300,
};

// ───────────────────────── Vier gewinnt ─────────────────────────

export const C4_COLS = 7;
export const C4_ROWS = 6;

/** Index = Zeile * 7 + Spalte, Zeile 0 ist oben. */
export const c4Empty = (): Cell[] => Array(C4_COLS * C4_ROWS).fill(null);

export function c4LandingRow(b: Cell[], col: number): number {
  for (let row = C4_ROWS - 1; row >= 0; row--) if (b[row * C4_COLS + col] === null) return row;
  return -1;
}

export function c4Drop(b: Cell[], col: number, seat: number): { board: Cell[]; row: number } | null {
  if (col < 0 || col >= C4_COLS) return null;
  const row = c4LandingRow(b, col);
  if (row < 0) return null;
  const board = b.slice();
  board[row * C4_COLS + col] = seat;
  return { board, row };
}

const C4_WINDOWS: number[][] = (() => {
  const out: number[][] = [];
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (let r = 0; r < C4_ROWS; r++)
    for (let c = 0; c < C4_COLS; c++)
      for (const [dr, dc] of dirs) {
        const cells: number[] = [];
        for (let k = 0; k < 4; k++) {
          const rr = r + dr * k;
          const cc = c + dc * k;
          if (rr < 0 || rr >= C4_ROWS || cc < 0 || cc >= C4_COLS) break;
          cells.push(rr * C4_COLS + cc);
        }
        if (cells.length === 4) out.push(cells);
      }
  return out;
})();

export function c4Winner(b: Cell[]): { winner: number; cells: number[] } | null {
  for (const w of C4_WINDOWS) {
    const s = b[w[0]];
    if (s !== null && b[w[1]] === s && b[w[2]] === s && b[w[3]] === s) {
      const cells = new Set(w);
      for (const w2 of C4_WINDOWS) if (w2.every((i) => b[i] === s) && w2.some((i) => cells.has(i))) w2.forEach((i) => cells.add(i));
      return { winner: s, cells: [...cells] };
    }
  }
  return null;
}

export const c4Full = (b: Cell[]) => b.slice(0, C4_COLS).every((c) => c !== null);

function c4Evaluate(b: Cell[], me: number): number {
  const opp = 1 - me;
  let score = 0;
  for (let r = 0; r < C4_ROWS; r++) if (b[r * C4_COLS + 3] === me) score += 3;
  for (const w of C4_WINDOWS) {
    let mine = 0;
    let theirs = 0;
    for (const i of w) {
      if (b[i] === me) mine++;
      else if (b[i] === opp) theirs++;
    }
    if (mine && theirs) continue;
    if (mine === 3) score += 5;
    else if (mine === 2) score += 2;
    if (theirs === 3) score -= 4;
    else if (theirs === 2) score -= 1;
  }
  return score;
}

const C4_ORDER = [3, 2, 4, 1, 5, 0, 6];

function c4Negamax(b: Cell[], seat: number, depth: number, alpha: number, beta: number): number {
  if (c4Full(b)) return 0;
  if (depth === 0) return c4Evaluate(b, seat);
  let best = -Infinity;
  for (const col of C4_ORDER) {
    const d = c4Drop(b, col, seat);
    if (!d) continue;
    const score = c4Winner(d.board) ? 1000 + depth : -c4Negamax(d.board, 1 - seat, depth - 1, -beta, -alpha);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** Robo denkt je nach Stufe 1, 3 oder 6 Züge voraus. */
export function c4RoboMove(b: Cell[], me: number, level: Level, rnd: Rnd = Math.random): number {
  const depth = [1, 3, 6][level];
  let best = -Infinity;
  let moves: number[] = [];
  for (const col of C4_ORDER) {
    const d = c4Drop(b, col, me);
    if (!d) continue;
    const score = c4Winner(d.board) ? 10_000 : -c4Negamax(d.board, 1 - me, depth - 1, -Infinity, Infinity);
    const noisy = level === 0 ? score + rnd() * 6 : score;
    if (noisy > best) {
      best = noisy;
      moves = [col];
    } else if (noisy === best) moves.push(col);
  }
  return pick(moves, rnd);
}

export interface C4State {
  board: Cell[];
  turn: number;
  last: number;
}

export const c4Def: GameDef<C4State, number> = {
  init: ({ starter }) => ({ board: c4Empty(), turn: starter % 2, last: -1 }),
  turn: (s) => (c4Winner(s.board) || c4Full(s.board) ? null : s.turn),
  apply(s, col, by) {
    if (by !== s.turn || c4Winner(s.board)) return null;
    const d = c4Drop(s.board, col, by);
    return d ? { board: d.board, turn: 1 - by, last: d.row * C4_COLS + col } : null;
  },
  outcome(s) {
    const w = c4Winner(s.board);
    if (w) return { places: placesForWinner(w.winner) };
    return c4Full(s.board) ? { places: [1, 1] } : null;
  },
  robo: (s, seat, level, rnd) => (s.turn === seat ? c4RoboMove(s.board, seat, level, rnd) : null),
  roboDelay: () => 700 + Math.random() * 400,
  endDelay: 1500,
};

// ───────────────────────── Paare finden ─────────────────────────

export const MEMORY_PICS = ['🐶', '🐱', '🦊', '🐸', '🐼', '🦁', '🐵', '🐧', '🦋', '🐞', '🍓', '🍉', '🌻', '🚀', '🎈', '⚽', '🍦', '🦄', '🐢', '🐳'];
export const MEMORY_PAIRS: Record<Level, number> = { 0: 6, 1: 8, 2: 12 };

export interface MemoryState {
  deck: string[];
  owner: (number | null)[];
  open: number[];
  turn: number;
  n: number;
  moves: number;
  /** Welche Karten schon einmal offen lagen – das „Gedächtnis“ von Robo. */
  seen: number[];
}

export type MemoryAction = { t: 'flip'; i: number } | { t: 'resolve' };

export function memoryDeck(pairs: number, rnd: Rnd = Math.random): string[] {
  const pics = shuffle(MEMORY_PICS, rnd).slice(0, pairs);
  return shuffle([...pics, ...pics], rnd);
}

const memoryDone = (s: MemoryState) => s.owner.every((o) => o !== null);

export const memoryDef: GameDef<MemoryState, MemoryAction> = {
  init: ({ n, starter, level, rnd }) => ({
    deck: memoryDeck(MEMORY_PAIRS[level], rnd),
    owner: Array(MEMORY_PAIRS[level] * 2).fill(null),
    open: [],
    turn: starter % n,
    n,
    moves: 0,
    seen: [],
  }),
  turn: (s) => (memoryDone(s) ? null : s.turn),
  apply(s, a, by) {
    if (by !== s.turn) return null;
    if (a.t === 'flip') {
      if (s.open.length === 2 || s.open.includes(a.i) || s.owner[a.i] !== null || a.i < 0 || a.i >= s.deck.length) return null;
      const open = [...s.open, a.i];
      return { ...s, open, moves: open.length === 2 ? s.moves + 1 : s.moves, seen: s.seen.includes(a.i) ? s.seen : [...s.seen, a.i] };
    }
    if (s.open.length !== 2) return null;
    const [x, y] = s.open;
    if (s.deck[x] === s.deck[y]) return { ...s, open: [], owner: s.owner.map((o, k) => (k === x || k === y ? s.turn : o)) };
    return { ...s, open: [], turn: (s.turn + 1) % s.n };
  },
  outcome(s) {
    if (!memoryDone(s)) return null;
    const scores = Array.from({ length: s.n }, (_, p) => s.owner.filter((o) => o === p).length / 2);
    return { places: placesFromScores(scores), scores, solo: s.n === 1 ? { score: s.moves } : undefined };
  },
  auto(s) {
    if (s.open.length !== 2) return null;
    const match = s.deck[s.open[0]] === s.deck[s.open[1]];
    return { action: { t: 'resolve' }, by: s.turn, delay: match ? 600 : 1200 };
  },
  robo(s, seat, level, rnd) {
    if (s.turn !== seat || s.open.length === 2) return null;
    const memory = [0.4, 0.65, 0.92][level];
    const remembered = s.seen.filter((i) => s.owner[i] === null && !s.open.includes(i) && rnd() < memory);
    const hidden = s.deck.map((_, i) => i).filter((i) => s.owner[i] === null && !s.open.includes(i));
    const unknown = hidden.filter((i) => !s.seen.includes(i));
    const any = (list: number[]) => list[Math.floor(rnd() * list.length)];
    if (s.open.length === 1) {
      const first = s.open[0];
      const twin = remembered.find((i) => s.deck[i] === s.deck[first]);
      return { t: 'flip', i: twin ?? any(unknown.length ? unknown : hidden) };
    }
    for (const i of remembered) if (remembered.some((j) => j !== i && s.deck[j] === s.deck[i])) return { t: 'flip', i };
    return { t: 'flip', i: any(unknown.length ? unknown : hidden) };
  },
  roboDelay: (s) => (s.open.length ? 700 : 900),
  endDelay: 1000,
};
