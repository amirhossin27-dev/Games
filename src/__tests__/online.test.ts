import { describe, expect, it } from 'vitest';
import { codeAnimals, codeFromIndexes, isCode } from '../net/codes';
import { applyStreamEvent } from '../net/db';
import { absentSeats, buildSeats, guestActs, knocking, members, nextSlot, parseActs, taken, type RoomInfo, type SeatDoc } from '../net/roomLogic';

const seat = (name: string, at = 1000, extra: Partial<SeatDoc> = {}): SeatDoc => ({ name, avatar: 'fuchs', color: '#fff', at, ...extra });

describe('Zimmer-Code', () => {
  it('besteht aus vier Tieren', () => {
    expect(isCode('0a3f')).toBe(true);
    expect(isCode('0A3F')).toBe(false);
    expect(isCode('0a3')).toBe(false);
    expect(codeAnimals('0a3f').map((a) => a.name)).toEqual(['Fuchs', 'Elefant', 'Panda', 'Einhorn']);
    expect(codeFromIndexes([0, 10, 3, 15])).toBe('0a3f');
  });
});

describe('Live-Stream', () => {
  it('setzt put und patch richtig zusammen', () => {
    let tree = applyStreamEvent(null, 'put', '/', { info: { host: 'a', status: 'lobby' }, seats: { a: { name: 'A' } } });
    tree = applyStreamEvent(tree, 'patch', '/seats/b', { name: 'B', at: 5 });
    tree = applyStreamEvent(tree, 'patch', '/info', { 'allowed/b': 1, status: 'playing' });
    expect(tree).toEqual({ info: { host: 'a', status: 'playing', allowed: { b: 1 } }, seats: { a: { name: 'A' }, b: { name: 'B', at: 5 } } });
    tree = applyStreamEvent(tree, 'put', '/seats/a', null);
    expect(Object.keys((tree as { seats: object }).seats)).toEqual(['b']);
    expect(applyStreamEvent(tree, 'put', '/', null)).toBeNull();
  });
});

describe('Spielzimmer', () => {
  const info: RoomInfo = { host: 'h', game: 'ludo', level: 1, status: 'lobby', allowed: { b: 2, a: 1 }, denied: { x: true }, robos: 1, at: 0 };
  const seats = { h: seat('Host'), a: seat('Anna'), b: seat('Ben', 500), k: seat('Klingel'), x: seat('Nein') };

  it('Gastgeber zuerst, dann nach Platznummer', () => {
    expect(members(info, seats).map((m) => m.uid)).toEqual(['h', 'a', 'b']);
    expect(knocking(info, seats).map((k) => k.uid)).toEqual(['k']);
  });

  it('höchstens so viele Plätze wie das Spiel erlaubt', () => {
    expect(taken(info)).toBe(4);
    expect(nextSlot(info)).toBeNull();
    expect(nextSlot({ ...info, robos: 0 })).toBe(3);
    expect(nextSlot({ ...info, game: 'vier', allowed: {}, robos: 0 })).toBe(1);
    expect(nextSlot({ ...info, game: 'vier', allowed: { a: 1 }, robos: 0 })).toBeNull();
  });

  it('baut die Plätze der Runde: Kinder, dann Robo', () => {
    const players = buildSeats(info, seats);
    expect(players.map((p) => p.name)).toEqual(['Host', 'Anna', 'Ben', 'Robo']);
    expect(players.map((p) => !!p.robo)).toEqual([false, false, false, true]);
    expect(players[1].uid).toBe('a');
  });

  it('sammelt die Züge der Gäste der aktuellen Runde', () => {
    const acts = JSON.stringify([
      { n: 1, r: 0, a: 'alt' },
      { n: 1, r: 1, a: 'x' },
      { n: 2, r: 1, a: 'y' },
    ]);
    expect(parseActs(seat('A', 0, { acts }), 1)).toEqual([
      { n: 1, a: 'x' },
      { n: 2, a: 'y' },
    ]);
    const players = buildSeats(info, { ...seats, b: seat('Ben', 500, { acts }) });
    expect(guestActs(players, { ...seats, b: seat('Ben', 500, { acts }) }, 'h', 1)).toEqual([
      { seat: 2, n: 1, a: 'x' },
      { seat: 2, n: 2, a: 'y' },
    ]);
  });

  it('erkennt Kinder, deren Gerät weg ist', () => {
    const players = buildSeats(info, seats);
    expect(absentSeats(players, seats, 1000 + 25_000, 0)).toEqual([1, 2]);
    expect(absentSeats(players, seats, 1000 + 5_000, 0)).toEqual([]);
    expect(absentSeats(players, seats, 500 + 20_500, 1)).toEqual([2]);
  });
});
