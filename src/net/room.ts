import { useSyncExternalStore } from 'react';
import { defFor } from '../games/defs';
import { GAME_BY_ID, type GameId } from '../games/registry';
import { chatProblem, QUICK_SENTENCES } from '../lib/chat';
import { onlineName } from '../lib/names';
import { getData, type Level, type Profile } from '../lib/store';
import { ensureAuth } from './auth';
import { isCode, randomCode } from './codes';
import { onlineAllowed } from './consent';
import { DbError, dbRequest, openStream, SERVER_TIME } from './db';
import { rememberRoom } from './recent';
import {
  admitChanges,
  autoAdmit,
  buildSeats,
  chatOf,
  chatToPrune,
  fillSeats,
  isMember,
  leftRoom,
  members,
  parseActs,
  robosFor,
  takeOver,
  type ChatMsg,
  type NetSeat,
  type ReactionId,
  type RoomInfo,
  type SeatDoc,
  type StateDoc,
} from './roomLogic';

/**
 * Online-Spielzimmer: Wer drin ist, hört live auf rooms/<Code>. Jedes Kind schreibt nur seinen
 * eigenen Platz (Name, Herzschlag, Züge), der Gastgeber das Zimmer und den Spielstand.
 * Wer nur geklingelt hat, sieht bloß die Tür (rooms/<Code>/info) und den Namen des Gastgebers.
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
  /** Chat des Zimmers, älteste Nachricht zuerst (nur für Kinder, die drin sind) */
  chat: (ChatMsg & { id: string })[];
  /** Serverzeit minus Gerätezeit (aus den Antworten auf den Herzschlag) */
  offset: number;
}

const EMPTY: RoomView = { code: null, uid: null, profileId: null, conn: 'off', error: null, info: null, seats: {}, game: null, chat: [], offset: 0 };

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

const token = async (force = false) => {
  // Nie ein Konto für „kein Kind“ anlegen (z. B. wenn ein Zug noch unterwegs ist und das Zimmer schon zu)
  if (!view.profileId) throw new Error('kein Kind im Zimmer');
  return (await ensureAuth(view.profileId, force)).token!;
};

const denied = (e: unknown) => e instanceof DbError && (e.status === 401 || e.status === 403);

const GONE = 'Dieses Zimmer gibt es nicht mehr.';

let lastChatRaw: unknown = null;

