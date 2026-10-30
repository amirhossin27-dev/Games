import { useSyncExternalStore } from 'react';
import type { GameId } from '../games/registry';
import type { AvatarKind } from '../lib/names';
import { nowMs } from '../lib/playtime';
import { activeProfile, getData, setData } from '../lib/store';
import { accountOf, ensureAuth } from './auth';
import { isPublished } from './cloud';
import { onlineConfigured } from './config';
import { dbRequest, SERVER_TIME } from './db';
import { getRoom } from './room';
import { INVITE_MS, type RoomInfo } from './roomLogic';

/**
 * Freunde: Wer zusammen online gespielt hat, wird Freund. Jedes Gerät meldet für das aktive Kind
 * im öffentlichen Profil, dass es da ist und in welchem Zimmer (on/room/game). Die Freunde-Liste
 * fragt das regelmäßig ab – so sieht man, wer online ist, kann Freunde einladen und Einladungen
 * annehmen. Freunde kommen ohne Klingeln ins Zimmer.
 */

export interface FriendView {
  uid: string;
  name: string;
  avatar: AvatarKind;
  color: string;
  online: boolean;
  /** Zimmer, in dem der Freund gerade ist (Wartezimmer, nicht mitten im Spiel) */
  room: string | null;
  game: GameId | null;
  /** zuletzt gesehen (Serverzeit) */
  on: number;
}

export interface Invite {
  code: string;
  by: string;
  game: GameId;
  at: number;
  friend: FriendView;
}

interface PresenceDoc {
  name?: string;
  avatar?: string;
  color?: string;
  on?: number;
  room?: string;
  game?: string;
}

interface FriendsState {
  profileId: string | null;
  list: FriendView[];
  invites: Invite[];
  loaded: boolean;
}

/** Wie lange jemand nach dem letzten Lebenszeichen als „online“ gilt */
const ONLINE_MS = 150_000;
const PING_MS = 60_000;
const POLL_MS = 15_000;

let state: FriendsState = { profileId: null, list: [], invites: [], loaded: false };
const listeners = new Set<() => void>();
const set = (patch: Partial<FriendsState>) => {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
};

export const useFriends = () =>
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => state,
    () => state,
  );

// Abgelehnte Einladungen (Zimmer + Zeit) – nicht nochmal zeigen
const dismissed = new Set<string>();
const inviteKey = (code: string, at: number) => `${code}:${at}`;

export function dismissInvite(inv: Invite) {
  dismissed.add(inviteKey(inv.code, inv.at));
  set({ invites: state.invites.filter((i) => i !== inv) });
}

/** Freund aus der Liste nehmen (kommt wieder dazu, wenn ihr erneut zusammen spielt) */
export function removeFriend(profileId: string, uid: string) {
  const d = getData();
  setData({
    ...d,
    profiles: d.profiles.map((p) => {
      if (p.id !== profileId) return p;
      const friends = { ...p.friends };
      delete friends[uid];
      return { ...p, friends };
    }),
  });
  set({ list: state.list.filter((f) => f.uid !== uid) });
}

// ───── Anwesenheit melden ─────

let lastPing = 0;
let lastPresence = '';

/** Zimmer, das Freunde sehen dürfen: nur, wenn ich drin bin und dort gerade niemand spielt */
function myRoom(): { room: string | null; game: string | null } {
  const r = getRoom();
  const p = activeProfile(getData());
  if (!r.code || !r.info || r.profileId !== p?.id || r.info.status !== 'lobby') return { room: null, game: null };
  const member = r.info.host === r.uid || (r.uid && r.info.allowed?.[r.uid] !== undefined);
  return member ? { room: r.code, game: r.info.game } : { room: null, game: null };
}

async function ping(force = false) {
  const p = activeProfile(getData());
  if (!p || !accountOf(p.id) || !isPublished(p.id)) return;
  const pres = myRoom();
  const key = `${p.id}|${pres.room}|${pres.game}`;
  if (!force && key === lastPresence && Date.now() - lastPing < PING_MS) return;
  try {
    const acc = await ensureAuth(p.id);
    await dbRequest('PATCH', `profiles/${acc.uid}/public`, acc.token!, { on: SERVER_TIME, room: pres.room, game: pres.game });
    lastPing = Date.now();
    lastPresence = key;
  } catch {
    // Profil noch nicht in der Cloud oder offline – beim nächsten Mal
  }
}

// ───── Freunde abfragen ─────

let polling = false;

export async function refreshFriends() {
  const p = activeProfile(getData());
  if (!p || !onlineConfigured() || polling) return;
  if (state.profileId !== p.id) set({ profileId: p.id, list: [], invites: [], loaded: false });
  const uids = Object.keys(p.friends);
  if (!uids.length) return set({ list: [], invites: [], loaded: true });
  polling = true;
  try {
    const acc = await ensureAuth(p.id);
    const now = nowMs();
    const list = await Promise.all(
      uids.map(async (uid): Promise<FriendView> => {
        const known = p.friends[uid];
        let doc: PresenceDoc | null = null;
        try {
          doc = await dbRequest<PresenceDoc | null>('GET', `profiles/${uid}/public`, acc.token!);
        } catch {
          // offline oder Profil gelöscht
        }
        const on = doc?.on ?? 0;
        const online = now - on < ONLINE_MS;
        return {
          uid,
          name: doc?.name ?? known.name,
          avatar: (doc?.avatar as AvatarKind) ?? known.avatar,
          color: doc?.color ?? known.color,
          online,
          room: online && doc?.room ? doc.room : null,
          game: online && doc?.game ? (doc.game as GameId) : null,
          on,
        };
      }),
    );
    list.sort((a, b) => Number(b.online) - Number(a.online) || Number(!!b.room) - Number(!!a.room) || a.name.localeCompare(b.name));

    // Einladungen: Zimmer der Freunde, in denen ich eingeladen bin
    const mine = getRoom().code;
    const rooms = [...new Set(list.filter((f) => f.room && f.room !== mine).map((f) => f.room!))];
    const invites: Invite[] = [];
    await Promise.all(
      rooms.map(async (code) => {
        try {
          const info = await dbRequest<RoomInfo | null>('GET', `rooms/${code}/info`, acc.token!);
          const inv = info?.invited?.[acc.uid];
          if (!info || !inv || info.status !== 'lobby' || now - inv.at > INVITE_MS || dismissed.has(inviteKey(code, inv.at))) return;
          if (info.allowed?.[acc.uid] !== undefined) return;
          const friend = list.find((f) => f.room === code)!;
          invites.push({ code, by: inv.n || friend.name, game: info.game, at: inv.at, friend });
        } catch {
          // Zimmer weg
        }
      }),
    );
    if (activeProfile(getData())?.id === p.id) set({ profileId: p.id, list, invites, loaded: true });
  } catch {
    set({ loaded: true });
  } finally {
    polling = false;
  }
}

// ───── Schleife ─────

let started = false;

/** Einmal beim App-Start: solange die App sichtbar ist, Anwesenheit melden und Freunde abfragen. */
export function startFriends() {
  if (started || !onlineConfigured()) return;
  started = true;
  const tick = () => {
    if (document.visibilityState !== 'visible' || navigator.onLine === false) return;
    void ping();
    void refreshFriends();
  };
  window.setTimeout(tick, 2500);
  window.setInterval(tick, POLL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void ping(true);
      void refreshFriends();
    }
  });
}

/** Sofort melden (z. B. nach Zimmer öffnen oder verlassen) */
export const pingNow = () => void ping(true);
