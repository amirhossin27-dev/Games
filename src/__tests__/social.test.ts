import { describe, expect, it } from 'vitest';
import { chatProblem } from '../lib/chat';
import { upgradeAnimal, upgradeColor } from '../lib/names';
import { autoAdmits, chatFeed, humanCount, INVITE_MS, type RoomInfo, type SeatDoc } from '../net/roomLogic';
import { chunk } from '../voice/joyVoice';
import { pronounce } from '../voice/catalog';

const seat = (name: string, extra: Partial<SeatDoc> = {}): SeatDoc => ({ name, avatar: 'fuchs', color: '#fff', at: 1000, ...extra });
const info = (extra: Partial<RoomInfo> = {}): RoomInfo => ({ host: 'h', game: 'vier', level: 1, status: 'lobby', at: 1000, ...extra });

describe('Freunde im Zimmer', () => {
  it('lässt Freunde und frisch Eingeladene ohne Klingeln rein', () => {
    const seats = { h: seat('Gast'), f: seat('Freund'), i: seat('Eingeladen'), x: seat('Fremd'), alt: seat('Alt') };
    const room = info({ invited: { i: { at: 50_000, n: 'Gast' }, alt: { at: 60_000 - INVITE_MS - 1, n: 'Gast' } } });
    expect(autoAdmits(room, seats, { f: {} }, 60_000).sort()).toEqual(['f', 'i']);
    // Einladung abgelaufen
    expect(autoAdmits(room, seats, {}, 50_000 + INVITE_MS + 1)).toEqual([]);
    // Wer schon drin ist oder abgelehnt wurde, klingelt nicht
    expect(autoAdmits(info({ allowed: { f: 1 }, denied: { x: true } }), seats, { f: {}, x: {} }, 0)).toEqual([]);
  });
});

describe('Chat', () => {
  it('zeigt Nachrichten aller Kinder im Zimmer nach Zeit – ohne Klingelnde', () => {
    const seats = {
      h: seat('Mia', { chat: JSON.stringify([{ i: 1, t: 'Hallo!', at: 10 }, { i: 2, t: 'Los geht’s', at: 30 }]) }),
      g: seat('Ben', { chat: JSON.stringify([{ i: 1, t: 'Hi Mia', at: 20 }]) }),
      k: seat('Klopfer', { chat: JSON.stringify([{ i: 1, t: 'Lass mich rein', at: 15 }]) }),
      kaputt: seat('Kaputt', { chat: '{nicht json' }),
    };
    const room = info({ allowed: { g: 1, kaputt: 2 } });
    expect(chatFeed(room, seats).map((m) => `${m.name}: ${m.t}`)).toEqual(['Mia: Hallo!', 'Ben: Hi Mia', 'Mia: Los geht’s']);
    expect(humanCount(room, seats)).toBe(3);
    expect(humanCount(info(), { h: seat('Mia') })).toBe(1);
  });

  it('filtert Schimpfwörter und persönliche Daten', () => {
    expect(chatProblem('Gut gemacht! 👍')).toBeNull();
    expect(chatProblem('Noch 3 Runden?')).toBeNull();
    expect(chatProblem('du bist DUMM')).not.toBeNull();
    expect(chatProblem('ruf an 0151 2345678')).not.toBeNull();
    expect(chatProblem('schreib mir mia@example.de')).not.toBeNull();
    expect(chatProblem('www.spiele.de')).not.toBeNull();
    expect(chatProblem('Ich wohne in der Hauptstraße')).not.toBeNull();
    expect(chatProblem('   ')).not.toBeNull();
    expect(chatProblem('x'.repeat(81))).not.toBeNull();
  });
});

describe('Profile umstellen', () => {
  it('macht aus dem Dino einen Bär – auch im Würfel-Namen', () => {
    expect(upgradeAnimal('dino', 'Flinker Dino')).toEqual({ kind: 'baer', name: 'Flinker Bär' });
    expect(upgradeAnimal('dino', 'Lena')).toEqual({ kind: 'baer', name: 'Lena' });
    expect(upgradeAnimal('fuchs', 'Flinker Fuchs')).toEqual({ kind: 'fuchs', name: 'Flinker Fuchs' });
  });

  it('macht alte blasse Farben kräftiger', () => {
    expect(upgradeColor('#F6D3B8')).toBe('#FFB066');
    expect(upgradeColor('#f6d3b8')).toBe('#FFB066');
    expect(upgradeColor('#123456')).toBe('#123456');
  });
});

describe('Joys Stimme', () => {
  it('teilt lange Sätze an Komma oder Doppelpunkt', () => {
    expect(chunk('Kurz und gut.')).toEqual(['Kurz und gut.']);
    const long = 'Schreib zu jeder Spalte ein Wort mit diesem Buchstaben: eine Stadt, ein Tier, einen Namen und noch etwas.';
    const parts = chunk(long);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join(' ')).toBe(long);
    expect(parts.every((p) => p.length <= 70 || !p.includes(', '))).toBe(true);
  });

  it('spricht englische Namen richtig aus', () => {
    expect(pronounce('Hallo! Ich bin Joy. Willkommen bei Joyboy, Joys Spiele-App.')).toBe('Hallo! Ich bin Dschoi. Willkommen bei Dschoiboi, Dschois Spiele-App.');
  });
});
