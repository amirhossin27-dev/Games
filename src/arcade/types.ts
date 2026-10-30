import type { Side } from './logic';

/** Spieler, wie ihn die Arcade-Spiele aus Arta erwarten. */
export interface Player {
  name: string;
  emoji: string;
  color: string;
  cpu: boolean;
}

/** Solo: `failed` = Runde verloren (z. B. Mine erwischt) – dann zählt die Zeit nicht als Rekord. */
export type GameOutcome = { winner: Side | 'draw' } | { score: number; failed?: boolean };

/** Schnittstelle der Arcade-Spiele (übernommen aus Arta). */
export interface GameProps {
  mode: 'solo' | 'duo' | 'cpu';
  p1: Player;
  p2: Player;
  starter: Side;
  best?: number;
  onEnd: (outcome: GameOutcome) => void;
}
