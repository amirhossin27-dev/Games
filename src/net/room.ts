import { useSyncExternalStore } from 'react';
import { defFor } from '../games/defs';
import { GAME_BY_ID, type GameId } from '../games/registry';
import { getData, type Level, type Profile } from '../lib/store';
import { ensureAuth } from './auth';
import { isCode, randomCode } from './codes';
import { DbError, dbRequest, openStream, SERVER_TIME } from './db';
import { autoAdmits, buildSeats, nextSlot, parseActs, parseChat, type ChatMsg, type NetSeat, type ReactionId, type RoomInfo, type SeatDoc, type StateDoc } from './roomLogic';

/**
 * Online-Spielzimmer: Alle Geräte hören live auf rooms/<Code>. Jedes Kind schreibt nur seinen
 * eigenen Platz (Name, Herzschlag, Züge), der Gastgeber das Zimmer und den Spielstand.
 * Fällt der Gastgeber aus, übernimmt automatisch das Kind mit der kleinsten Platznummer.
 */

export interface RoomGame {
  round: number;
  seq: number;
  st: unknown;
  ack: Record<string, number>;
  seats: NetSeat[];
  game: GameId;
  level: Level;
}

export interface RoomView {
  code: string | null;
  uid: string | null;
  profileId: string | null;
  conn: 'off' | 'connecting' | 'online' | 'offline';
  error: string | null;
  info: RoomInfo | null;
  seats: Record<string, SeatDoc>;
  game: RoomGame | null;
  /** Serverzeit minus Gerätezeit (aus den Antworten auf den Herzschlag) */
  offset: number;
}

const EMPTY: RoomView = { code: null, uid: null, profileId: null, conn: 'off', error: null, info: null, seats: {}, game: null, offset: 0 };

let view: RoomView = EMPTY;
const listeners = new Set<() => void>();

function set(changes: Partial<RoomView>) {
  view = { ...view, ...changes };
  listeners.forEach((l) => l());
}

export const getRoom = () => view;

export function useRoom(): RoomView {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    getRoom,
    getRoom,
  );
}

export const serverNow = () => Date.now() + view.offset;

// ───── Wiedereinstieg nach dem Schließen der App ─────

const RESUME_KEY = 'joyboy:room:v1';

function saveResume() {
  try {
    if (view.code) localStorage.setItem(RESUME_KEY, JSON.stringify({ code: view.code, profileId: view.profileId }));
    else localStorage.removeItem(RESUME_KEY);
  } catch {
    // ignorieren
  }
}

function readResume(): { code: string; profileId: string } | null {
  try {
    return JSON.parse(localStorage.getItem(RESUME_KEY) ?? 'null');
  } catch {
    return null;
  }
}

// ───── Verbindung ─────

let closeStream: (() => void) | null = null;
let heartbeat: number | undefined;
let retry: number | undefined;
let lastStateRaw = '';
let myActs: { n: number; r: number; a: unknown }[] = [];
let myChat: ChatMsg[] | null = null;

const token = async (force = false) => {
  // Nie ein Konto für „kein Kind“ anlegen (z. B. wenn ein Zug noch unterwegs ist und das Zimmer schon zu)
  if (!view.profileId) throw new Error('kein Kind im Zimmer');
  return (await ensureAuth(view.profileId, force)).token!;
};

function onTree(tree: Record<string, unknown> | null) {
  if (!tree || !tree.info) {
    // Zimmer gelöscht
    set({ conn: 'online', info: null, seats: {}, game: null, error: 'Dieses Zimmer gibt es nicht mehr.' });
    return;
  }
  const info = tree.info as RoomInfo;
  const seats = (tree.seats ?? {}) as Record<string, SeatDoc>;
  const state = tree.state as StateDoc | undefined;
  let game = view.game;
  if (!state) game = null;
  else {
    const raw = `${state.round}|${state.seq}|${state.st}`;
    if (raw !== lastStateRaw) {
      lastStateRaw = raw;
      try {
        game = {
          round: state.round,
          seq: state.seq,
          st: JSON.parse(state.st),
          ack: state.ack ?? {},
          seats: JSON.parse(state.seats) as NetSeat[],
          game: (state.game as GameId) ?? info.game,
          level: (state.level as Level) ?? info.level,
        };
      } catch {
        // halb geschriebener Stand – auf den nächsten warten
      }
    }
  }
  set({ conn: 'online', error: info.status === 'closed' ? 'Das Zimmer wurde geschlossen.' : null, info, seats, game });
  if (info.host === view.uid && info.status !== 'closed') void admitFriends();
}

