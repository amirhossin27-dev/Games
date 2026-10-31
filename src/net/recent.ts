import type { GameId } from '../games/registry';
import type { AvatarKind } from '../lib/names';

/**
 * Zuletzt besuchte Spielzimmer – nur auf diesem Gerät, pro Kind. Damit geht es mit einem Tipp
 * zurück ins Zimmer, ohne die sechs Tiere nochmal einzugeben.
 */

export interface RecentRoom {
  code: string;
  game: GameId;
  /** Wer das Zimmer aufgemacht hat */
  host: { name: string; avatar: AvatarKind; color: string };
  /** Eigenes Zimmer (dann heißt der Knopf „Wieder öffnen“) */
  mine: boolean;
  at: number;
}

const KEY = 'joyboy:rooms:recent:v1';
export const RECENT_MAX = 4;
/** Ältere Zimmer vergessen – nach so langer Zeit kann der Code längst ein anderes Zimmer sein. */
export const RECENT_DAYS = 3;

type Store = Record<string, RecentRoom[]>;

function load(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Store;
  } catch {
    return {};
  }
}

function save(s: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // ignorieren
  }
}

/** Neuestes zuerst, ohne doppelte Codes, höchstens RECENT_MAX und nicht älter als RECENT_DAYS. */
export function mergeRecent(list: RecentRoom[], entry: RecentRoom | null, now = Date.now()): RecentRoom[] {
  const all = entry ? [entry, ...list.filter((r) => r.code !== entry.code)] : list;
  return all.filter((r) => now - r.at < RECENT_DAYS * 86_400_000).slice(0, RECENT_MAX);
}

export function recentRooms(profileId: string): RecentRoom[] {
  return mergeRecent(load()[profileId] ?? [], null);
}

export function rememberRoom(profileId: string, entry: Omit<RecentRoom, 'at'>) {
  const s = load();
  s[profileId] = mergeRecent(s[profileId] ?? [], { ...entry, at: Date.now() });
  save(s);
}

export function forgetRecent(profileId: string, code: string) {
  const s = load();
  s[profileId] = (s[profileId] ?? []).filter((r) => r.code !== code);
  save(s);
}

