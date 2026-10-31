import { describe, expect, it } from 'vitest';
import type { GameDef, InitCtx } from '../engine/game';
import { defFor, isOnlineGame } from '../games/defs';
import { dameApply, dameDef, dameMustJump, dameRoboMove, dameStart, dameSteps, isKing, type DameState } from '../games/rules/dame';
import { millApply, millDef, millMoves, millRemovable, millResult, MILLS, MILL_NEIGHBORS, millRoboMove, type MillState } from '../games/rules/muehle';
import type { Level } from '../lib/store';

/** Reproduzierbarer Zufall */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ctx = (level: Level, starter = 0): InitCtx => ({ n: 2, starter, level, humans: 1, shared: false, rnd: seeded(1) });

const empty = (): MillState => millDef.init(ctx(1));

describe('Mühle', () => {
  it('das Brett hat 24 Punkte, 16 Linien und jeder Punkt 2 bis 4 Nachbarn', () => {
    expect(MILLS).toHaveLength(16);
    for (const n of MILL_NEIGHBORS) {
      expect(n.length).toBeGreaterThanOrEqual(2);
      expect(n.length).toBeLessThanOrEqual(4);
    }
    // Nachbarschaft ist gegenseitig
    MILL_NEIGHBORS.forEach((ns, i) => ns.forEach((j) => expect(MILL_NEIGHBORS[j]).toContain(i)));
  });

  it('eine Mühle erlaubt Wegnehmen, aber nicht aus einer fremden Mühle', () => {
    let s = empty();
    // Rot: 0, 1 · Blau: 9, 21, 3 (9 und 21 noch ohne Mühle) · Rot schließt mit 2
    for (const [to, by] of [[0, 0], [9, 1], [1, 0], [21, 1]] as const) s = millApply(s, { t: 'place', to }, by)!;
    s = millApply(s, { t: 'place', to: 2 }, 0)!;
    expect(s.remove).toBe(true);
    expect(s.turn).toBe(0);
    expect(millApply(s, { t: 'place', to: 5 }, 0)).toBeNull();
    expect(millRemovable(s.board, 0).sort((a, b) => a - b)).toEqual([9, 21]);
    s = millApply(s, { t: 'remove', at: 9 }, 0)!;
    expect(s.board[9]).toBeNull();
    expect(s.turn).toBe(1);
    expect(s.hand).toEqual([6, 7]);
  });

  it('ziehen nur zu Nachbarn, mit 3 Steinen springen, mit 2 Steinen verloren', () => {
    const board = Array(24).fill(null);
    [0, 4, 8, 13].forEach((i) => (board[i] = 0));
    [21, 22, 23].forEach((i) => (board[i] = 1));
    const s: MillState = { ...empty(), board, hand: [0, 0], turn: 0 };
    const mine = millMoves(s, 0);
    expect(mine.every((m) => m.t === 'move' && MILL_NEIGHBORS[m.from].includes(m.to))).toBe(true);
    const theirs = millMoves({ ...s, turn: 1 }, 1);
    expect(theirs.length).toBe(3 * 17); // Springen: jeder Stein auf jeden freien Punkt
    board[23] = null;
    expect(millResult({ ...s, board })).toEqual({ winner: 0 });
  });

  it('wer nicht ziehen kann, verliert', () => {
    const board = Array(24).fill(null);
    // Blau auf 0, 1, 2 und 9 ist von Rot eingeschlossen (21, 4, 14 besetzt ist nicht nötig – Nachbarn reichen)
    [0, 2, 9, 14].forEach((i) => (board[i] = 1));
    [1, 3, 21, 23, 10, 4].forEach((i) => (board[i] = 0));
    const s: MillState = { ...empty(), board, hand: [0, 0], turn: 1 };
    // 0: Nachbarn 1 (rot), 9 (blau) · 2: 1 (rot), 14 (blau) · 9: 0, 10 (rot), 21 (rot) · 14: 2, 13 (frei!)
    expect(millMoves(s, 1).length).toBeGreaterThan(0);
    board[13] = 0;
    board[23] = 0;
    expect(millMoves({ ...s, board }, 1)).toHaveLength(0);
    expect(millResult({ ...s, board })).toEqual({ winner: 0 });
  });

  it('Robo schließt eine offene Mühle und verhindert eine fremde', () => {
    let s = empty();
    for (const [to, by] of [[0, 0], [5, 1], [1, 0]] as const) s = millApply(s, { t: 'place', to }, by)!;
    // Blau ist dran und muss die Mühle 0-1-2 verhindern
    expect(millRoboMove(s, 1, 2, seeded(3))).toEqual({ t: 'place', to: 2 });
    s = millApply(s, { t: 'place', to: 3 }, 1)!;
    expect(millRoboMove(s, 0, 1, seeded(3))).toEqual({ t: 'place', to: 2 });
  });

  it('Robo gegen Robo endet immer, auch auf Schwer schnell genug', () => {
    for (const level of [0, 1, 2] as Level[]) {
      const rnd = seeded(level + 5);
      let s = millDef.init(ctx(level));
      let steps = 0;
      const t0 = performance.now();
      while (!millDef.outcome(s) && steps < 600) {
        const seat = millDef.turn(s) as number;
        s = millDef.apply(s, millDef.robo!(s, seat, level, rnd)!, seat, rnd)!;
        expect(s).not.toBeNull();
        steps++;
      }
      expect(millDef.outcome(s), `Stufe ${level}`).not.toBeNull();
      expect((performance.now() - t0) / steps, `Stufe ${level}: ms pro Zug`).toBeLessThan(400);
    }
  });
});

