import { useSyncExternalStore } from 'react';
import type { GameId } from '../games/registry';
import { onlineName, type AvatarKind } from '../lib/names';
import { activeProfile, subscribe, type Profile } from '../lib/store';
import { accountOf, ensureAuth } from './auth';
import { isCode } from './codes';
import { onlineAllowed } from './consent';
import { dbRequest, dbUrl, openStream, SERVER_TIME } from './db';
import { getRoom } from './room';
import { isMember } from './roomLogic';

/**
 * Wer ist gerade online? Jedes Kind, das Joyboy offen hat, meldet sich alle paar Sekunden unter
 * presence/<Konto> – mit dem Zimmer, in dem es gerade ist. Lesen können das nur Kinder, die das
 * Konto kennen, also Spielfreunde (die Konten sind lange Zufallswerte und lassen sich nicht auflisten).
 *
 * Einladungen: invites/<Freund>/<ich> = { code, game, name, … }. Jedes Kind hört auf seine
 * eigenen Einladungen; nur es selbst kann sie lesen.
 */

export interface Presence {
  at: number;
  /** false = App gerade zugemacht */
  on?: boolean;
  /** Zimmer, in dem das Kind gerade ist */
  room?: string;
  /** Zimmer: 'lobby' (man kann dazukommen) oder 'playing' */
  st?: 'lobby' | 'playing';
  game?: GameId;
}

export interface Invite {
  from: string;
  code: string;
  game: GameId;
  name: string;
  avatar: AvatarKind;
  color: string;
  at: number;
}

/** So lange gilt ein Kind nach dem letzten Lebenszeichen als online */
export const ONLINE_MS = 75_000;
/** So lange gilt eine Einladung */
export const INVITE_MS = 10 * 60_000;
const BEAT_MS = 25_000;
const POLL_MS = 25_000;
const MAX_FRIENDS = 20;

export const isOnline = (p: Presence | undefined, now: number) => !!p && p.on !== false && now - p.at < ONLINE_MS;

/** Ist dieser Freund gerade in einem offenen Spielzimmer? Dann kann man zu ihm – auch mitten in der Runde. */
export const canJoin = (p: Presence | undefined, now: number) => isOnline(p, now) && !!p?.room && isCode(p.room) && (p.st === 'lobby' || p.st === 'playing');

/** Ein Spielzimmer, in dem gerade mindestens ein Spielfreund ist */
export interface FriendRoom {
  code: string;
  game?: GameId;
  /** Läuft gerade eine Runde? */
  playing: boolean;
  /** Die Spielfreunde darin (Konten) */
  friends: string[];
}

/**
 * Die gerade offenen Spielzimmer der Spielfreunde – nach Zimmer zusammengefasst. Wartende Zimmer
 * zuerst (da geht es gleich los), dann die mit mehr Freunden. Das eigene Zimmer zählt nicht.
 */
export function friendRooms(presence: Record<string, Presence>, friendUids: string[], now: number, myRoom?: string | null): FriendRoom[] {
  const rooms = new Map<string, FriendRoom>();
  for (const uid of friendUids) {
    const p = presence[uid];
    if (!canJoin(p, now) || p!.room === myRoom) continue;
    const r = rooms.get(p!.room!) ?? { code: p!.room!, game: p!.game, playing: false, friends: [] };
    r.friends.push(uid);
    if (p!.st === 'playing') r.playing = true;
    if (!r.game) r.game = p!.game;
    rooms.set(r.code, r);
  }
  return [...rooms.values()].sort((a, b) => Number(a.playing) - Number(b.playing) || b.friends.length - a.friends.length);
}

// ───── Kleiner Speicher für die Anzeige ─────

interface PresenceState {
  /** Freunde: Konto → Stand */
  friends: Record<string, Presence>;
  invites: Invite[];
  /** Serverzeit minus Gerätezeit */
  offset: number;
}

let state: PresenceState = { friends: {}, invites: [], offset: 0 };
const listeners = new Set<() => void>();

function set(changes: Partial<PresenceState>) {
  state = { ...state, ...changes };
  listeners.forEach((l) => l());
}

const getState = () => state;

export function usePresence(): PresenceState {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    getState,
    getState,
  );
}

export const presenceNow = () => Date.now() + state.offset;

/** Ein Freund ist gerade online gekommen */
const comeListeners = new Set<(uid: string) => void>();
export function onFriendOnline(fn: (uid: string) => void) {
  comeListeners.add(fn);
  return () => {
    comeListeners.delete(fn);
  };
}

// ───── Eigenes Lebenszeichen ─────

