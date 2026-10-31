import type { GameDef } from '../../engine/game';
import type { Level } from '../../lib/store';
import { shuffle, type Rnd } from '../../lib/util';

/**
 * Mau-Mau mit 32 Karten (7 bis Ass) für 2–4 Kinder (nach Arta, erweitert).
 * Gleiche Farbe oder gleicher Wert passt. 7: der Nächste zieht 2 (mit einer 7 weitergeben, dann 4 …),
 * 8: der Nächste setzt aus, Bube: passt immer und man wünscht sich eine Farbe.
 */

/** H ist in Joyboy die rote Stern-Farbe (statt Herz), das Kürzel bleibt für laufende Spiele gleich. */
export type Suit = 'C' | 'S' | 'H' | 'D';
export const SUITS: Suit[] = ['C', 'S', 'H', 'D'];
export const SUIT_SYMBOL: Record<Suit, string> = { C: '♣', S: '♠', H: '★', D: '♦' };
export const SUIT_NAME: Record<Suit, string> = { C: 'Kreuz', S: 'Pik', H: 'Stern', D: 'Karo' };
export const isRed = (s: Suit) => s === 'H' || s === 'D';

export interface Card {
  id: number;
  s: Suit;
  r: number;
}

export const MAU_HAND = 5;
export const MAU_RANKS = [7, 8, 9, 10, 11, 12, 13, 1];
const RANK_NAME: Record<number, string> = { 1: 'Ass', 11: 'Bube', 12: 'Dame', 13: 'König' };
const RANK_SHORT: Record<number, string> = { 1: 'A', 11: 'B', 12: 'D', 13: 'K' };

export const rankText = (r: number) => RANK_SHORT[r] ?? String(r);
export const cardName = (c: Card) => `${SUIT_NAME[c.s]} ${RANK_NAME[c.r] ?? c.r}`;

export function mauDeck(): Card[] {
  let id = 0;
  return SUITS.flatMap((s) => MAU_RANKS.map((r) => ({ id: id++, s, r })));
}

export interface MauState {
  n: number;
  draw: Card[];
  pile: Card[];
  hands: Card[][];
  turn: number;
  /** Gewünschte Farbe nach einem Buben */
  wish: Suit | null;
  /** Offene Strafkarten durch Siebenen */
  penalty: number;
  /** Gerade gezogene Karte, die noch gelegt werden darf */
  drawn: number | null;
  last: { by: number; kind: 'play' | 'draw' | 'pass'; card?: Card; got?: number; skipped?: number } | null;
  winner?: number;
}

export type MauAction = { t: 'play'; id: number; wish?: Suit } | { t: 'draw' } | { t: 'pass' };

export const mauTop = (s: MauState) => s.pile[s.pile.length - 1];

export function mauPlayable(s: MauState, c: Card): boolean {
  if (s.drawn !== null && c.id !== s.drawn) return false;
  if (s.penalty > 0) return c.r === 7;
  if (c.r === 11) return true;
  const top = mauTop(s);
  if (s.wish) return c.s === s.wish;
  return c.s === top.s || c.r === top.r;
}

const after = (s: MauState, seat: number, steps = 1) => (seat + steps) % s.n;

function take(s: MauState, seat: number, n: number, rnd: Rnd): { s: MauState; got: Card[] } {
  let draw = s.draw;
  let pile = s.pile;
  const got: Card[] = [];
  for (let k = 0; k < n; k++) {
    if (!draw.length && pile.length > 1) {
      draw = shuffle(pile.slice(0, -1), rnd);
      pile = pile.slice(-1);
    }
    const card = draw[draw.length - 1];
    if (!card) break;
    draw = draw.slice(0, -1);
    got.push(card);
  }
  const hands = s.hands.map((h, i) => (i === seat ? [...h, ...got] : h));
  return { s: { ...s, draw, pile, hands }, got };
}

export function mauBestSuit(hand: Card[], rnd: Rnd = Math.random): Suit {
  const count = (x: Suit) => hand.filter((c) => c.s === x && c.r !== 11).length;
  const max = Math.max(...SUITS.map(count));
  const best = SUITS.filter((x) => count(x) === max);
  return best[Math.floor(rnd() * best.length)];
}

