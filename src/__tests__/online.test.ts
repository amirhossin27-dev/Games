import { describe, expect, it } from 'vitest';
import dbRules from '../../database.rules.json';
import { ANIMALS, BAD_WORDS, nameProblem, OLD_ANIMALS, onlineName, upgradeAnimal, upgradeColor } from '../lib/names';
import { CODE_LEN, codeAnimals, codeFromIndexes, isCode, randomCode } from '../net/codes';
import { applyStreamEvent } from '../net/db';
import { absentSeats, buildSeats, guestActs, isMember, knocking, leftRoom, members, nextSlot, parseActs, robosFor, takeOver, taken, type RoomInfo, type SeatDoc } from '../net/roomLogic';

const seat = (name: string, at = 1000, extra: Partial<SeatDoc> = {}): SeatDoc => ({ name, avatar: 'fuchs', color: '#fff', at, ...extra });

describe('Zimmer-Code', () => {
  it('besteht aus sechs Tieren', () => {
    expect(isCode('0a3f7c')).toBe(true);
    expect(isCode('0A3F7C')).toBe(false);
    // alte, kurze Codes gelten nicht mehr
    expect(isCode('0a3f')).toBe(false);
    expect(codeAnimals('0a3f7c').map((a) => a.name)).toEqual(['Fuchs', 'Elefant', 'Panda', 'Einhorn', 'Dino', 'Schildkröte']);
    expect(codeFromIndexes([0, 10, 3, 15, 7, 12])).toBe('0a3f7c');
    for (let i = 0; i < 20; i++) expect(isCode(randomCode())).toBe(true);
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

  it('höchstens so viele Kinder wie das Spiel erlaubt – Robos machen Platz', () => {
    expect(taken(info, seats)).toBe(4);
    // Ein Robo sitzt auf dem letzten Platz, aber Kinder gehen vor
    expect(nextSlot(info, seats)).toBe(3);
    expect(nextSlot({ ...info, robos: 0 }, seats)).toBe(3);
    expect(nextSlot({ ...info, allowed: { a: 1, b: 2, k: 3 } }, seats)).toBeNull();
    expect(nextSlot({ ...info, game: 'vier', allowed: {}, robos: 0 }, seats)).toBe(1);
    expect(nextSlot({ ...info, game: 'vier', allowed: { a: 1 }, robos: 0 }, seats)).toBeNull();
  });

  it('wer gegangen ist, gibt seinen Platz frei', () => {
    const { b: _ben, ...rest } = seats;
    expect(members(info, rest).map((m) => m.uid)).toEqual(['h', 'a']);
    expect(taken(info, rest)).toBe(3);
    expect(nextSlot(info, rest)).toBe(2);
    expect(leftRoom(info, rest)).toEqual(['b']);
    expect(leftRoom(info, seats)).toEqual([]);
  });

  it('nur Gastgeber und reingelassene Kinder sind drin', () => {
    expect(isMember(info, 'h')).toBe(true);
    expect(isMember(info, 'a')).toBe(true);
    expect(isMember(info, 'k')).toBe(false);
    expect(isMember(info, null)).toBe(false);
  });

  it('nach der Übernahme bleibt der alte Gastgeber Mitspieler', () => {
    const tree = applyStreamEvent({ info }, 'patch', '/info', takeOver(info, 'a')) as { info: RoomInfo };
    expect(tree.info.host).toBe('a');
    expect(tree.info.allowed).toEqual({ b: 2, h: 1 });
    expect(isMember(tree.info, 'h')).toBe(true);
    expect(members(tree.info, seats).map((m) => m.uid)).toEqual(['a', 'h', 'b']);
    expect(knocking(tree.info, seats).map((k) => k.uid)).toEqual(['k']);
  });

  it('beim Spielwechsel gehen Robos, für die kein Platz mehr ist', () => {
    expect(robosFor('vier', 1, 2)).toBe(0);
    expect(robosFor('ludo', 2, 3)).toBe(1);
    expect(robosFor('ludo', 1, 1)).toBe(1);
    expect(robosFor('vier', 3, 1)).toBe(1);
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

describe('Namen online', () => {
  it('lässt keine Kontakt-Apps, Links und langen Zahlen durch', () => {
    for (const bad of ['insta_lena', 'TikTokStar', 'Snap Chat', 'www.lena', 'Lena1234', 'lena@web'])
      expect(nameProblem(bad), bad).not.toBeNull();
    expect(nameProblem('Lena')).toBeNull();
    expect(nameProblem('Flinker Fuchs')).toBeNull();
  });

  it('zeigt statt eines unpassenden Namens einen Würfel-Namen', () => {
    expect(onlineName('Lena', 'fuchs')).toBe('Lena');
    for (const a of ANIMALS) {
      const name = onlineName('insta_lena', a.kind);
      expect(nameProblem(name), name).toBeNull();
      expect(name.length).toBeLessThanOrEqual(16);
    }
  });
});

describe('Datenbank-Regeln', () => {
  const { rules } = dbRules;

  it('prüfen dieselben Wörter und Tiere wie die App (sonst: npm run rules)', () => {
    const seat = rules.rooms.$code.seats.$uid['.validate'];
    const pub = rules.profiles.$uid.public['.validate'];
    for (const check of [seat, pub]) {
      for (const w of BAD_WORDS) expect(check).toContain(`.contains('${w}')`);
      // dazu @, http und www
      expect(check.match(/\.contains\('/g)).toHaveLength(BAD_WORDS.length + 3);
      for (const a of [...ANIMALS, ...OLD_ANIMALS]) expect(check).toContain(`=== '${a.kind}'`);
      expect(check.match(/child\('avatar'\)\.val\(\) === '/g)).toHaveLength(ANIMALS.length + OLD_ANIMALS.length);
    }
  });

  it('kennen nur Codes mit sechs Tieren und lassen nur Mitglieder ins Zimmer schauen', () => {
    const room = rules.rooms.$code;
    expect(room['.read']).toContain(`[0-9a-f]{${CODE_LEN}}`);
    expect(room['.write']).toContain(`[0-9a-f]{${CODE_LEN}}`);
    expect(room['.read']).toContain("info/allowed/' + auth.uid");
    expect(room.info['.read']).toContain("seats/' + auth.uid");
  });
});

describe('Profile umstellen', () => {
  it('macht aus dem Dino einen Bär – auch im Würfel-Namen', () => {
    expect(upgradeAnimal('dino', 'Flinker Dino')).toEqual({ kind: 'baer', name: 'Flinker Bär' });
    expect(upgradeAnimal('dino', 'Lena')).toEqual({ kind: 'baer', name: 'Lena' });
    expect(upgradeAnimal('fuchs', 'Flinker Fuchs')).toEqual({ kind: 'fuchs', name: 'Flinker Fuchs' });
    // Andere Geräte mit älterer App zeigen weiter einen Dino, nicht „Robo“
    expect(onlineName('insta_lena', 'dino')).toBe('Flinker Dino');
  });

  it('macht alte blasse Farben kräftiger', () => {
    expect(upgradeColor('#F6D3B8')).toBe('#FFB066');
    expect(upgradeColor('#f6d3b8')).toBe('#FFB066');
    expect(upgradeColor('#123456')).toBe('#123456');
  });
});
