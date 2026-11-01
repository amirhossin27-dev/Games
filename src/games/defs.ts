import type { GameDef } from '../engine/game';
import { quizDef } from '../learn/quiz';
import { traceDef } from '../learn/trace/game';
import { GAMES, type GameId } from './registry';
import { c4Def, memoryDef, tttDef } from './rules/classic';
import { ludoDef } from './rules/ludo';
import { mauDef } from './rules/maumau';
import { battleDef } from './rules/schiffe';
import { slfDef } from './rules/slf';
import { wuerfelDef } from './rules/wuerfel';

const QUIZ = {
  rechnen: quizDef('rechnen'),
  buchstaben: quizDef('buchstaben'),
  uhr: quizDef('uhr'),
  welt: quizDef('welt'),
  woerter: quizDef('woerter'),
  englisch: quizDef('englisch'),
};
const TRACE = { zahlenspur: traceDef('zahlen'), schwung: traceDef('schwung') };

/** Regel-Funktionen eines Spiels – damit legt der Gastgeber im Spielzimmer die Runde an. */
export function defFor(id: GameId, robos: boolean[]): GameDef<unknown, unknown> | null {
  const any = <S, A>(d: GameDef<S, A>) => d as unknown as GameDef<unknown, unknown>;
  switch (id) {
    case 'rechnen':
    case 'buchstaben':
    case 'uhr':
    case 'welt':
    case 'woerter':
    case 'englisch':
      return any(QUIZ[id]);
    case 'zahlenspur':
    case 'schwung':
      return any(TRACE[id]);
    case 'paare':
      return any(memoryDef);
    case 'vier':
      return any(c4Def);
    case 'ttt':
      return any(tttDef);
    case 'ludo':
      return any(ludoDef);
    case 'maumau':
      return any(mauDef);
    case 'wuerfel':
      return any(wuerfelDef);
    case 'schiffe':
      return any(battleDef);
    case 'slf':
      return any(slfDef(robos));
    default:
      return null;
  }
}

/** Diese Spiele gibt es im Online-Spielzimmer (Regel-Spiele für mehrere). */
export const ONLINE_GAMES = GAMES.filter((g) => (g.kind === 'def' || g.id === 'joykart') && g.players[1] > 1);
export const isOnlineGame = (id: GameId) => ONLINE_GAMES.some((g) => g.id === id);