let me: { profileId: string; uid: string } | null = null;
let beatTimer: number | undefined;
let lastSent = '';

/** Was die Freunde über mich sehen */
function myStatus(): Omit<Presence, 'at'> {
  const room = getRoom();
  const inRoom = !!room.code && room.profileId === me?.profileId && !!room.info && room.info.status !== 'closed' && isMember(room.info, room.uid);
  return inRoom ? { on: true, room: room.code!, st: room.info!.status === 'playing' ? 'playing' : 'lobby', game: room.info!.game } : { on: true };
}

async function beat(force = false) {
  const p = activeProfile();
  // Ohne Spielfreunde schaut niemand nach – dann auch nichts melden
  if (!p || !onlineAllowed() || document.visibilityState === 'hidden' || !Object.keys(p.friends).length) return;
  const status = myStatus();
  const key = `${p.id}|${JSON.stringify(status)}`;
  // Nichts Neues und noch frisch genug → sparen
  if (!force && key === lastSent) return;
  try {
    const acc = await ensureAuth(p.id);
    if (me && me.profileId !== p.id) void goOffline(me);
    me = { profileId: p.id, uid: acc.uid };
    const res = await dbRequest<{ at: number }>('PUT', `presence/${acc.uid}`, acc.token!, { ...status, at: SERVER_TIME });
    lastSent = key;
    if (res?.at) set({ offset: res.at - Date.now() });
  } catch {
    // nächstes Mal
  }
}

/** Beim Zumachen: „nicht mehr da“ – mit keepalive, damit es auch beim Schließen noch rausgeht. */
async function goOffline(who: { profileId: string; uid: string }) {
  const acc = accountOf(who.profileId);
  if (!acc?.token) return;
  try {
    await fetch(dbUrl(`presence/${who.uid}`, acc.token), { method: 'PATCH', body: JSON.stringify({ on: false, at: SERVER_TIME }), keepalive: true });
  } catch {
    // dann merken es die Freunde eben nach ein paar Sekunden
  }
  lastSent = '';
}

// ───── Freunde abfragen ─────

let pollTimer: number | undefined;
/** Letzter Stand je Freund: online, offline oder noch nie gemeldet */
let known: Record<string, 'on' | 'off' | 'none'> | null = null;

async function poll() {
  const p = activeProfile();
  if (!p || !onlineAllowed() || document.visibilityState === 'hidden') return;
  const uids = Object.keys(p.friends).slice(-MAX_FRIENDS);
  if (!uids.length) {
    if (Object.keys(state.friends).length) set({ friends: {} });
    return;
  }
  try {
    const acc = await ensureAuth(p.id);
    const out: Record<string, Presence> = {};
    await Promise.all(
      uids.map(async (uid) => {
        try {
          const doc = await dbRequest<Presence | null>('GET', `presence/${uid}`, acc.token!);
          if (doc && typeof doc.at === 'number') out[uid] = doc;
        } catch {
          // Freund war noch nie online
        }
      }),
    );
    if (activeProfile()?.id !== p.id) return;
    const now = presenceNow();
    const before = known;
    const next: Record<string, 'on' | 'off' | 'none'> = Object.fromEntries(uids.map((u) => [u, !out[u] ? 'none' : isOnline(out[u], now) ? 'on' : 'off']));
    known = next;
    // Beim ersten Abfragen keine Meldungen – nur wer danach online kommt, und nicht, wer gerade im selben Zimmer ist
    const myRoom = getRoom().code;
    if (before) for (const u of uids) if (next[u] === 'on' && before[u] === 'off' && (!myRoom || out[u].room !== myRoom)) comeListeners.forEach((fn) => fn(u));
    set({ friends: out });
  } catch {
    // offline
  }
}

/** Gleich nochmal nachschauen (z. B. beim Öffnen des Zimmer-Reiters) */
export const refreshFriends = () => void poll();

// ───── Einladungen ─────

let closeInvites: (() => void) | null = null;
let invitesFor = '';

function onInvites(tree: Record<string, unknown> | null) {
  const now = presenceNow();
  const list: Invite[] = [];
  const old: string[] = [];
  for (const [from, raw] of Object.entries(tree ?? {})) {
    const inv = raw as Omit<Invite, 'from'>;
    if (!inv || !isCode(String(inv.code)) || typeof inv.at !== 'number') continue;
    if (now - inv.at > INVITE_MS) old.push(from);
    else list.push({ ...inv, from });
  }
  set({ invites: list.sort((a, b) => b.at - a.at) });
  for (const from of old) void dropInvite(from);
}