function onTree(tree: Record<string, unknown> | null) {
  if (!tree || !tree.info) {
    // Zimmer gelöscht
    set({ conn: 'online', info: null, seats: {}, game: null, chat: [], error: GONE });
    return;
  }
  const info = tree.info as RoomInfo;
  const seats = (tree.seats ?? {}) as Record<string, SeatDoc>;
  const state = tree.state as StateDoc | undefined;
  let game = view.game;
  if (!state) game = null;
  else {
    // Auch die Plätze: Ein neues Kind kann mitten in der Runde Robos Platz übernehmen.
    const raw = `${state.round}|${state.seq}|${state.st}|${state.seats}`;
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
  let chat = view.chat;
  if (tree.chat !== lastChatRaw) {
    lastChatRaw = tree.chat;
    chat = chatOf(tree.chat);
  }
  set({ conn: 'online', error: info.status === 'closed' ? 'Das Zimmer wurde geschlossen.' : null, info, seats, game, chat });
  if (info.status !== 'closed') {
    remember();
    if (info.host === view.uid) void hostChores();
  }
}

/** Zimmer in „Zuletzt im Zimmer“ merken (nur wenn sich etwas geändert hat) */
let remembered = '';
function remember() {
  const { code, info, seats, uid, profileId } = view;
  if (!code || !info || !profileId) return;
  const host = seats[info.host];
  if (!host) return;
  const key = `${profileId}|${code}|${info.game}|${info.host}|${host.name}`;
  if (key === remembered) return;
  remembered = key;
  rememberRoom(profileId, { code, game: info.game, host: { name: host.name, avatar: host.avatar, color: host.color }, mine: info.host === uid });
}

/**
 * Gastgeber: Spielfreunde und Kinder, die schon einmal drin waren, ohne Klingeln reinlassen,
 * neue Kinder in der laufenden Runde auf freie Plätze setzen – und den Chat kurz halten.
 */
let choring = false;
async function hostChores() {
  if (choring) return;
  const { info, seats, profileId, chat, game } = view;
  if (!info || !profileId) return;
  const friends = getData().profiles.find((p) => p.id === profileId)?.friends ?? {};
  const welcome = autoAdmit(info, seats, friends);
  const prune = chatToPrune(chat);
  const filled = info.status === 'playing' && game && game.round === info.round ? fillSeats(game.seats, info, seats) : null;
  if (!welcome.length && !prune.length && !filled) return;
  choring = true;
  try {
    if (welcome.length) await patchInfo(admitChanges(info, seats, welcome));
    if (filled && view.code) await dbRequest('PATCH', `rooms/${view.code}/state`, await token(), { seats: JSON.stringify(filled) });
    if (prune.length && view.code) await dbRequest('PATCH', `rooms/${view.code}/chat`, await token(), Object.fromEntries(prune.map((id) => [id, null])));
  } catch {
    // beim nächsten Stand nochmal
  } finally {
    choring = false;
  }
}

/** Vor der Tür: Wer geklingelt hat, sieht nur, ob er reindarf. */
function onDoor(info: RoomInfo | null) {
  if (!info) {
    set({ conn: 'online', info: null, seats: {}, game: null, error: GONE });
    return;
  }
  const hostDoc = view.seats[info.host];
  set({ conn: 'online', error: info.status === 'closed' ? 'Das Zimmer wurde geschlossen.' : null, info, seats: hostDoc ? { [info.host]: hostDoc } : {}, game: null });
  // Reingelassen → ab jetzt das ganze Zimmer
  if (isMember(info, view.uid)) void connect();
  else if (!hostDoc) void loadHost(info.host);
}

/** Name und Tier des Gastgebers für die Wartenden */
async function loadHost(host: string) {
  const code = view.code;
  try {
    const doc = await dbRequest<SeatDoc | null>('GET', `rooms/${code}/seats/${host}`, await token());
    if (doc && view.code === code && view.info?.host === host) set({ seats: { ...view.seats, [host]: doc } });
  } catch {
    // dann eben ohne Namen
  }
}

function closeNow() {
  closeStream?.();
  closeStream = null;
}

async function connect(force = false) {
  const code = view.code;
  if (!code) return;
  closeNow();
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
  if (view.code !== code) return;
  // Wer drin ist, hört auf das ganze Zimmer – wer nur geklingelt hat, auf die Tür.
  const full = !view.info || isMember(view.info, view.uid);
  // Lief inzwischen ein zweites connect(), steht dessen Verbindung schon – die zählt nicht mehr.
  closeNow();
  closeStream = openStream(full ? `rooms/${code}` : `rooms/${code}/info`, t, {
    onOpen: () => undefined,
    onData: (tree) => {
      if (code !== view.code) return;
      if (full) onTree(tree);
      else onDoor(tree as RoomInfo | null);
    },
    onExpired: () => void connect(true),
    onDenied: () => {
      const { info, uid } = view;
      if (full && info && uid && info.host !== uid) {
        // Nicht mehr drin (z. B. kurz gegangen und der Platz wurde frei) → wieder vor die Tür
        const { [uid]: _me, ...allowed } = info.allowed ?? {};
        set({ info: { ...info, allowed } });
        void connect();
      } else set({ error: 'Kein Zugang zu diesem Zimmer.' });
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
        // Gastgeber: Plätze von Kindern freigeben, die gegangen sind, und das Zimmer als
        // „benutzt“ markieren, damit niemand es übernimmt. Die Plätze erst prüfen, wenn das
        // Zimmer geladen ist – sonst sähe es nach dem Neustart so aus, als wären alle weg.
        const left = view.conn === 'online' ? leftRoom(info, view.seats) : [];
        if (left.length || Date.now() - hostBeat > 60_000) {
          hostBeat = Date.now();
          await dbRequest('PATCH', `rooms/${view.code}/info`, t, { ...Object.fromEntries(left.map((u) => [`allowed/${u}`, null])), at: SERVER_TIME });
        }
      } else if (info.status !== 'closed' && isMember(info, view.uid)) await maybeTakeOver(t);
    } catch {
      // nächster Versuch beim nächsten Herzschlag
    }
  };
  void beat();
  heartbeat = window.setInterval(beat, 5000);
}

/**
 * So lange darf der Gastgeber weg sein, bevor ein anderes Kind übernimmt. Die Regeln erlauben es
 * schon nach 20 Sekunden – wir warten länger, damit der Gastgeber kurz in eine andere App kann
 * (z. B. um den Code zu schicken), ohne sein Zimmer zu verlieren.
 */
const TAKEOVER_MS = 45_000;

/** Ist der Gastgeber weg, übernimmt das anwesende Kind mit der kleinsten Platznummer. */
async function maybeTakeOver(t: string) {
  const { info, seats, uid } = view;
  if (!info || !uid) return;
  const now = serverNow();
  const hostDoc = seats[info.host];
  if (hostDoc && now - hostDoc.at < TAKEOVER_MS) return;
  const present = Object.entries(info.allowed ?? {})
    .filter(([u]) => seats[u] && now - seats[u].at < 15_000)
    .sort((a, b) => a[1] - b[1]);
  if (present[0]?.[0] !== uid) return;
  await dbRequest('PATCH', `rooms/${view.code}/info`, t, { ...takeOver(info, uid), at: SERVER_TIME });
}

function stopAll() {
  closeNow();
  window.clearInterval(heartbeat);
  window.clearTimeout(retry);
  lastStateRaw = '';
  lastChatRaw = null;
  remembered = '';
  myActs = [];
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!view.code) return;
    if (document.visibilityState === 'hidden') {
      closeNow();
      window.clearInterval(heartbeat);
    } else void connect();
  });
  window.addEventListener('online', () => view.code && void connect());
}

