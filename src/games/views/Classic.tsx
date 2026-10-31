import type { CSSProperties } from 'react';
import { buzz, sfx } from '../../arcade/engine';
import { SEAT_COLORS, type PlayProps, type SeatInfo } from '../../engine/game';
import { useGame, type GameHandle } from '../../engine/useGame';
import { cls } from '../../lib/util';
import { SeatStrip, useOnChange } from '../../ui/parts';
import { c4Def, c4LandingRow, c4Winner, C4_COLS, C4_ROWS, memoryDef, tttDef, tttResult, type MemoryState } from '../rules/classic';

/** Hinweiszeile für alle rundenbasierten Spiele */
export function turnHint(g: GameHandle<unknown, unknown>, seats: SeatInfo[], mine: string) {
  if (g.outcome) return '';
  if (g.thinking && typeof g.turn === 'number') return `${seats[g.turn].name} überlegt …`;
  return mine;
}

export const nameOf = (seats: SeatInfo[], seat: number | 'all' | null) => (typeof seat === 'number' ? seats[seat]?.name ?? '' : '');

// ───── Paare finden ─────

export function Memory(props: PlayProps) {
  const { seats } = props;
  const g = useGame(memoryDef, props);
  const s: MemoryState = g.s;
  const cols = s.deck.length <= 16 ? 4 : s.deck.length <= 20 ? 5 : 6;
  const scores = seats.map((_, p) => s.owner.filter((o) => o === p).length / 2);

  useOnChange(s.open.length, (a, b) => {
    if (b > a) sfx.flip();
  });
  useOnChange(s.owner.filter((o) => o !== null).length, () => {
    sfx.match();
    buzz(20);
  });

  const solo = seats.length === 1;
  return (
    <div className="g-col">
      {!solo && <SeatStrip seats={seats} active={g.turn} scores={scores} />}
      {solo && <p className="label">Züge: {s.moves}</p>}
      <div className="mem-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {s.deck.map((pic, i) => {
          const open = s.open.includes(i);
          const owner = s.owner[i];
          return (
            <button
              key={i}
              type="button"
              className={cls('mem-card', open && 'open', owner !== null && 'won')}
              style={owner !== null ? ({ '--owner': SEAT_COLORS[owner] } as CSSProperties) : undefined}
              disabled={!g.myTurn || open || owner !== null || s.open.length === 2}
              onClick={() => g.act({ t: 'flip', i })}
              aria-label={open || owner !== null ? pic : `Karte ${i + 1}, verdeckt`}
            >
              {(open || owner !== null) && pic}
            </button>
          );
        })}
      </div>
      <p className="game-hint">{turnHint(g, seats, solo ? 'Finde alle Paare!' : `${nameOf(seats, g.turn)} ist dran`)}</p>
    </div>
  );
}

// ───── Vier gewinnt ─────

export function ConnectFour(props: PlayProps) {
  const { seats } = props;
  const g = useGame(c4Def, props);
  const { board, last } = g.s;
  const win = c4Winner(board);
  useOnChange(last, () => {
    sfx.tap();
    buzz(12);
  });
  return (
    <div className="g-col">
      <SeatStrip seats={seats} active={g.turn} />
      <div className="c4-board">
        {Array.from({ length: C4_COLS }, (_, col) => (
          <button key={col} type="button" className="c4-col" disabled={!g.myTurn || c4LandingRow(board, col) < 0} onClick={() => g.act(col)} aria-label={`Spalte ${col + 1}`}>
            {Array.from({ length: C4_ROWS }, (_, row) => {
              const i = row * C4_COLS + col;
              const c = board[i];
              return <span key={row} className={cls('c4-cell', win?.cells.includes(i) && 'win', i === last && 'last')} style={c !== null ? { background: SEAT_COLORS[c] } : undefined} />;
            })}
          </button>
        ))}
      </div>
      <p className="game-hint">
        {win ? `${seats[win.winner].name} gewinnt!` : g.outcome ? 'Unentschieden!' : turnHint(g, seats, `${nameOf(seats, g.turn)} ist dran – tippe auf eine Spalte`)}
      </p>
    </div>
  );
}

// ───── Tic-Tac-Toe ─────

const MARK = ['✕', '◯'];

export function TicTacToe(props: PlayProps) {
  const { seats } = props;
  const g = useGame(tttDef, props);
  const { board } = g.s;
  const result = tttResult(board);
  useOnChange(board, () => {
    sfx.tap();
    buzz(10);
  });
  return (
    <div className="g-col">
      <SeatStrip seats={seats} active={g.turn} scores={[`${MARK[0]}`, `${MARK[1]}`]} />
      <div className="ttt-board">
        {board.map((c, i) => (
          <button key={i} type="button" className={cls('ttt-cell', result?.line?.includes(i) && 'win')} disabled={c !== null || !g.myTurn} onClick={() => g.act(i)} aria-label={c !== null ? `${seats[c].name}` : `Feld ${i + 1}`}>
            {c !== null && <span style={{ color: SEAT_COLORS[c] }}>{MARK[c]}</span>}
          </button>
        ))}
      </div>
      <p className="game-hint">
        {result ? (result.winner === 'draw' ? 'Unentschieden!' : `${seats[result.winner].name} gewinnt!`) : turnHint(g, seats, `${nameOf(seats, g.turn)} ist dran`)}
      </p>
    </div>
  );
}
