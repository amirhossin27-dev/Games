import { useState, type CSSProperties, type ReactNode } from 'react';
import { buzz, sfx } from '../../arcade/engine';
import { SEAT_COLORS, type PlayProps } from '../../engine/game';
import { useGame } from '../../engine/useGame';
import { cls } from '../../lib/util';
import { Die, SeatStrip, useOnChange } from '../../ui/parts';
import { LUDO_GOAL, LUDO_HOME, LUDO_START, LUDO_TRACK, ludoCell, ludoDef, ludoMoves, type LudoState } from '../rules/ludo';
import { nameOf, turnHint } from './Classic';

const key = (x: number, y: number) => `${x},${y}`;
const SPARE = '#EFE6D4';

export function Ludo(props: PlayProps) {
  const { seats } = props;
  const g = useGame(ludoDef, props);
  const s: LudoState = g.s;
  const [rolling, setRolling] = useState(false);
  const cornerSeat = [0, 1, 2, 3].map((c) => s.corner.indexOf(c));
  const colorOfCorner = (c: number) => (cornerSeat[c] >= 0 ? SEAT_COLORS[cornerSeat[c]] : SPARE);

  useOnChange(s.rolls, () => {
    setRolling(true);
    window.setTimeout(() => setRolling(false), 400);
    sfx.dice();
  });
  useOnChange(s.last?.note, (_, note) => {
    if (note === 'Rausgeworfen!') {
      sfx.miss();
      buzz([40, 40, 40]);
    } else if (note === 'Im Ziel!') sfx.match();
  });

  // Welche Felder gibt es, und welche Figur steht wo?
  const cells = new Map<string, { kind: 'track' | 'home' | 'goal'; color?: string; start?: boolean }>();
  LUDO_TRACK.forEach(([x, y], i) => {
    const startCorner = LUDO_START.indexOf(i);
    cells.set(key(x, y), { kind: 'track', color: startCorner >= 0 ? colorOfCorner(startCorner) : undefined, start: startCorner >= 0 });
  });
  LUDO_HOME.forEach((list, c) => list.forEach(([x, y]) => cells.set(key(x, y), { kind: 'home', color: colorOfCorner(c) })));
  LUDO_GOAL.forEach((list, c) => list.forEach(([x, y]) => cells.set(key(x, y), { kind: 'goal', color: colorOfCorner(c) })));

  const movable = s.phase === 'move' && s.roll !== null && g.myTurn ? ludoMoves(s, s.turn, s.roll) : [];
  const pieces = new Map<string, { seat: number; i: number }>();
  s.pos.forEach((list, seat) => list.forEach((rel, i) => pieces.set(key(...ludoCell(s, seat, rel, i)), { seat, i })));

  const grid: ReactNode[] = [];
  for (let y = 0; y < 11; y++)
    for (let x = 0; x < 11; x++) {
      const k = key(x, y);
      const cell = cells.get(k);
      if (!cell) {
        grid.push(<span key={k} />);
        continue;
      }
      const piece = pieces.get(k);
      const can = piece && piece.seat === s.turn && movable.includes(piece.i);
      grid.push(
        <button
          key={k}
          type="button"
          className={cls('ludo-cell', cell.kind, cell.start && 'start')}
          style={{ '--cell': cell.color } as CSSProperties}
          disabled={!can}
          onClick={() => can && g.act({ t: 'move', i: piece!.i })}
          aria-label={piece ? `Figur von ${seats[piece.seat].name}${can ? ', ziehen' : ''}` : 'Feld'}
        >
          {piece && <span className={cls('ludo-piece', can && 'can')} style={{ '--pc': SEAT_COLORS[piece.seat] } as CSSProperties} />}
        </button>,
      );
    }

  const inGoal = s.pos.map((p) => p.filter((x) => x >= 40).length);
  const canRoll = g.myTurn && s.phase === 'roll';
  let hint = turnHint(g, seats, '');
  if (!hint && !g.outcome) {
    if (canRoll) hint = `${nameOf(seats, s.turn)}: Tippe auf den Würfel!`;
    else if (s.phase === 'move' && g.myTurn) hint = 'Tippe auf eine leuchtende Figur';
  }

  return (
    <div className="g-col">
      <SeatStrip seats={seats} active={g.turn} scores={inGoal.map((n) => `${n}/4`)} />
      <div className="ludo-board">{grid}</div>
      <div className="row" style={{ justifyContent: 'center', gap: 16 }}>
        <Die value={s.roll ?? s.last?.roll ?? 6} rolling={rolling} onClick={canRoll ? () => g.act({ t: 'roll' }) : undefined} label={canRoll ? 'Würfeln' : `Würfel zeigt ${s.roll ?? s.last?.roll ?? 6}`} />
        <p className="game-hint big" style={{ maxWidth: 220 }}>
          {s.last?.note ?? hint}
        </p>
      </div>
      {s.last?.note && hint && <p className="game-hint">{hint}</p>}
    </div>
  );
}