// ───── Zimmer öffnen, beitreten, verlassen ─────

const seatDocOf = (p: Profile) => ({ name: onlineName(p.name, p.avatar), avatar: p.avatar, color: p.color, at: SERVER_TIME });

export class RoomError extends Error {}

export const ONLINE_OFF = 'Online-Spielen ist ausgeschaltet. Deine Eltern können es im Elternbereich erlauben.';

export const NO_ROOM = 'Dieses Zimmer gibt es nicht. Stimmt der Code?';

export const CLOSED = 'Dieses Zimmer ist gerade zu.';

function friendly(e: unknown): RoomError {
  if (e instanceof RoomError) return e;
  if (denied(e)) return new RoomError('Das hat nicht geklappt – kein Zugang.');
  return new RoomError('Keine Verbindung. Ist das Internet an?');
}

export async function createRoom(profile: Profile, game: GameId, level: Level): Promise<string> {
  try {
    if (!onlineAllowed()) throw new RoomError(ONLINE_OFF);
    if (view.code) await leaveRoom();
    const acc = await ensureAuth(profile.id);
    const info = { host: acc.uid, game, level, status: 'lobby', robos: 0, round: 0, at: SERVER_TIME };
    // Nachschauen, ob ein Code frei ist, geht nicht (Fremde sollen keine Zimmer finden) – also
    // einfach anlegen. Ist der Code belegt, lehnt die Datenbank ab, und wir nehmen einen anderen.
    let code: string | null = null;
    for (let i = 0; i < 5 && !code; i++) {
      const c = randomCode();
      try {
        await dbRequest('PUT', `rooms/${c}`, acc.token!, { info, seats: { [acc.uid]: seatDocOf(profile) } });
        code = c;
      } catch (e) {
        if (!denied(e)) throw e;
      }
    }
    if (!code) throw new RoomError('Das Zimmer ließ sich gerade nicht öffnen. Versuch es gleich nochmal.');
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
    if (!onlineAllowed()) throw new RoomError(ONLINE_OFF);
    if (!isCode(code)) throw new RoomError('Diesen Zimmer-Code gibt es nicht.');
    if (view.code === code && view.profileId === profile.id) return;
    if (view.code) await leaveRoom();
    const acc = await ensureAuth(profile.id);
    const t = acc.token!;
    // Erst klingeln (den eigenen Platz eintragen) – nur wer geklingelt hat, darf durch die Tür schauen.
    // Gibt es das Zimmer nicht, lehnt die Datenbank schon das ab.
    await dbRequest('PATCH', `rooms/${code}/seats/${acc.uid}`, t, seatDocOf(profile)).catch((e) => {
      throw denied(e) ? new RoomError(NO_ROOM) : e;
    });
    let info = await dbRequest<RoomInfo | null>('GET', `rooms/${code}/info`, t);
    if (info?.status === 'closed' && info.host === acc.uid) {
      // Eigenes Zimmer wieder aufmachen – mit demselben Code. Wer schon drin war, kommt gleich wieder rein.
      const reopen = { status: 'lobby', allowed: null, denied: null, at: SERVER_TIME };
      await dbRequest('PATCH', `rooms/${code}/info`, t, reopen);
      info = { ...info, status: 'lobby', allowed: undefined, denied: undefined };
    }
    // Läuft gerade eine Runde, darf man trotzdem klingeln: Wer reinkommt, übernimmt einen Robo-Platz
    // oder spielt ab der nächsten Runde mit (siehe hostChores).
    let problem: string | null = null;
    if (!info) problem = NO_ROOM;
    else if (info.status === 'closed') problem = CLOSED;
    if (problem) {
      await dbRequest('DELETE', `rooms/${code}/seats/${acc.uid}`, t).catch(() => undefined);
      throw new RoomError(problem);
    }
    set({ ...EMPTY, code, uid: acc.uid, profileId: profile.id, info, conn: 'connecting' });
    saveResume();
    void connect();
  } catch (e) {
    throw friendly(e);
  }
}

