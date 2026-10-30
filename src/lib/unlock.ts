import type { GameMeta } from '../games/registry';
import type { Profile, Settings } from './store';
import { dayKey } from './util';

/**
 * Erst lernen, dann spielen: Die Arcade- und Duell-Spiele sind jeden Tag erst frei, wenn das Kind
 * ein paar Lern- und Brettspiele zu Ende gespielt hat. Die Anzahl stellen die Eltern ein.
 */

export const ARCADE_AFTER_DEFAULT = 2;
export const ARCADE_AFTER_CHOICES = [1, 2, 3, 4, 5, 6, 8];

export const isLearnGame = (g: GameMeta) => g.kind === 'def';

/** Eingestellte Anzahl Lernspiele (0 = Sperre aus) */
export const arcadeAfter = (s: Settings) => s.arcadeAfter ?? ARCADE_AFTER_DEFAULT;

export const learnedToday = (p: Profile, today = dayKey()) => (p.learnDay.date === today ? p.learnDay.count : 0);

/** Wie viele Lernspiele heute noch fehlen, bis das Spiel frei ist (0 = frei) */
export function learnLeft(g: GameMeta, p: Profile, s: Settings, today = dayKey()): number {
  if (isLearnGame(g)) return 0;
  return Math.max(0, arcadeAfter(s) - learnedToday(p, today));
}

export const learnText = (n: number) => (n === 1 ? 'noch 1 Lernspiel' : `noch ${n} Lernspiele`);