export const mauDef: GameDef<MauState, MauAction> = {
  init({ n, starter, rnd }) {
    const deck = shuffle(mauDeck(), rnd);
    const hands = Array.from({ length: n }, () => deck.splice(0, MAU_HAND));
    const first = deck.findIndex((c) => c.r !== 7 && c.r !== 8 && c.r !== 11);
    const [top] = deck.splice(first, 1);
    return { n, draw: deck, pile: [top], hands, turn: starter % n, wish: null, penalty: 0, drawn: null, last: null };
  },
  turn: (s) => (s.winner !== undefined ? null : s.turn),
  apply(s, a, by, rnd) {
    if (s.winner !== undefined || by !== s.turn) return null;
    const next1 = after(s, by);
    if (a.t === 'draw') {
      if (s.drawn !== null) return null;
      if (s.penalty > 0) {
        const { s: nx, got } = take(s, by, s.penalty, rnd);
        return { ...nx, penalty: 0, turn: next1, last: { by, kind: 'draw', got: got.length } };
      }
      const { s: nx, got } = take(s, by, 1, rnd);
      const card = got[0];
      const last = { by, kind: 'draw' as const, got: got.length };
      if (card && mauPlayable({ ...nx, drawn: card.id }, card)) return { ...nx, drawn: card.id, last };
      return { ...nx, drawn: null, turn: next1, last };
    }
    if (a.t === 'pass') {
      if (s.drawn === null) return null;
      return { ...s, drawn: null, turn: next1, last: { by, kind: 'pass' } };
    }
    const card = s.hands[by].find((c) => c.id === a.id);
    if (!card || !mauPlayable(s, card)) return null;
    if (card.r === 11 && (!a.wish || !SUITS.includes(a.wish))) return null;
    const hands = s.hands.map((h, i) => (i === by ? h.filter((c) => c.id !== card.id) : h));
    const skip = card.r === 8;
    const nx: MauState = {
      ...s,
      hands,
      pile: [...s.pile, card],
      wish: card.r === 11 ? a.wish! : null,
      penalty: card.r === 7 ? s.penalty + 2 : 0,
      drawn: null,
      last: { by, kind: 'play', card, skipped: skip ? next1 : undefined },
    };
    if (!hands[by].length) return { ...nx, winner: by };
    return { ...nx, turn: skip ? after(s, by, 2) : next1 };
  },
  outcome(s) {
    if (s.winner === undefined) return null;
    // Platz nach Anzahl der übrigen Karten
    const left = s.hands.map((h) => h.length);
    return { places: left.map((x) => 1 + left.filter((o) => o < x).length), scores: left };
  },
  robo(s, seat, level, rnd) {
    if (s.winner !== undefined || s.turn !== seat) return null;
    const hand = s.hands[seat];
    const playable = hand.filter((c) => mauPlayable(s, c));
    if (!playable.length) return s.drawn !== null ? { t: 'pass' } : { t: 'draw' };
    const nextCards = s.hands[after(s, seat)].length;
    const sloppy = [4, 1.5, 0][level as Level];
    const score = (c: Card) => {
      let v = c.r === 11 ? -8 : 2;
      if (c.r === 7) v += nextCards <= 2 ? 9 : 3;
      if (c.r === 8) v += 4;
      v += hand.filter((h) => h.s === c.s).length * 0.9;
      if (hand.length === 1) v += 20;
      return v + rnd() * sloppy * 3;
    };
    const card = playable.map((c) => ({ c, v: score(c) })).reduce((x, y) => (y.v > x.v ? y : x)).c;
    return card.r === 11 ? { t: 'play', id: card.id, wish: mauBestSuit(hand.filter((c) => c.id !== card.id), rnd) } : { t: 'play', id: card.id };
  },
  roboDelay: () => 900 + Math.random() * 400,
  viewer: (s) => (s.winner !== undefined ? null : s.turn),
  endDelay: 1400,
};
