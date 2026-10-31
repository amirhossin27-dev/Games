import { describe, expect, it } from 'vitest';
import dbRules from '../../database.rules.json';
import { CHAT_MAX, CHAT_WORDS, chatProblem, chatText, freeChat, QUICK_SENTENCES } from '../lib/chat';
import { BAD_WORDS } from '../lib/names';
import { canJoin, isOnline, ONLINE_MS } from '../net/presence';
import { mergeRecent, RECENT_DAYS, RECENT_MAX, type RecentRoom } from '../net/recent';
import { admitChanges, autoAdmit, chatOf, chatToPrune, CHAT_KEEP, fillSeats, openSeat, slotsFor, waitingKids, type ChatMsg, type NetSeat, type RoomInfo, type SeatDoc } from '../net/roomLogic';

const seat = (name: string, at = 1000): SeatDoc => ({ name, avatar: 'fuchs', color: '#fff', at });
const settings = { sound: true, speech: 'auto' as const, onlyGeneratedNames: false };

describe('Chat-Filter', () => {
  it('lässt normale Sätze und alle fertigen Sätze durch', () => {
    for (const ok of ['Hallo Lena!', 'Das war knapp', 'Ich habe 3 Sterne', 'Das ist extra schwer', 'Wer fängt an?', ...QUICK_SENTENCES]) expect(chatProblem(ok), ok).toBeNull();
  });

  it('blockt Schimpfwörter, auch mit Punkten dazwischen', () => {
    for (const bad of ['du bist dumm', 'A.r.s.c.h', 'so ein Depp', 'SCHEISSE']) expect(chatProblem(bad), bad).not.toBeNull();
  });

  it('blockt Telefonnummern, E-Mails, Links und Fragen nach Adresse oder Nummer', () => {
    for (const bad of ['0176 1234 567', '0 1 7 6', 'lena@web.de', 'www.joy.de', 'schau auf http://x', 'spiele.com', 'Wo wohnst du?', 'Wie ist deine Nummer', 'gib mir dein Handy', 'meine Adresse', 'insta: lena'])
      expect(chatProblem(bad), bad).not.toBeNull();
  });

  it('kennt eine Höchstlänge und leere Nachrichten', () => {
    expect(chatProblem('')).not.toBeNull();
    expect(chatProblem('   ')).not.toBeNull();
    expect(chatProblem('a'.repeat(CHAT_MAX))).toBeNull();
    expect(chatProblem('a'.repeat(CHAT_MAX + 1))).not.toBeNull();
  });

  it('zeigt bei „nur fertige Sätze“ nur die fertigen Sätze der anderen', () => {
    const msg = (t: string, extra: Partial<ChatMsg> = {}): ChatMsg => ({ by: 'b', name: 'Ben', avatar: 'fuchs', color: '#fff', t, at: 1, ...extra });
    const only = { ...settings, chatFree: false };
    expect(freeChat(settings)).toBe(true);
    expect(freeChat(only)).toBe(false);
    expect(chatText(msg('Hallo Lena'), 'a', settings)).toBe('Hallo Lena');
    expect(chatText(msg('Hallo Lena'), 'a', only)).toBeNull();
    // eigene Nachricht sieht man immer
    expect(chatText(msg('Hallo Lena', { by: 'a' }), 'a', only)).toBe('Hallo Lena');
    // fertiger Satz: der Text kommt vom eigenen Gerät, nicht aus der Nachricht
    expect(chatText(msg('irgendwas', { q: 0 }), 'a', only)).toBe(QUICK_SENTENCES[0]);
    // was durch den Filter dieses Geräts nicht kommt, wird nicht gezeigt
    expect(chatText(msg('du bist dumm'), 'a', settings)).toBeNull();
  });

  it('sortiert die Nachrichten und räumt alte erst ab ein paar zu viel weg', () => {
    const raw = { x: { by: 'a', t: 'zwei', at: 2 }, y: { by: 'b', t: 'eins', at: 1 }, kaputt: { at: 3 } };
    expect(chatOf(raw).map((m) => m.t)).toEqual(['eins', 'zwei']);
    expect(chatOf(null)).toEqual([]);
    const many = Array.from({ length: CHAT_KEEP + 10 }, (_, i) => ({ id: `m${i}` }));
    expect(chatToPrune(many)).toEqual([]);
    const more = [...many, { id: 'neu' }];
    expect(chatToPrune(more)).toHaveLength(11);
    expect(chatToPrune(more)[0]).toBe('m0');
  });
});

