import type { SeatInfo } from '../engine/game';
import { GAME_BY_ID, type GameId } from '../games/registry';
import type { AvatarKind } from '../lib/names';
import type { Level } from '../lib/store';

/** Reine Logik der Spielzimmer – ohne Netz, damit sie sich testen lässt. */

export type ReactionId = 'thumb' | 'smile' | 'wow' | 'party' | 'star';

export interface SeatDoc {
  name: string;
  avatar: AvatarKind;
  color: string;
  /** Herzschlag (Serverzeit) */
  at: number;
  /** Schaut gerade die Spielregeln an */
  tut?: boolean;
  /** Spielt gerade ein Spiel für sich allein (außerhalb des Zimmers) */
  solo?: boolean;
  /** Züge als JSON-Text: [{ n, r, a }] */
  acts?: string;
  react?: { e: ReactionId; at: number };
}

export interface RoomInfo {
  host: string;
  game: GameId;
  level: Level;
  status: 'lobby' | 'playing' | 'closed';
  /** Reingelassene Kinder → Platznummer 1–3 */
  allowed?: Record<string, number>;
  denied?: Record<string, boolean>;
  /** Kinder, die schon einmal drin waren – sie kommen beim Wiederkommen ohne Klingeln rein */
  known?: Record<string, boolean>;
  robos?: number;
  round?: number;
  at: number;
}

export interface StateDoc {
  seq: number;
  round: number;
  /** Spielstand als JSON-Text */
  st: string;
  ack?: Record<string, number>;
  /** Plätze der Runde als JSON-Text */
  seats: string;
  game?: string;
  level?: number;
}

/** Nachricht im Chat des Spielzimmers (rooms/<Code>/chat/<id>) */
export interface ChatMsg {
  /** Konto des Kindes */
  by: string;
  name: string;
  avatar: AvatarKind;
  color: string;
  t: string;
  /** Nummer des fertigen Satzes (lib/chat.ts), sonst selbst geschrieben */
  q?: number;
  at: number;
}

export interface NetSeat extends SeatInfo {
  uid?: string;
}

export const AWAY_MS = 20_000;
export const ROBO_NAMES = ['Robo', 'Robbi', 'Roboto'];

export const isAway = (doc: SeatDoc | undefined, now: number) => !doc || now - doc.at > AWAY_MS;

/** Gastgeber oder reingelassen? Nur wer drin ist, darf das ganze Zimmer sehen (database.rules.json). */
export const isMember = (info: RoomInfo, uid: string | null | undefined) => !!uid && (info.host === uid || info.allowed?.[uid] !== undefined);

/** Reingelassene Kinder, die noch da sind – wer das Zimmer verlässt, löscht seinen Platz. */
const guestsIn = (info: RoomInfo, seats: Record<string, SeatDoc>) => Object.entries(info.allowed ?? {}).filter(([uid]) => uid !== info.host && seats[uid]);

/** Reingelassene Kinder, die gegangen sind: Der Gastgeber gibt ihre Plätze wieder frei. */
export const leftRoom = (info: RoomInfo, seats: Record<string, SeatDoc>) => Object.keys(info.allowed ?? {}).filter((uid) => uid !== info.host && !seats[uid]);

/** Wer ist drin? Gastgeber zuerst, dann die reingelassenen Kinder nach Platznummer. */
export function members(info: RoomInfo, seats: Record<string, SeatDoc>): { uid: string; doc?: SeatDoc; host: boolean }[] {
  const guests = guestsIn(info, seats)
    .sort((a, b) => a[1] - b[1])
    .map(([uid]) => ({ uid, doc: seats[uid], host: false }));
  return [{ uid: info.host, doc: seats[info.host], host: true }, ...guests];
}

/** Wer klingelt gerade (noch nicht reingelassen und nicht abgelehnt)? */
export function knocking(info: RoomInfo, seats: Record<string, SeatDoc>): { uid: string; doc: SeatDoc }[] {
  return Object.entries(seats)
    .filter(([uid]) => uid !== info.host && info.allowed?.[uid] === undefined && !info.denied?.[uid])
    .map(([uid, doc]) => ({ uid, doc }));
}

/** Wie viele Plätze sind belegt (Kinder + Robo)? */
export const taken = (info: RoomInfo, seats: Record<string, SeatDoc>) => 1 + guestsIn(info, seats).length + (info.robos ?? 0);

export const maxPlayers = (info: RoomInfo) => GAME_BY_ID[info.game]?.players[1] ?? 4;

/** Nächste freie Platznummer (1–3) – oder `null`, wenn das Zimmer voll ist. */
export function nextSlot(info: RoomInfo, seats: Record<string, SeatDoc>): number | null {
  if (taken(info, seats) >= maxPlayers(info)) return null;
  const used = new Set(guestsIn(info, seats).map(([, slot]) => slot));
  for (let i = 1; i <= 3; i++) if (!used.has(i)) return i;
  return null;
}