/**
 * Live auf Einladungen hören – nur solange Joyboy sichtbar offen ist, das Kind Spielfreunde hat
 * (nur die können einladen) und nicht schon in einem Zimmer ist. So bleibt die Zahl der
 * Dauerverbindungen klein. Einladungen, die währenddessen kommen, sind danach noch da.
 */
async function listenInvites(force = false) {
  const p = activeProfile();
  const room = getRoom();
  const inRoom = !!room.code && room.profileId === p?.id;
  const want = p && onlineAllowed() && Object.keys(p.friends).length > 0 && !inRoom && document.visibilityState !== 'hidden' ? p.id : '';
  if (want === invitesFor && !force) return;
  closeInvites?.();
  closeInvites = null;
  invitesFor = want;
  set({ invites: [] });
  if (!want) return;
  try {
    const acc = await ensureAuth(want, force);
    if (invitesFor !== want) return;
    closeInvites = openStream(`invites/${acc.uid}`, acc.token!, {
      onOpen: () => {
        inviteFails = 0;
      },
      onData: onInvites,
      onExpired: () => void listenInvites(true),
      onDenied: () => undefined,
      onError: () => retryInvites(),
    });
  } catch {
    retryInvites();
  }
}

/** Neu verbinden – mit wachsender Pause, falls es länger nicht klappt (z. B. Regeln noch nicht veröffentlicht) */
let inviteFails = 0;
let inviteRetry: number | undefined;
function retryInvites() {
  closeInvites?.();
  closeInvites = null;
  invitesFor = '';
  inviteFails++;
  window.clearTimeout(inviteRetry);
  inviteRetry = window.setTimeout(() => void listenInvites(), Math.min(60_000, 3000 * 2 ** Math.min(inviteFails, 5)));
}

/** Einladung wegräumen (angenommen oder „Nein danke“) */
export async function dropInvite(from: string) {
  set({ invites: state.invites.filter((i) => i.from !== from) });
  const p = activeProfile();
  if (!p) return;
  try {
    const acc = await ensureAuth(p.id);
    await dbRequest('DELETE', `invites/${acc.uid}/${from}`, acc.token!);
  } catch {
    // verfällt von selbst
  }
}

/** Spielfreund ins eigene Zimmer einladen */
export async function sendInvite(profile: Profile, friendUid: string, code: string, game: GameId) {
  const acc = await ensureAuth(profile.id);
  await dbRequest('PUT', `invites/${friendUid}/${acc.uid}`, acc.token!, {
    code,
    game,
    name: onlineName(profile.name, profile.avatar),
    avatar: profile.avatar,
    color: profile.color,
    at: SERVER_TIME,
  });
}

// ───── Start ─────

let started = false;

/** Einmal beim App-Start */
export function startPresence() {
  if (started || typeof document === 'undefined') return;
  started = true;
  const tick = () => {
    void beat();
    void listenInvites();
  };
  // Profil gewechselt, Online an/aus
  let lastProfile = activeProfile()?.id ?? '';
  let lastAllowed = onlineAllowed();
  let lastFriends = Object.keys(activeProfile()?.friends ?? {}).length;
  subscribe(() => {
    const id = activeProfile()?.id ?? '';
    const allowed = onlineAllowed();
    const friends = Object.keys(activeProfile()?.friends ?? {}).length;
    if (id === lastProfile && allowed === lastAllowed) {
      // Erster Spielfreund dazu → ab jetzt auf Einladungen hören und ihn abfragen
      if (friends !== lastFriends) {
        lastFriends = friends;
        void beat(true);
        void listenInvites();
        void poll();
      }
      return;
    }
    lastFriends = friends;
    if (me && (!allowed || me.profileId !== id)) {
      void goOffline(me);
      me = null;
    }
    lastProfile = id;
    lastAllowed = allowed;
    known = null;
    set({ friends: {} });
    tick();
    void poll();
  });
  window.clearInterval(beatTimer);
  beatTimer = window.setInterval(() => void beat(true), BEAT_MS);
  window.clearInterval(pollTimer);
  pollTimer = window.setInterval(() => void poll(), POLL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (me) void goOffline(me);
      void listenInvites();
    } else {
      void beat(true);
      void listenInvites();
      void poll();
    }
  });
  window.addEventListener('online', () => {
    void beat(true);
    void listenInvites(true);
  });
  window.setTimeout(() => {
    void beat(true);
    void listenInvites();
    void poll();
  }, 1200);
}

/** Zimmer geändert (betreten, verlassen, Runde läuft) → gleich Bescheid geben */
export function presenceChanged() {
  void beat();
  void listenInvites();
}