/** Nach dem Neustart der App ins letzte Zimmer zurück (wenn es noch läuft). */
export async function resumeRoom(profile: Profile) {
  const saved = readResume();
  if (!saved || saved.profileId !== profile.id || view.code || !onlineAllowed()) return;
  try {
    const acc = await ensureAuth(profile.id);
    // Kein Zugang mehr (oder ein alter, kurzer Code) heißt: Das Zimmer ist für uns vorbei.
    const info = isCode(saved.code) ? await dbRequest<RoomInfo | null>('GET', `rooms/${saved.code}/info`, acc.token!).catch((e) => (denied(e) ? null : Promise.reject(e))) : null;
    if (!info || info.status === 'closed' || !isMember(info, acc.uid)) {
      localStorage.removeItem(RESUME_KEY);
      return;
    }
    set({ ...EMPTY, code: saved.code, uid: acc.uid, profileId: profile.id, info, conn: 'connecting' });
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

/** Reinlassen – ist es sonst zu voll, macht ein Robo Platz. */
export async function admit(uid: string) {
  const info = view.info;
  if (!info) return;
  const changes = admitChanges(info, view.seats, [uid]);
  if (!Object.keys(changes).length) return;
  await patchInfo(changes);
}

export const deny = (uid: string) => patchInfo({ [`denied/${uid}`]: true });

export const setRobos = (robos: number) => patchInfo({ robos });

/** Anderes Spiel: Robos, für die kein Platz mehr ist, gehen mit. */
export function setGame(game: GameId, level: Level) {
  const info = view.info;
  const kids = info ? members(info, view.seats).length : 1;
  return patchInfo({ game, level, robos: robosFor(game, info?.robos ?? 0, kids) });
}

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
        // Den Spielstand schreibt nur der Gastgeber – wer es nicht mehr ist, hört auf.
        if (!code || view.info?.host !== view.uid) break;
        try {
          await dbRequest('PATCH', `rooms/${code}/state`, await token(), { seq: q.seq, st: JSON.stringify(q.st), ack: q.ack });
        } catch (e) {
          if (denied(e)) break;
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
  // Wer einen Platz übernommen hat, zählt nach den Zügen des Vorgängers weiter – sonst überhört der Gastgeber sie.
  const seat = view.game && view.uid ? view.game.seats.findIndex((s) => s.uid === view.uid) : -1;
  const n = Math.max(myActs[myActs.length - 1]?.n ?? 0, seat >= 0 ? (view.game?.ack[seat] ?? 0) : 0) + 1;
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

export const setLearning = (on: boolean) => patchSeat({ tut: on });

/** Spielt gerade für sich allein – die anderen sehen „spielt kurz allein“. */
export const setSolo = (on: boolean) => patchSeat({ solo: on });

// ───── Chat ─────

let lastSent = 0;

/**
 * Nachricht in den Chat schicken: entweder ein fertiger Satz (`quick` = seine Nummer) oder
 * selbst geschrieben. Gibt einen Hinweis zurück, wenn es nicht geht – sonst `null`.
 */
export async function sendChat(profile: Profile, text: string, quick?: number): Promise<string | null> {
  const { code, uid, info } = view;
  if (!code || !uid || !info || !isMember(info, uid)) return 'Du bist gerade in keinem Spielzimmer.';
  const t = quick !== undefined ? QUICK_SENTENCES[quick] : text.trim();
  if (!t) return 'Schreib erst etwas.';
  const problem = quick !== undefined ? null : chatProblem(t);
  if (problem) return problem;
  if (Date.now() - lastSent < 1500) return 'Nicht so schnell – warte kurz.';
  lastSent = Date.now();
  const id = `${Date.now().toString(36)}${uid.slice(0, 6)}${Math.random().toString(36).slice(2, 6)}`;
  const msg = { by: uid, name: onlineName(profile.name, profile.avatar), avatar: profile.avatar, color: profile.color, t, ...(quick !== undefined ? { q: quick } : {}), at: SERVER_TIME };
  try {
    await dbRequest('PUT', `rooms/${code}/chat/${id}`, await token(), msg);
    return null;
  } catch (e) {
    lastSent = 0;
    return denied(e) ? 'Das ließ sich nicht schicken.' : 'Keine Verbindung. Ist das Internet an?';
  }
}

export const gameMeta = () => (view.info ? GAME_BY_ID[view.info.game] : null);