/**
 * Der Gastgeber ist weg, `uid` übernimmt. Der bisherige Gastgeber bekommt dessen Platznummer –
 * so bleibt er Mitspieler und kann zurückkommen, statt vor der eigenen Tür zu stehen.
 */
export function takeOver(info: RoomInfo, uid: string): Record<string, unknown> {
  return { host: uid, [`allowed/${uid}`]: null, [`allowed/${info.host}`]: info.allowed?.[uid] ?? 1, [`denied/${info.host}`]: null };
}

/** Robos fürs neue Spiel: nicht mehr, als neben den Kindern Platz haben (und keine, wenn es keinen Robo gibt). */
export function robosFor(game: GameId, robos: number, kids: number): number {
  const meta = GAME_BY_ID[game];
  return meta?.robo ? Math.max(0, Math.min(robos, meta.players[1] - kids)) : 0;
}

/** Plätze für eine neue Runde: Gastgeber, reingelassene Kinder, dann Robos. */
export function buildSeats(info: RoomInfo, seats: Record<string, SeatDoc>): NetSeat[] {
  const kids: NetSeat[] = members(info, seats)
    .filter((m) => m.doc)
    .map((m) => ({ uid: m.uid, name: m.doc!.name, avatar: m.doc!.avatar, color: m.doc!.color, robo: false }));
  const room = Math.max(0, Math.min(info.robos ?? 0, maxPlayers(info) - kids.length));
  const robos: NetSeat[] = Array.from({ length: room }, (_, k) => ({ name: ROBO_NAMES[k % 3], avatar: 'robo', color: '#E6E6DF', robo: true }));
  return [...kids, ...robos];
}

/** Züge eines Kindes für eine Runde */
export function parseActs(doc: SeatDoc | undefined, round: number): { n: number; a: unknown }[] {
  if (!doc?.acts) return [];
  try {
    const list = JSON.parse(doc.acts) as { n: number; r: number; a: unknown }[];
    return list.filter((x) => x.r === round).map(({ n, a }) => ({ n, a }));
  } catch {
    return [];
  }
}

/** Alle Züge der Gäste einer Runde, mit Platznummer – für den Gastgeber. */
export function guestActs(players: NetSeat[], seats: Record<string, SeatDoc>, hostUid: string, round: number) {
  const out: { seat: number; n: number; a: unknown }[] = [];
  players.forEach((p, i) => {
    if (!p.uid || p.uid === hostUid) return;
    for (const x of parseActs(seats[p.uid], round)) out.push({ seat: i, ...x });
  });
  return out;
}

/** Plätze, deren Gerät gerade weg ist (für sie springt Robo ein). */
export function absentSeats(players: NetSeat[], seats: Record<string, SeatDoc>, now: number, me: number): number[] {
  return players.map((p, i) => (i !== me && p.uid && isAway(seats[p.uid], now) ? i : -1)).filter((i) => i >= 0);
}

/** Chat-Nachrichten, älteste zuerst */
export function chatOf(raw: unknown): (ChatMsg & { id: string })[] {
  if (!raw || typeof raw !== 'object') return [];
  return Object.entries(raw as Record<string, ChatMsg>)
    .filter(([, m]) => m && typeof m.t === 'string' && typeof m.at === 'number')
    .map(([id, m]) => ({ ...m, id }))
    .sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
}

export const CHAT_KEEP = 30;

/** Alte Nachrichten, die der Gastgeber wegräumt (erst ab ein paar zu viel, damit nicht jede Nachricht ein Aufräumen auslöst). */
export function chatToPrune(list: { id: string }[], keep = CHAT_KEEP): string[] {
  return list.length > keep + 10 ? list.slice(0, list.length - keep).map((m) => m.id) : [];
}

/**
 * Wer klingelt und ohne Fragen reindarf: Kinder, die schon einmal in diesem Zimmer waren, und
 * Spielfreunde des Gastgebers – solange Platz ist. Alle anderen müssen weiter klingeln.
 */
export function autoAdmit(info: RoomInfo, seats: Record<string, SeatDoc>, friends: Record<string, unknown>): string[] {
  const free = maxPlayers(info) - taken(info, seats);
  if (free <= 0) return [];
  return knocking(info, seats)
    .filter(({ uid }) => info.known?.[uid] || friends[uid])
    .map(({ uid }) => uid)
    .slice(0, free);
}

/** Platznummern für mehrere Kinder auf einmal (jedes bekommt einen anderen freien Platz). */
export function slotsFor(info: RoomInfo, seats: Record<string, SeatDoc>, uids: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  let cur = info;
  for (const uid of uids) {
    const slot = nextSlot(cur, seats);
    if (slot === null) break;
    out[uid] = slot;
    cur = { ...cur, allowed: { ...cur.allowed, [uid]: slot } };
  }
  return out;
}