describe('Dame', () => {
  it('Aufstellung: 6 × 6 mit je 6, 8 × 8 mit je 12 Steinen auf dunklen Feldern', () => {
    for (const [size, each] of [[6, 6], [8, 12]]) {
      const b = dameStart(size);
      expect(b.filter((p) => p === 0)).toHaveLength(each);
      expect(b.filter((p) => p === 1)).toHaveLength(each);
    }
    const s = dameDef.init(ctx(0));
    expect(s.size).toBe(6);
    expect(dameDef.init(ctx(2)).size).toBe(8);
    // Am Anfang hat Rot nur Vorwärts-Züge
    expect(dameSteps(s).every((x) => x.to < x.from && x.cap === null)).toBe(true);
  });

  const at = (size: number, pieces: Record<number, number>, turn = 0): DameState => {
    const board = Array(size * size).fill(null);
    for (const [i, p] of Object.entries(pieces)) board[Number(i)] = p;
    return { size, board, turn, chain: null, quiet: 0, last: [] };
  };

  it('Schlagen ist Pflicht und geht weiter, solange es geht', () => {
    // 8 × 8: Rot auf 7/0 (Index 56), Blau auf 6/1 (49) und 4/3 (35)
    const s = at(8, { 56: 0, 49: 1, 35: 1, 63: 0 });
    expect(dameMustJump(s)).toBe(true);
    expect(dameSteps(s)).toEqual([{ from: 56, to: 42, cap: 49 }]);
    expect(dameApply(s, { from: 63, to: 54 }, 0)).toBeNull();
    const s2 = dameApply(s, { from: 56, to: 42 }, 0)!;
    expect(s2.turn).toBe(0);
    expect(s2.chain).toBe(42);
    const s3 = dameApply(s2, { from: 42, to: 28 }, 0)!;
    expect(s3.board[35]).toBeNull();
    expect(s3.turn).toBe(1);
  });

  it('am Ende wird ein Stein zur Dame, die beliebig weit zieht', () => {
    const s = at(8, { 9: 0, 62: 1 });
    const s2 = dameApply(s, { from: 9, to: 0 }, 0)!;
    expect(isKing(s2.board[0]!)).toBe(true);
    const k = at(8, { 0: 2, 62: 1 });
    // Dame auf a8 zieht die ganze Diagonale entlang bis vor den fremden Stein, dazu schlagen
    expect(dameSteps(k).some((x) => x.cap === 62)).toBe(false);
    expect(dameSteps(at(8, { 0: 2, 54: 1 })).filter((x) => x.cap === 54).map((x) => x.to)).toEqual([63]);
  });

  it('wer keine Steine oder Züge hat, verliert', () => {
    expect(dameDef.outcome(at(8, { 9: 0 }, 1))?.places).toEqual([1, 2]);
  });

  it('Robo nimmt einen Stein, wenn er kann, und Robo gegen Robo endet', () => {
    const s = at(8, { 56: 0, 49: 1, 63: 0, 20: 1 });
    expect(dameRoboMove(s, 0, 1, seeded(2))).toEqual({ from: 56, to: 42 });
    for (const level of [0, 1, 2] as Level[]) {
      const rnd = seeded(level + 9);
      let st = dameDef.init(ctx(level));
      let steps = 0;
      const t0 = performance.now();
      while (!dameDef.outcome(st) && steps < 800) {
        const seat = dameDef.turn(st) as number;
        st = dameDef.apply(st, dameDef.robo!(st, seat, level, rnd)!, seat, rnd)!;
        expect(st).not.toBeNull();
        steps++;
      }
      expect(dameDef.outcome(st), `Stufe ${level}`).not.toBeNull();
      expect((performance.now() - t0) / steps, `Stufe ${level}: ms pro Zug`).toBeLessThan(400);
    }
  });
});

describe('Mühle und Dame online', () => {
  it('sind im Spielzimmer spielbar und überstehen den Weg über die Datenbank (JSON)', () => {
    for (const id of ['muehle', 'dame'] as const) {
      expect(isOnlineGame(id)).toBe(true);
      const def = defFor(id, [false, false]) as GameDef<unknown, unknown>;
      const rnd = seeded(4);
      let s = def.init(ctx(1));
      for (let k = 0; k < 30 && !def.outcome(s); k++) {
        const seat = def.turn(s) as number;
        s = def.apply(JSON.parse(JSON.stringify(s)), def.robo!(s, seat, 1, rnd), seat, rnd)!;
        expect(s).not.toBeNull();
      }
    }
  });
});
