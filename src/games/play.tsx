import type { ComponentType } from 'react';
import { Ballz } from '../arcade/Ballz';
import { Breakout } from '../arcade/Breakout';
import { Flappy } from '../arcade/Flappy';
import { Game2048 } from '../arcade/Game2048';
import { Hopper } from '../arcade/Hopper';
import { Invaders } from '../arcade/Invaders';
import { Minesweeper } from '../arcade/Minesweeper';
import { Muncher } from '../arcade/Muncher';
import { Pong } from '../arcade/Pong';
import { Reaction } from '../arcade/Reaction';
import { Runner } from '../arcade/Runner';
import { Simon } from '../arcade/Simon';
import { Snake } from '../arcade/Snake';
import { Solitaire } from '../arcade/Solitaire';
import { Tetris } from '../arcade/Tetris';
import type { GameOutcome, GameProps as ArcadeProps, Player } from '../arcade/types';
import type { Outcome, PlayProps, SeatInfo } from '../engine/game';
import { animalInfo } from '../lib/names';
import type { GameId } from './registry';
import { Memory, ConnectFour, TicTacToe } from './views/Classic';
import { Dame, Muehle } from './views/Boards';
import { MauMau } from './views/Cards';
import { Ludo } from './views/Ludo';
import { Quiz } from './views/Quiz';
import { Schiffe } from './views/Schiffe';
import { Slf } from './views/Slf';
import { Wuerfel } from './views/Wuerfel';

const ARCADE: Partial<Record<GameId, ComponentType<ArcadeProps>>> = {
  schlange: Snake,
  kloetzchen: Tetris,
  g2048: Game2048,
  flappy: Flappy,
  huepfer: Hopper,
  mampfer: Muncher,
  breakout: Breakout,
  tempel: Runner,
  weltraum: Invaders,
  ballblitz: Ballz,
  tonecho: Simon,
  minen: Minesweeper,
  solitaer: Solitaire,
  pong: Pong,
  blitz: Reaction,
};

const toPlayer = (s: SeatInfo, color: string): Player => ({ name: s.name, emoji: animalInfo(s.avatar).emoji, color, cpu: s.robo });

/** Arta-Ergebnis → Joyboy-Ergebnis */
function convert(o: GameOutcome): Outcome {
  if ('score' in o) return { places: [1], solo: { score: o.score, failed: o.failed } };
  if (o.winner === 'draw') return { places: [1, 1] };
  return { places: o.winner === 'p1' ? [1, 2] : [2, 1] };
}

export function GameView({ id, props }: { id: GameId; props: PlayProps }) {
  switch (id) {
    case 'rechnen':
    case 'buchstaben':
    case 'uhr':
    case 'welt':
    case 'woerter':
    case 'englisch':
      return <Quiz {...props} subject={id} />;
    case 'paare':
      return <Memory {...props} />;
    case 'vier':
      return <ConnectFour {...props} />;
    case 'ttt':
      return <TicTacToe {...props} />;
    case 'ludo':
      return <Ludo {...props} />;
    case 'maumau':
      return <MauMau {...props} />;
    case 'wuerfel':
      return <Wuerfel {...props} />;
    case 'schiffe':
      return <Schiffe {...props} />;
    case 'muehle':
      return <Muehle {...props} />;
    case 'dame':
      return <Dame {...props} />;
    case 'slf':
      return <Slf {...props} />;
  }
  const Arcade = ARCADE[id]!;
  const [a, b] = props.seats;
  const p1 = toPlayer(a, '#D9774F');
  const p2 = b ? toPlayer(b, '#6FA8D6') : { ...p1, cpu: true };
  const mode = !b ? 'solo' : b.robo ? 'cpu' : 'duo';
  return <Arcade mode={mode} p1={p1} p2={p2} starter={props.starter === 1 ? 'p2' : 'p1'} best={props.best} onEnd={(o) => props.onEnd(convert(o))} />;
}