// Gastgeber: Freunde und Eingeladene kommen ohne Klingeln rein
const admitting = new Set<string>();
async function admitFriends() {
  const { info, seats, profileId } = view;
  if (!info) return;
  const friends = getData().profiles.find((p) => p.id === profileId)?.friends ?? {};
  const todo = autoAdmits(info, seats, friends, serverNow()).filter((uid) => !admitting.has(uid));
  if (!todo.length) return;
  // Plätze hier nacheinander vergeben – der neue Stand vom Server kommt erst später
  const allowed = { ...info.allowed };
  const changes: Record<string, unknown> = {};
  for (const uid of todo) {
    const slot = nextSlot({ ...info, allowed });
    if (slot === null) break;
    allowed[uid] = slot;
    changes[`allowed/${uid}`] = slot;
    changes[`denied/${uid}`] = null;
    admitting.add(uid);
    window.setTimeout(() => admitting.delete(uid), 4000);
  }
  if (Object.keys(changes).length) await patchInfo(changes).catch(() => undefined);
}

async function connect(force = false) {
  if (!view.code) return;
  closeStream?.();
  closeStream = null;
  window.clearTimeout(retry);
  if (document.visibilityState === 'hidden') return;
  set({ conn: navigator.onLine === false ? 'offline' : 'connecting' });
  let t: string;
  try {
    t = await token(force);
  } catch {
    set({ conn: 'offline' });
    retry = window.setTimeout(() => void connect(), 5000);
    return;
  }
  const code = view.code;
  closeStream = openStream(`rooms/${code}`, t, {
    onOpen: () => undefined,
    onData: (tree) => code === view.code && onTree(tree),
    onExpired: () => void connect(true),
    onDenied: () => {
      set({ error: 'Kein Zugang zu diesem Zimmer.' });
    },
    onError: () => {
      set({ conn: 'offline' });
      retry = window.setTimeout(() => void connect(), 3000 + Math.random() * 3000);
    },
  });
  startHeartbeat();
}

let hostBeat = 0;

function startHeartbeat() {
  window.clearInterval(heartbeat);
  const beat = async () => {
    if (!view.code || !view.uid) return;
    try {
      const t = await token();
      const res = await dbRequest<{ at: number }>('PATCH', `rooms/${view.code}/seats/${view.uid}`, t, { at: SERVER_TIME });
      if (res?.at) set({ offset: res.at - Date.now() });
      const info = view.info;
      if (!info) return;
      if (info.host === view.uid) {
        // Gastgeber: Zimmer als „benutzt“ markieren, damit niemand es übernimmt
        if (Date.now() - hostBeat > 60_000) {
          hostBeat = Date.now();
          await dbRequest('PATCH', `rooms/${view.code}/info`, t, { at: SERVER_TIME });
        }
      } else if (info.status !== 'closed') await maybeTakeOver(t);
    } catch {
      // nächster Versuch beim nächsten Herzschlag
    }
  };
  void beat();
  heartbeat = window.setInterval(beat, 5000);
}

/** Ist der Gastgeber weg, übernimmt das anwesende Kind mit der kleinsten Platznummer. */
async function maybeTakeOver(t: string) {
  const { info, seats, uid } = view;
  if (!info || !uid) return;
  const now = serverNow();
  const hostDoc = seats[info.host];
  if (hostDoc && now - hostDoc.at < 20_000) return;
  const present = Object.entries(info.allowed ?? {})
    .filter(([u]) => seats[u] && now - seats[u].at < 15_000)
    .sort((a, b) => a[1] - b[1]);
  if (present[0]?.[0] !== uid) return;
  await dbRequest('PATCH', `rooms/${view.code}/info`, t, { host: uid, at: SERVER_TIME });
}

function stopAll() {
  closeStream?.();
  closeStream = null;
  window.clearInterval(heartbeat);
  window.clearTimeout(retry);
  lastStateRaw = '';
  myActs = [];
  myChat = null;
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!view.code) return;
    if (document.visibilityState === 'hidden') {
      closeStream?.();
      closeStream = null;
      window.clearInterval(heartbeat);
    } else void connect();
  });
  window.addEventListener('online', () => view.code && void connect());
}

// ───── Zimmer öffnen, beitreten, verlassen ─────

const seatDocOf = (p: Profile) => ({ name: p.name, avatar: p.avatar, color: p.color, at: SERVER_TIME });

export class RoomError extends Error {}

function friendly(e: unknown): RoomError {
  if (e instanceof RoomError) return e;
  if (e instanceof DbError && (e.status === 401 || e.status === 403)) return new RoomError('Das hat nicht geklappt – kein Zugang.');
  return new RoomError('Keine Verbindung. Ist das Internet an?');
}

