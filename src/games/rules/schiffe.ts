import type { GameDef } from '../../engine/game';
import type { Level } from '../../lib/store';
import type { Rnd } from '../../lib/util';

/**
 * Schiffe versenken (nach Arta) für zwei. Auf „Leicht“ 8 × 8 Felder mit vier Schiffen, sonst
 * 10 × 10 mit fünf. Schiffe berühren sich nicht. Wer trifft, darf nochmal. Nebenbei lernt man
 * Koordinaten wie „C5“.
 */

export interface SeaSetup {
  size: number;
  fleet: number[];
}

export const SEA_FOR: Record<Level, SeaSetup> = {
  0: { size: 8, fleet: [4, 3, 2, 2] },
  1: { size: 10, fleet: [5, 4, 3, 3, 2] },
  2: { size: 10, fleet: [5, 4, 3, 3, 2] },
};

export const SHIP_NAME: Record<number, string> = { 5: 'Großes Schiff', 4: 'Segelschiff', 3: 'Fischerboot', 2: 'Ruderboot' };

export type Fleet = number[][];

export interface BattleState {
  size: number;
  fleetLens: number[];
  phase: 'setup' | 'battle';
  fleets: (Fleet | null)[];
  shots: number[][];
  turn: number;
  last: { by: number; at: number; hit: boolean; sunk?: number } | null;
  winner?: number;
}

export type BattleAction = { t: 'ready'; fleet: Fleet } | { t: 'shoot'; at: number };

export const coordName = (i: number, size: number) => `${'ABCDEFGHIJ'[i % size]}${Math.floor(i / size) + 1}`;

export function around(i: number, size: number): number[] {
  const out: number[] = [];
  const row = Math.floor(i / size);
  const col = i % size;
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      const r = row + dr;
      const c = col + dc;
      if ((dr || dc) && r >= 0 && r < size && c >= 0 && c < size) out.push(r * size + c);
    }
  return out;
}

export function randomFleet(size: number, lens: number[], rnd: Rnd): Fleet {
  for (;;) {
    const blocked = new Set<number>();
    const fleet: Fleet = [];
    let ok = true;
    for (const len of lens) {
      let placed = false;
      for (let tries = 0; tries < 200 && !placed; tries++) {
        const horiz = rnd() < 0.5;
        const r = Math.floor(rnd() * (horiz ? size : size - len + 1));
        const c = Math.floor(rnd() * (horiz ? size - len + 1 : size));
        const cells = Array.from({ length: len }, (_, k) => (horiz ? r * size + c + k : (r + k) * size + c));
        if (cells.some((x) => blocked.has(x))) continue;
        for (const x of cells) {
          blocked.add(x);
          around(x, size).forEach((y) => blocked.add(y));
        }
        fleet.push(cells);
        placed = true;
      }
      if (!placed) {
        ok = false;
        break;
      }
    }
    if (ok) return fleet;
  }
}

export function validFleet(f: unknown, size: number, lens: number[]): f is Fleet {
  if (!Array.isArray(f) || f.length !== lens.length) return false;
  const got = f.map((s) => (Array.isArray(s) ? s.length : 0)).sort((a, b) => b - a);
  if (got.join() !== [...lens].sort((a, b) => b - a).join()) return false;
  const all = new Set<number>();
  for (const ship of f as number[][]) {
    if (!ship.every((x) => Number.isInteger(x) && x >= 0 && x < size * size)) return false;
    const s = ship.slice().sort((a, b) => a - b);
    const row = (x: number) => Math.floor(x / size);
    const horiz = s.every((x) => row(x) === row(s[0])) && s.every((x, k) => x === s[0] + k);
    const vert = s.every((x, k) => x === s[0] + k * size);
    if (!horiz && !vert) return false;
    for (const x of s) all.add(x);
  }
  if (all.size !== lens.reduce((a, b) => a + b, 0)) return false;
  return (f as number[][]).every((ship, k) => ship.every((x) => around(x, size).every((y) => ship.includes(y) || !(f as number[][]).some((o, j) => j !== k && o.includes(y)))));
}

export const isSunk = (ship: number[], shots: number[]) => ship.every((x) => shots.includes(x));
export const allSunk = (fleet: Fleet, shots: number[]) => fleet.every((s) => isSunk(s, shots));

/** Felder, die nach einem versenkten Schiff sicher Wasser sind */
export function knownWater(fleet: Fleet, shots: number[], size: number): Set<number> {
  const out = new Set<number>();
  for (const ship of fleet) if (isSunk(ship, shots)) ship.forEach((x) => around(x, size).forEach((y) => !ship.includes(y) && out.add(y)));
  return out;
}

