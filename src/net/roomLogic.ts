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
  /** Züge als JSON-Text: [{ n, r, a }] */
  acts?: string;
  react?: { e: ReactionId; at: number };
  /** Eigene Chat-Nachrichten als JSON-Text: [{ i, t, at }] (die letzten paar) */
  chat?: string;
}

export interface ChatMsg {
  /** laufende Nummer pro Kind */
  i: number;
  t: string;
  /** Serverzeit (geschätzt) */
  at: number;
}

export interface RoomInfo {
  host: string;
  game: GameId;
  level: Level;
  status: 'lobby' | 'playing' | 'closed';
  /** Reingelassene Kinder → Platznummer 1–3 */
  allowed?: Record<string, number>;
  denied?: Record<string, boolean>;
  /** Vom Gastgeber eingeladene Freunde: kommen ohne Klingeln rein */
  invited?: Record<string, { at: number; n: string }>;
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

export interface NetSeat extends SeatInfo {
  uid?: string;
}

export const AWAY_MS = 20_000;
export const ROBO_NAMES = ['Robo', 'Robbi', 'Roboto'];

export const isAway = (doc: SeatDoc | undefined, now: number) => !doc || now - doc.at > AWAY_MS;

/** Wer ist drin? Gastgeber zuerst, dann die reingelassenen Kinder nach Platznummer. */
export function members(info: RoomInfo, seats: Record<string, SeatDoc>): { uid: string; doc?: SeatDoc; host: boolean }[] {
  const guests = Object.entries(info.allowed ?? {})
    .filter(([uid]) => uid !== info.host)
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
export const taken = (info: RoomInfo) => 1 + Object.keys(info.allowed ?? {}).filter((u) => u !== info.host).length + (info.robos ?? 0);

export const maxPlayers = (info: RoomInfo) => GAME_BY_ID[info.game]?.players[1] ?? 4;

/** Nächste freie Platznummer (1–3) – oder `null`, wenn das Zimmer voll ist. */
export function nextSlot(info: RoomInfo): number | null {
  if (taken(info) >= maxPlayers(info)) return null;
  const used = new Set(Object.values(info.allowed ?? {}));
  for (let i = 1; i <= 3; i++) if (!used.has(i)) return i;
  return null;
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

export const INVITE_MS = 15 * 60_000;

/** Wer klingelt und darf ohne Nachfrage rein? Eingeladene und Freunde des Gastgebers. */
export function autoAdmits(info: RoomInfo, seats: Record<string, SeatDoc>, friends: Record<string, unknown>, now: number): string[] {
  return knocking(info, seats)
    .map((k) => k.uid)
    .filter((uid) => friends[uid] !== undefined || (info.invited?.[uid] && now - info.invited[uid].at < INVITE_MS));
}

/** Echte Kinder im Zimmer (ohne Robo) – Chat gibt es erst ab zwei. */
export const humanCount = (info: RoomInfo, seats: Record<string, SeatDoc>) => members(info, seats).filter((m) => m.doc).length;

export function parseChat(doc: SeatDoc | undefined): ChatMsg[] {
  if (!doc?.chat) return [];
  try {
    const list = JSON.parse(doc.chat) as ChatMsg[];
    return Array.isArray(list) ? list.filter((m) => typeof m.t === 'string' && typeof m.at === 'number') : [];
  } catch {
    return [];
  }
}

export interface FeedItem {
  key: string;
  uid: string;
  name: string;
  avatar: AvatarKind;
  color: string;
  t: string;
  at: number;
}

/** Alle Nachrichten der Kinder im Zimmer, nach Zeit sortiert (Klingelnde zählen nicht). */
export function chatFeed(info: RoomInfo, seats: Record<string, SeatDoc>): FeedItem[] {
  const out: FeedItem[] = [];
  for (const { uid, doc } of members(info, seats)) {
    if (!doc) continue;
    for (const m of parseChat(doc)) out.push({ key: `${uid}:${m.i}`, uid, name: doc.name, avatar: doc.avatar, color: doc.color, t: m.t, at: m.at });
  }
  return out.sort((a, b) => a.at - b.at || a.key.localeCompare(b.key));
}