export async function createRoom(profile: Profile, game: GameId, level: Level): Promise<string> {
  try {
    if (view.code) await leaveRoom();
    const acc = await ensureAuth(profile.id);
    let code: string | null = null;
    for (let i = 0; i < 8 && !code; i++) {
      const c = randomCode();
      const info = await dbRequest<RoomInfo | null>('GET', `rooms/${c}/info`, acc.token!);
      if (!info || info.at < Date.now() - 2 * 3600_000) code = c;
    }
    if (!code) throw new RoomError('Gerade ist kein Zimmer frei. Versuch es gleich nochmal.');
    const info = { host: acc.uid, game, level, status: 'lobby', robos: 0, round: 0, at: SERVER_TIME };
    await dbRequest('PUT', `rooms/${code}`, acc.token!, { info, seats: { [acc.uid]: seatDocOf(profile) } });
    set({ ...EMPTY, code, uid: acc.uid, profileId: profile.id, conn: 'connecting' });
    saveResume();
    void connect();
    return code;
  } catch (e) {
    throw friendly(e);
  }
}

export async function joinRoom(profile: Profile, code: string) {
  try {
    if (!isCode(code)) throw new RoomError('Diesen Zimmer-Code gibt es nicht.');
    if (view.code === code && view.profileId === profile.id) return;
    if (view.code) await leaveRoom();
    const acc = await ensureAuth(profile.id);
    const info = await dbRequest<RoomInfo | null>('GET', `rooms/${code}/info`, acc.token!);
    if (!info || info.status === 'closed') throw new RoomError('Dieses Zimmer gibt es nicht. Stimmt der Code?');
    const member = info.host === acc.uid || info.allowed?.[acc.uid] !== undefined;
    if (info.status === 'playing' && !member) throw new RoomError('Dort wird gerade gespielt. Probier es nach der Runde nochmal.');
    await dbRequest('PUT', `rooms/${code}/seats/${acc.uid}`, acc.token!, seatDocOf(profile));
    set({ ...EMPTY, code, uid: acc.uid, profileId: profile.id, conn: 'connecting' });
    saveResume();
    void connect();
  } catch (e) {
    throw friendly(e);
  }
}

/** Nach dem Neustart der App ins letzte Zimmer zurück (wenn es noch läuft). */
export async function resumeRoom(profile: Profile) {
  const saved = readResume();
  if (!saved || saved.profileId !== profile.id || view.code) return;
  try {
    const acc = await ensureAuth(profile.id);
    const info = await dbRequest<RoomInfo | null>('GET', `rooms/${saved.code}/info`, acc.token!);
    const member = info && (info.host === acc.uid || info.allowed?.[acc.uid] !== undefined);
    if (!info || info.status === 'closed' || !member) {
      localStorage.removeItem(RESUME_KEY);
      return;
    }
    set({ ...EMPTY, code: saved.code, uid: acc.uid, profileId: profile.id, conn: 'connecting' });
    void connect();
  } catch {
    // offline – beim nächsten Start wieder versuchen
  }
}

export async function leaveRoom() {
  const { code, uid, info, profileId } = view;
  stopAll();
  set(EMPTY);
  saveResume();
  if (!code || !uid || !profileId) return;
  try {
    // Konto des Kindes von vorhin – `view` ist hier schon leer
    const t = (await ensureAuth(profileId).catch(() => null))?.token;
    if (!t) return;
    if (info?.host === uid) await dbRequest('PATCH', `rooms/${code}/info`, t, { status: 'closed', at: SERVER_TIME });
    else await dbRequest('DELETE', `rooms/${code}/seats/${uid}`, t);
  } catch {
    // offline – der alte Eintrag verfällt von selbst
  }
}

/** Nur lokal aufräumen (z. B. wenn das Zimmer geschlossen wurde) */
export function forgetRoom() {
  stopAll();
  const profileId = view.profileId;
  set({ ...EMPTY, profileId });
  saveResume();
}

// ───── Gastgeber ─────

async function patchInfo(changes: Record<string, unknown>) {
  if (!view.code) return;
  await dbRequest('PATCH', `rooms/${view.code}/info`, await token(), { ...changes, at: SERVER_TIME });
}

export async function admit(uid: string) {
  const info = view.info;
  if (!info) return;
  const slot = nextSlot(info);
  if (slot === null) return;
  await patchInfo({ [`allowed/${uid}`]: slot, [`denied/${uid}`]: null });
}

export const deny = (uid: string) => patchInfo({ [`denied/${uid}`]: true });

