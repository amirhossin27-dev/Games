import { describe, expect, it } from 'vitest';
import { addPlay, freshPlay, LOCK_MS, statusOf } from '../lib/playtime';

describe('Spielzeit ohne geprüfte Uhrzeit', () => {
  const start = 1_000_000;
  const locked = { ...freshPlay(30), usedSec: 30 * 60, windowStart: start, lockedUntil: start + LOCK_MS };

  it('endet eine Pause erst, wenn die Uhrzeit geprüft ist', () => {
    const later = start + LOCK_MS + 1000;
    expect(statusOf(locked, later, false)).toMatchObject({ locked: true, waitingForTime: true });
    expect(statusOf(locked, later, true)).toMatchObject({ locked: false, waitingForTime: false, remainingSec: 30 * 60 });
    expect(statusOf(locked, start + 1000, false)).toMatchObject({ locked: true, waitingForTime: false });
  });

  it('beginnt kein neues Kontingent, wenn nur die Geräte-Uhr weiter ist', () => {
    const s = { ...freshPlay(30), usedSec: 20 * 60, windowStart: start };
    const later = start + LOCK_MS + 1000;
    expect(addPlay(s, later, 1, false).usedSec).toBe(20 * 60 + 1);
    expect(addPlay(s, later, 1, true).usedSec).toBe(1);
  });

  it('sperrt trotzdem, wenn die Zeit aufgebraucht ist', () => {
    const s = { ...freshPlay(30), usedSec: 30 * 60 - 1, windowStart: start };
    expect(addPlay(s, start + 5000, 2, false).lockedUntil).toBe(start + 5000 + LOCK_MS);
  });
});