describe('Ohne Klingeln rein', () => {
  const info: RoomInfo = { host: 'h', game: 'ludo', level: 1, status: 'lobby', allowed: { a: 1 }, known: { k: true }, denied: { n: true }, at: 0 };
  const seats = { h: seat('Host'), a: seat('Anna'), k: seat('Kim'), f: seat('Freund'), x: seat('Fremd'), n: seat('Nein') };

  it('lässt Spielfreunde und Kinder, die schon drin waren, rein – Fremde müssen klingeln', () => {
    expect(autoAdmit(info, seats, { f: {} }).sort()).toEqual(['f', 'k']);
    expect(autoAdmit(info, seats, {})).toEqual(['k']);
    // wer abgelehnt wurde, kommt auch als Freund nicht von selbst rein
    expect(autoAdmit(info, seats, { n: {} })).toEqual(['k']);
  });

  it('nur so viele Kinder, wie mitspielen können – Robos machen Platz', () => {
    expect(autoAdmit({ ...info, robos: 2 }, seats, { f: {} })).toHaveLength(2);
    expect(autoAdmit({ ...info, allowed: { a: 1, x: 2 } }, seats, { f: {} })).toHaveLength(1);
    expect(autoAdmit({ ...info, game: 'vier' }, seats, { f: {} })).toEqual([]);
  });

  it('gibt jedem einen eigenen Platz', () => {
    expect(slotsFor(info, seats, ['k', 'f'])).toEqual({ k: 2, f: 3 });
    expect(slotsFor({ ...info, robos: 2 }, seats, ['k', 'f'])).toEqual({ k: 2, f: 3 });
    expect(slotsFor({ ...info, allowed: { a: 1, x: 2 } }, seats, ['k', 'f'])).toEqual({ k: 3 });
  });

  it('beim Reinlassen gehen so viele Robos, wie nötig', () => {
    // Anna + Gastgeber + 2 Robos = 4 → für Kim geht ein Robo
    expect(admitChanges({ ...info, robos: 2 }, seats, ['k'])).toEqual({ 'allowed/k': 2, 'denied/k': null, 'known/k': true, robos: 1 });
    // Mit Platz bleiben die Robos
    expect(admitChanges({ ...info, robos: 1 }, seats, ['k'])).toEqual({ 'allowed/k': 2, 'denied/k': null, 'known/k': true });
    // Zwei Kinder auf einmal, beide Robos gehen
    expect(admitChanges({ ...info, robos: 2 }, seats, ['k', 'f'])).toMatchObject({ 'allowed/k': 2, 'allowed/f': 3, robos: 0 });
    // Voll mit Kindern: nichts zu ändern
    expect(admitChanges({ ...info, allowed: { a: 1, x: 2, n: 3 } }, { ...seats }, ['k'])).toEqual({});
  });
});

describe('Mitten in der Runde dazukommen', () => {
  const info: RoomInfo = { host: 'h', game: 'ludo', level: 1, status: 'playing', allowed: { a: 1 }, robos: 2, round: 1, at: 0 };
  const seats = { h: seat('Lena'), a: seat('Ben'), m: seat('Mia') };
  const robo = (name: string): NetSeat => ({ name, avatar: 'robo', color: '#E6E6DF', robo: true });
  const kid = (uid: string, name: string): NetSeat => ({ uid, name, avatar: 'fuchs', color: '#fff', robo: false });
  const players: NetSeat[] = [kid('h', 'Lena'), kid('a', 'Ben'), robo('Robo'), robo('Robbi')];

  it('ein neues Kind übernimmt den ersten Robo-Platz', () => {
    const inn = { ...info, allowed: { a: 1, m: 2 }, robos: 1 };
    expect(waitingKids(inn, seats, players).map((w) => w.uid)).toEqual(['m']);
    const next = fillSeats(players, inn, seats)!;
    expect(next[2]).toMatchObject({ uid: 'm', name: 'Mia', robo: false, was: 'Robo' });
    expect(next[3].robo).toBe(true);
    // Danach wartet niemand mehr
    expect(fillSeats(next, inn, seats)).toBeNull();
  });

  it('ohne Robo übernimmt man den Platz eines Kindes, das gegangen ist', () => {
    const two = [kid('h', 'Lena'), kid('b', 'Bo'), kid('a', 'Ben')];
    const inn = { ...info, allowed: { a: 1, m: 2 }, robos: 0 };
    expect(openSeat(two, inn, seats)).toBe(1);
    expect(fillSeats(two, inn, seats)![1]).toMatchObject({ uid: 'm', was: 'Bo' });
    // Ist Bo noch im Zimmer (nur kurz weg), bleibt sein Platz seiner
    expect(openSeat(two, { ...inn, allowed: { a: 1, b: 3, m: 2 } }, { ...seats, b: seat('Bo') })).toBe(-1);
  });

  it('ist kein Platz frei, wartet das Kind auf die nächste Runde', () => {
    const full = [kid('h', 'Lena'), kid('a', 'Ben')];
    const inn = { ...info, allowed: { a: 1, m: 2 }, robos: 0 };
    expect(fillSeats(full, inn, seats)).toBeNull();
    expect(waitingKids(inn, seats, full).map((w) => w.doc.name)).toEqual(['Mia']);
  });
});