/** Freund einladen: Er sieht die Einladung in seiner App und kommt ohne Klingeln rein. */
export function inviteFriend(uid: string) {
  const name = view.uid ? (view.seats[view.uid]?.name ?? '') : '';
  return patchInfo({ [`invited/${uid}`]: { at: SERVER_TIME, n: name.slice(0, 16) }, [`denied/${uid}`]: null });
}

export const setRobos = (robos: number) => patchInfo({ robos });

export const setGame = (game: GameId, level: Level) => patchInfo({ game, level });

export async function startRound(round: number) {
  const { info, seats, code } = view;
  if (!info || !code) return;
  const players = buildSeats(info, seats);
  const def = defFor(info.game, players.map((p) => p.robo));
  if (!def) return;
  const st = def.init({ n: players.length, starter: round % players.length, level: info.level, humans: players.filter((p) => !p.robo).length, shared: false, rnd: Math.random });
  const t = await token();
  await dbRequest('PUT', `rooms/${code}/state`, t, { seq: 0, round, st: JSON.stringify(st), ack: {}, seats: JSON.stringify(players), game: info.game, level: info.level });
  await patchInfo({ status: 'playing', round });
}

export const startGame = () => startRound((view.info?.round ?? 0) + (view.game ? 1 : 0));

export const backToLobby = () => patchInfo({ status: 'lobby' });

// Stände der Reihe nach schreiben – bei vielen schnellen Zügen zählt nur der neueste.
let publishing = false;
interface Pub {
  seq: number;
  st: unknown;
  ack: Record<string, number>;
}
let queued: Pub | null = null;

export function publishState(seq: number, st: unknown, ack: Record<string, number>) {
  queued = { seq, st, ack };
  if (publishing) return;
  publishing = true;
  void (async () => {
    try {
      while (queued) {
        const q: Pub = queued;
        queued = null;
        const code = view.code;
        if (!code) break;
        try {
          await dbRequest('PATCH', `rooms/${code}/state`, await token(), { seq: q.seq, st: JSON.stringify(q.st), ack: q.ack });
        } catch {
          // Verbindung weg: den Stand beim nächsten Zug erneut schicken
          if (!queued) queued = q;
          await new Promise((r) => window.setTimeout(r, 1500));
          if (!view.code) break;
        }
      }
    } finally {
      publishing = false;
    }
  })();
}

// ───── Alle Kinder ─────

let pushing: Promise<unknown> = Promise.resolve();

/** Eigenen Zug an den Gastgeber schicken */
export function pushAct(a: unknown) {
  const round = view.game?.round ?? 0;
  myActs = myActs.filter((x) => x.r === round);
  if (!myActs.length) myActs = parseActs(view.uid ? view.seats[view.uid] : undefined, round).map((x) => ({ ...x, r: round }));
  const n = (myActs[myActs.length - 1]?.n ?? 0) + 1;
  myActs = [...myActs.slice(-15), { n, r: round, a }];
  const body = JSON.stringify(myActs);
  const code = view.code;
  const uid = view.uid;
  pushing = pushing.then(async () => {
    if (!code || !uid) return;
    for (let i = 0; i < 3; i++) {
      try {
        await dbRequest('PATCH', `rooms/${code}/seats/${uid}`, await token(), { acts: body });
        return;
      } catch {
        await new Promise((r) => window.setTimeout(r, 1000 * (i + 1)));
      }
    }
  });
}

async function patchSeat(changes: Record<string, unknown>) {
  if (!view.code || !view.uid) return;
  await dbRequest('PATCH', `rooms/${view.code}/seats/${view.uid}`, await token(), changes).catch(() => undefined);
}

export const react = (e: ReactionId) => patchSeat({ react: { e, at: SERVER_TIME } });

/** Chat-Nachricht senden (die letzten 12 eigenen bleiben im eigenen Platz) */
export async function sendChat(text: string) {
  if (!view.uid) return;
  myChat ??= parseChat(view.seats[view.uid]);
  const i = (myChat[myChat.length - 1]?.i ?? 0) + 1;
  myChat = [...myChat.slice(-11), { i, t: text, at: serverNow() }];
  const mine = { ...view.seats[view.uid], chat: JSON.stringify(myChat) };
  // Sofort selbst sehen, nicht erst nach der Antwort vom Server
  set({ seats: { ...view.seats, [view.uid]: mine } });
  await patchSeat({ chat: mine.chat });
}

export const setLearning = (on: boolean) => patchSeat({ tut: on });

export const gameMeta = () => (view.info ? GAME_BY_ID[view.info.game] : null);
