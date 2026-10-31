import { describe, expect, it } from 'vitest';
import { callStartsNow, type RoomInfo, type SeatDoc } from '../net/roomLogic';

const seat = (name: string): SeatDoc => ({ name, avatar: 'fuchs', color: '#fff', at: 1000 });
const room = (extra: Partial<RoomInfo> = {}): RoomInfo => ({ host: 'lea', game: 'vier', level: 1, status: 'lobby', at: 1, ...extra });

describe('Spielfreund anrufen', () => {
  it('startet von selbst, sobald der angerufene Freund drin ist', () => {
    const seats = { lea: seat('Lea'), mia: seat('Mia') };
    // Mia hat geklingelt, ist aber noch nicht drin
    expect(callStartsNow(room(), seats, 'lea', 'mia')).toBe(false);
    // Spielfreunde kommen ohne Klingeln rein → jetzt geht es los
    expect(callStartsNow(room({ allowed: { mia: 1 } }), seats, 'lea', 'mia')).toBe(true);
  });

  it('startet nur beim Gastgeber und nur, solange noch nicht gespielt wird', () => {
    const seats = { lea: seat('Lea'), mia: seat('Mia') };
    const info = room({ allowed: { mia: 1 } });
    expect(callStartsNow(info, seats, 'mia', 'mia')).toBe(false);
    expect(callStartsNow({ ...info, status: 'playing' }, seats, 'lea', 'mia')).toBe(false);
    expect(callStartsNow({ ...info, status: 'closed' }, seats, 'lea', 'mia')).toBe(false);
  });

  it('wartet auf den Freund, auch wenn schon ein anderes Kind da ist', () => {
    const seats = { lea: seat('Lea'), ben: seat('Ben') };
    expect(callStartsNow(room({ game: 'ludo', allowed: { ben: 1 } }), seats, 'lea', 'mia')).toBe(false);
  });

  it('startet nicht, wenn zu viele für das Spiel da sind', () => {
    const seats = { lea: seat('Lea'), mia: seat('Mia'), ben: seat('Ben') };
    // Vier gewinnt geht nur zu zweit
    expect(callStartsNow(room({ allowed: { mia: 1, ben: 2 } }), seats, 'lea', 'mia')).toBe(false);
    expect(callStartsNow(room({ game: 'ludo', allowed: { mia: 1, ben: 2 } }), seats, 'lea', 'mia')).toBe(true);
  });
});