describe('Online-Punkt', () => {
  it('online heißt: kürzlich gemeldet und App nicht zugemacht', () => {
    expect(isOnline({ at: 1000 }, 1000 + ONLINE_MS - 1)).toBe(true);
    expect(isOnline({ at: 1000 }, 1000 + ONLINE_MS + 1)).toBe(false);
    expect(isOnline({ at: 1000, on: false }, 1001)).toBe(false);
    expect(isOnline(undefined, 0)).toBe(false);
  });

  it('dazukommen geht nur, solange im Zimmer noch nicht gespielt wird', () => {
    expect(canJoin({ at: 1000, room: '0a3f7c', st: 'lobby' }, 2000)).toBe(true);
    expect(canJoin({ at: 1000, room: '0a3f7c', st: 'playing' }, 2000)).toBe(false);
    expect(canJoin({ at: 1000, room: 'kaputt', st: 'lobby' }, 2000)).toBe(false);
    expect(canJoin({ at: 1000 }, 2000)).toBe(false);
  });
});

describe('Zuletzt im Zimmer', () => {
  const room = (code: string, at: number): RecentRoom => ({ code, game: 'vier', host: { name: 'Lena', avatar: 'katze', color: '#fff' }, mine: false, at });
  const day = 86_400_000;

  it('neuestes zuerst, ohne doppelte, höchstens ein paar', () => {
    const now = 10 * day;
    let list: RecentRoom[] = [];
    for (let i = 0; i < 6; i++) list = mergeRecent(list, room(`00000${i}`, now - 100 + i), now);
    expect(list).toHaveLength(RECENT_MAX);
    expect(list[0].code).toBe('000005');
    list = mergeRecent(list, room('000003', now), now);
    expect(list.map((r) => r.code)).toEqual(['000003', '000005', '000004', '000002']);
  });

  it('vergisst alte Zimmer', () => {
    const now = 10 * day;
    const list = mergeRecent([room('000001', now - RECENT_DAYS * day - 1), room('000002', now - day)], null, now);
    expect(list.map((r) => r.code)).toEqual(['000002']);
  });
});

describe('Datenbank-Regeln für Chat, Online-Punkt und Einladungen', () => {
  const { rules } = dbRules as unknown as { rules: Record<string, any> };

  it('der Chat prüft dieselben Wörter wie die App (sonst: npm run rules)', () => {
    const chat = rules.rooms.$code.chat.$id['.validate'] as string;
    for (const w of [...BAD_WORDS, ...CHAT_WORDS]) expect(chat).toContain(`.contains('${w}')`);
    expect(chat).toContain(`length <= ${CHAT_MAX}`);
    expect(chat).toContain("newData.child('by').val() === auth.uid");
    // schreiben nur, wer drin ist
    expect(rules.rooms.$code.chat.$id['.write']).toContain("info/allowed/' + auth.uid");
  });

  it('Online-Punkt und Einladungen schreibt nur das eigene Konto, Einladungen liest nur der Empfänger', () => {
    expect(rules.presence.$uid['.write']).toContain('auth.uid === $uid');
    expect(rules.presence.$uid.$other['.validate']).toBe(false);
    expect(rules.invites.$uid['.read']).toContain('auth.uid === $uid');
    expect(rules.invites.$uid.$from['.write']).toContain('auth.uid === $from');
    // Kein Lesen der ganzen Liste – Konten lassen sich nicht auflisten
    expect(rules.presence['.read']).toBeUndefined();
    expect(rules.invites['.read']).toBeUndefined();
  });
});