export function roboShot(fleet: Fleet, shots: number[], size: number, level: Level, rnd: Rnd): number {
  const shot = new Set(shots);
  const water = knownWater(fleet, shots, size);
  const open = (i: number) => !shot.has(i) && !water.has(i);
  const row = (x: number) => Math.floor(x / size);
  const col = (x: number) => x % size;
  const all = Array.from({ length: size * size }, (_, i) => i).filter(open);
  // Auf „Leicht“ schießt Robo öfter einfach drauflos.
  if (rnd() < [0.45, 0.15, 0][level]) return all[Math.floor(rnd() * all.length)];
  const hits = shots.filter((x) => fleet.some((s) => s.includes(x) && !isSunk(s, shots)));
  if (hits.length) {
    const sorted = hits.slice().sort((a, b) => a - b);
    const sameRow = sorted.length > 1 && sorted.every((x) => row(x) === row(sorted[0]));
    const sameCol = sorted.length > 1 && sorted.every((x) => col(x) === col(sorted[0]));
    let cand: number[] = [];
    if (sameRow) cand = [sorted[0] - 1, sorted[sorted.length - 1] + 1].filter((x) => x >= 0 && row(x) === row(sorted[0]));
    else if (sameCol) cand = [sorted[0] - size, sorted[sorted.length - 1] + size];
    cand = cand.filter((x) => x >= 0 && x < size * size && open(x));
    if (!cand.length) {
      for (const h of hits)
        for (const [dr, dc] of [
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
        ]) {
          const r = row(h) + dr;
          const c = col(h) + dc;
          if (r >= 0 && r < size && c >= 0 && c < size && open(r * size + c)) cand.push(r * size + c);
        }
    }
    if (cand.length) return cand[Math.floor(rnd() * cand.length)];
  }
  const left = fleet.filter((s) => !isSunk(s, shots)).map((s) => s.length);
  const heat = Array(size * size).fill(0);
  for (const len of left)
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++)
        for (const horiz of [true, false]) {
          if ((horiz ? c + len : r + len) > size) continue;
          const cells = Array.from({ length: len }, (_, k) => (horiz ? r * size + c + k : (r + k) * size + c));
          if (cells.every(open)) cells.forEach((x) => heat[x]++);
        }
  const options = heat.map((h, i) => ({ i, h: h * (0.75 + rnd() * 0.5) })).filter((o) => open(o.i) && o.h > 0);
  if (!options.length) return all[Math.floor(rnd() * all.length)];
  return options.reduce((a, b) => (b.h > a.h ? b : a)).i;
}

export const battleDef: GameDef<BattleState, BattleAction> = {
  init: ({ starter, level }) => ({
    size: SEA_FOR[level].size,
    fleetLens: SEA_FOR[level].fleet,
    phase: 'setup',
    fleets: [null, null],
    shots: [[], []],
    turn: starter % 2,
    last: null,
  }),
  turn(s) {
    if (s.winner !== undefined) return null;
    if (s.phase === 'battle') return s.turn;
    return s.fleets[0] ? 1 : 0;
  },
  apply(s, a, by) {
    if (s.winner !== undefined) return null;
    if (a.t === 'ready') {
      if (s.phase !== 'setup' || s.fleets[by] || !validFleet(a.fleet, s.size, s.fleetLens)) return null;
      const fleets = s.fleets.map((f, i) => (i === by ? a.fleet : f));
      return { ...s, fleets, phase: fleets[0] && fleets[1] ? 'battle' : 'setup' };
    }
    if (s.phase !== 'battle' || by !== s.turn) return null;
    if (!Number.isInteger(a.at) || a.at < 0 || a.at >= s.size * s.size || s.shots[by].includes(a.at)) return null;
    const opp = 1 - by;
    const fleet = s.fleets[opp]!;
    const shots = s.shots.map((x, i) => (i === by ? [...x, a.at] : x));
    const ship = fleet.find((x) => x.includes(a.at));
    const sunk = ship && isSunk(ship, shots[by]) ? ship.length : undefined;
    const next: BattleState = { ...s, shots, turn: ship ? by : opp, last: { by, at: a.at, hit: !!ship, sunk } };
    return allSunk(fleet, shots[by]) ? { ...next, winner: by } : next;
  },
  outcome: (s) => (s.winner === undefined ? null : { places: s.winner === 0 ? [1, 2] : [2, 1] }),
  robo(s, seat, level, rnd) {
    if (s.winner !== undefined) return null;
    if (s.phase === 'setup') return s.fleets[seat] ? null : { t: 'ready', fleet: randomFleet(s.size, s.fleetLens, rnd) };
    if (s.turn !== seat) return null;
    return { t: 'shoot', at: roboShot(s.fleets[1 - seat]!, s.shots[seat], s.size, level, rnd) };
  },
  roboDelay: (s) => (s.phase === 'setup' ? 400 : 1000),
  viewer(s) {
    if (s.winner !== undefined) return null;
    if (s.phase === 'battle') return s.turn;
    return s.fleets[0] ? 1 : 0;
  },
  endDelay: 2200,
};
