import type { AvatarKind } from '../lib/names';
import type { Level } from '../lib/store';
import type { Rnd } from '../lib/util';

/**
 * Ein Spiel als reine Funktionen – wie in Arta, aber für 1–4 Plätze (0–3) statt zwei Seiten.
 * Daraus macht `useGame` automatisch „Allein“, „Gegen Robo“ und „Zusammen an einem Gerät“;
 * die Online-Spielzimmer nutzen später dieselben Funktionen (der Gastgeber rechnet).
 */

export interface SeatInfo {
  name: string;
  avatar: AvatarKind;
  /** Hintergrund des Avatars */
  color: string;
  robo: boolean;
  /** Profil auf diesem Gerät (für Sterne und Rekorde); Gäste haben keins. */
  profileId?: string;
}

export interface InitCtx {
  /** Anzahl Plätze */
  n: number;
  /** Wer beginnt */
  starter: number;
  level: Level;
  /** Wie viele echte Kinder spielen mit (der Rest ist Robo)? */
  humans: number;
  rnd: Rnd;
}

export interface Outcome {
  /** Platz je Sitz (1 = gewonnen, Gleichstand teilt sich den Platz) */
  places: number[];
  /** Punkte je Sitz, falls das Spiel welche zählt */
  scores?: number[];
  /** Solo-Wertung für Rekorde */
  solo?: { score: number; failed?: boolean };
  /** Richtige Antworten je Sitz (Lernspiele) und wie viele Fragen jeder hatte */
  correct?: number[];
  asked?: number[];
}

export interface GameDef<S, A> {
  init(ctx: InitCtx): S;
  /** Wer ist dran: ein Platz, alle gleichzeitig ('all') oder niemand (`null`, z. B. Auswertung). */
  turn(s: S): number | 'all' | null;
  /** Neuer Stand oder `null`, wenn der Zug nicht erlaubt ist. */
  apply(s: S, a: A, by: number, rnd: Rnd): S | null;
  outcome(s: S): Outcome | null;
  /** Zug von Robo auf Platz `seat`, `null` = Robo hat gerade nichts zu tun. */
  robo?(s: S, seat: number, level: Level, rnd: Rnd): A | null;
  roboDelay?(s: S, seat: number): number;
  /**
   * Robo-Züge mit gleichem Schlüssel laufen weiter, auch wenn andere inzwischen ziehen
   * (wichtig, wenn alle gleichzeitig antworten). Standard: jede Änderung plant neu.
   */
  phaseKey?(s: S): string;
  /** Automatische Schritte, z. B. Memory-Karten wieder umdrehen. */
  auto?(s: S): { action: A; by: number; delay: number } | null;
  /** Spiele mit Geheimnissen: wessen Augen gerade aufs Display dürfen (Sichtschutz an einem Gerät). */
  viewer?(s: S): number | null;
  endDelay?: number;
}

export interface PlayProps {
  seats: SeatInfo[];
  level: Level;
  starter: number;
  /** Bisheriger Rekord (Solo) */
  best?: number;
  onEnd(o: Outcome): void;
}

/** Feste Spielfarben je Platz – gut unterscheidbar, auch für Farbenschwache (dazu kommen Avatare). */
export const SEAT_COLORS = ['#D9774F', '#2F6E9E', '#417A4D', '#C79A1E'];
export const SEAT_COLOR_NAMES = ['Rot', 'Blau', 'Grün', 'Gelb'];

export const nextSeat = (seat: number, n: number) => (seat + 1) % n;
