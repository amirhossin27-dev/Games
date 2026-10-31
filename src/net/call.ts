import { useSyncExternalStore } from 'react';
import { GAME_BY_ID, type GameId } from '../games/registry';
import { levelForAge, type Profile } from '../lib/store';
import { sendInvite } from './presence';
import { createRoom } from './room';
import { callStartsNow, type RoomInfo, type SeatDoc } from './roomLogic';

/**
 * Spielfreund anrufen: Ein Tipp auf den Freund, ein Tipp aufs Spiel – Joyboy öffnet dafür ein
 * Spielzimmer und schickt dem Freund eine Einladung. Sagt er „Ja, los!“, kommt er als Spielfreund
 * ohne Klingeln rein (hostChores), und das Spiel startet beim Gastgeber von selbst (useCallStart).
 */

export interface CallFriend {
  uid: string;
  name: string;
  avatar: Profile['avatar'];
  color: string;
}

export interface Call {
  code: string;
  game: GameId;
  friend: CallFriend;
  /** Gerätezeit beim Anrufen – für „geht gerade nicht ran“ */
  at: number;
}

/** So lange klingelt es, bevor Joyboy sagt: „geht gerade nicht ran“ */
export const RING_MS = 45_000;

let call: Call | null = null;
const listeners = new Set<() => void>();

function set(next: Call | null) {
  call = next;
  listeners.forEach((l) => l());
}

export const getCall = () => call;

export function useCall(): Call | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    getCall,
    getCall,
  );
}

/** Anrufen: Spielzimmer öffnen (Stufe passend zum Alter) und den Freund einladen. */
export async function startCall(profile: Profile, friend: CallFriend, game: GameId) {
  const code = await createRoom(profile, game, levelForAge(profile.age));
  set({ code, game, friend, at: Date.now() });
  try {
    await sendInvite(profile, friend.uid, code, game);
  } catch {
    set(null);
    throw new Error('Der Anruf ging nicht raus. Ist das Internet an?');
  }
}

/** Nochmal klingeln lassen */
export async function ringAgain(profile: Profile) {
  if (!call) return;
  await sendInvite(profile, call.friend.uid, call.code, call.game);
  set({ ...call, at: Date.now() });
}

/** Anruf vorbei (angenommen, aufgelegt oder Spielzimmer verlassen) */
export const endCall = () => {
  if (call) set(null);
};

/** Kann das Spiel für diesen Anruf jetzt von selbst starten? (siehe callStartsNow) */
export function callReady(c: Call | null, code: string | null, uid: string | null, info: RoomInfo | null, seats: Record<string, SeatDoc>): boolean {
  return !!c && !!info && c.code === code && callStartsNow(info, seats, uid, c.friend.uid);
}

/** Lieblingsreihenfolge fürs Anrufen: zuletzt mit Freunden gespielte Spiele zuerst */
const LAST_KEY = 'joyboy:call-games:v1';

export function lastCallGames(profileId: string): GameId[] {
  try {
    const all = JSON.parse(localStorage.getItem(LAST_KEY) ?? '{}') as Record<string, GameId[]>;
    return Array.isArray(all[profileId]) ? all[profileId].filter((g) => !!GAME_BY_ID[g]) : [];
  } catch {
    return [];
  }
}

export function rememberCallGame(profileId: string, game: GameId) {
  try {
    const all = JSON.parse(localStorage.getItem(LAST_KEY) ?? '{}') as Record<string, GameId[]>;
    all[profileId] = [game, ...(all[profileId] ?? []).filter((g) => g !== game)].slice(0, 6);
    localStorage.setItem(LAST_KEY, JSON.stringify(all));
  } catch {
    // dann eben ohne Reihenfolge
  }
}
