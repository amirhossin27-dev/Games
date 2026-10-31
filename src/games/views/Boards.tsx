import { useState, type CSSProperties } from 'react';
import { buzz, sfx } from '../../arcade/engine';
import { SEAT_COLORS, type PlayProps } from '../../engine/game';
import { useGame } from '../../engine/useGame';
import { cls } from '../../lib/util';
import { SeatStrip, useOnChange } from '../../ui/parts';
import { dameCount, dameDef, dameMustJump, dameResult, dameSteps, isDark, isKing, dameSeat, type DameState } from '../rules/dame';
import { inMill, millDef, millFlying, millMoves, millRemovable, millResult, millStones, MILL_XY, type MillState } from '../rules/muehle';
import { nameOf, turnHint } from './Classic';

const pct = (v: number) => `${((v + 0.5) / 7) * 100}%`;
const stonesText = (n: number) => (n === 1 ? '1 Stein' : `${n} Steine`);

// ───── Mühle ─────

export function Muehle(props: PlayProps) {
  const { seats } = props;
  const g = useGame(millDef, props);
  const s: MillState = g.s;
  const [sel, setSel] = useState<number | null>(null);
  const result = millResult(s);
  const who = s.turn;
  const opp = 1 - who;
  const placing = s.hand[who] > 0;
  const moves = g.myTurn && !s.remove ? millMoves(s, who) : [];
  const removable = g.myTurn && s.remove ? millRemovable(s.board, who) : [];
  const movable = new Set(moves.flatMap((m) => (m.t === 'move' ? [m.from] : [])));
  const targets = new Set(moves.flatMap((m) => (m.t === 'place' || (m.t === 'move' && m.from === sel) ? [m.to] : [])));

  useOnChange(s.last, () => {
    sfx.tap();
    buzz(10);
    setSel(null);
  });
  useOnChange(s.remove, (_, now) => {
    if (now) sfx.match();
  });
  useOnChange(s.taken, (_, now) => {
    if (now !== null) {
      sfx.flip();
      buzz(30);
    }
  });

  const tap = (i: number) => {
    if (!g.myTurn) return;
    if (s.remove) {
      if (removable.includes(i)) g.act({ t: 'remove', at: i });
      return;
    }
    if (placing) {
      if (s.board[i] === null) g.act({ t: 'place', to: i });
      return;
    }
    if (movable.has(i)) setSel(i === sel ? null : i);
    else if (sel !== null && targets.has(i)) g.act({ t: 'move', from: sel, to: i });
  };

  let hint: string;
  if (result) hint = result.winner === 'draw' ? 'Unentschieden!' : `${seats[result.winner].name} gewinnt!`;
  else if (s.remove) hint = turnHint(g, seats, `Mühle! Tippe auf einen Stein von ${seats[opp].name} und nimm ihn weg.`);
  else if (placing) hint = turnHint(g, seats, `${nameOf(seats, who)}: Setz einen Stein auf einen freien Punkt (noch ${s.hand[who]}).`);
  else if (sel !== null) hint = 'Wohin? Tippe auf einen leuchtenden Punkt.';
  else if (millFlying(s, who)) hint = turnHint(g, seats, `${nameOf(seats, who)} hat nur noch 3 Steine und darf springen!`);
  else hint = turnHint(g, seats, `${nameOf(seats, who)}: Tippe auf einen deiner Steine und dann auf ein Nachbarfeld.`);

  const scores = [0, 1].map((p) => (s.hand[p] > 0 ? `noch ${s.hand[p]} zu setzen` : stonesText(millStones(s, p))));

  return (
    <div className="g-col">
      <SeatStrip seats={seats} active={g.turn} scores={scores} />
      <div className="mill-board">
        <svg viewBox="-0.5 -0.5 7 7" aria-hidden="true">
          <rect x="0" y="0" width="6" height="6" />
          <rect x="1" y="1" width="4" height="4" />
          <rect x="2" y="2" width="2" height="2" />
          <path d="M3 0 V2 M3 4 V6 M0 3 H2 M4 3 H6" />
        </svg>
        {MILL_XY.map(([x, y], i) => {
          const c = s.board[i];
          const isTarget = targets.has(i) && (placing || sel !== null);
          const canRemove = removable.includes(i);
          return (
            <button
              key={i}
              type="button"
              className={cls(
                'mill-point',
                c !== null && 'stone',
                isTarget && 'target',
                canRemove && 'removable',
                sel === i && 'sel',
                movable.has(i) && sel === null && 'movable',
                c !== null && inMill(s.board, i) && 'mill',
                s.last?.to === i && 'last',
              )}
              style={{ left: pct(x), top: pct(y), ...(c !== null ? ({ '--stone': SEAT_COLORS[c] } as CSSProperties) : {}) }}
              disabled={!g.myTurn || !(isTarget || canRemove || movable.has(i) || (placing && c === null))}
              onClick={() => tap(i)}
              aria-label={c !== null ? `Stein von ${seats[c].name}` : `Punkt ${i + 1}, frei`}
            />
          );
        })}
      </div>
      <p className="game-hint">{hint}</p>
    </div>
  );
}

// ───── Dame ─────

export function Dame(props: PlayProps) {
  const { seats } = props;
  const g = useGame(dameDef, props);
  const s: DameState = g.s;
  const [pickd, setPickd] = useState<number | null>(null);
  const result = dameResult(s);
  const steps = g.myTurn ? dameSteps(s) : [];
  const mustJump = g.myTurn && dameMustJump(s);
  const sel = s.chain ?? pickd;
  const movable = new Set(steps.map((x) => x.from));
  const targets = new Set(steps.filter((x) => x.from === sel).map((x) => x.to));
  const lastCells = new Set(s.last.flatMap((x) => [x.from, x.to]));
  // Online sieht Platz 1 das Brett von seiner Seite
  const flip = !!props.net && g.view === 1;
  const order = Array.from({ length: s.size * s.size }, (_, k) => (flip ? s.size * s.size - 1 - k : k));

  useOnChange(s.last, (_, now) => {
    setPickd(null);
    if (now.some((x) => x.cap !== null)) {
      sfx.match();
      buzz(30);
    } else {
      sfx.tap();
      buzz(10);
    }
  });

  const tap = (i: number) => {
    if (!g.myTurn) return;
    if (sel !== null && targets.has(i)) {
      g.act({ from: sel, to: i });
      setPickd(null);
    } else if (s.chain === null && movable.has(i)) setPickd(i === pickd ? null : i);
  };

  let hint: string;
  if (result) hint = result.winner === 'draw' ? 'Unentschieden!' : `${seats[result.winner].name} gewinnt!`;
  else if (s.chain !== null && g.myTurn) hint = 'Spring weiter! Es geht noch ein Sprung.';
  else if (mustJump && sel === null) hint = 'Schlagen ist Pflicht! Tippe auf einen leuchtenden Stein.';
  else if (sel !== null && g.myTurn) hint = 'Wohin? Tippe auf ein leuchtendes Feld.';
  else hint = turnHint(g, seats, `${nameOf(seats, s.turn)} ist dran – tippe auf einen Stein und dann auf das Ziel.`);

  return (
    <div className="g-col">
      <SeatStrip seats={seats} active={g.turn} scores={[0, 1].map((p) => stonesText(dameCount(s.board, p)))} />
      <div className="dame-board" style={{ gridTemplateColumns: `repeat(${s.size}, minmax(0, 1fr))` }}>
        {order.map((i) => {
          if (!isDark(s.size, i)) return <span key={i} className="dame-sq light" />;
          const p = s.board[i];
          const isTarget = targets.has(i);
          return (
            <button
              key={i}
              type="button"
              className={cls('dame-sq', isTarget && 'target', lastCells.has(i) && 'last')}
              disabled={!g.myTurn || !(isTarget || (s.chain === null && movable.has(i)))}
              onClick={() => tap(i)}
              aria-label={p !== null ? `${isKing(p) ? 'Dame' : 'Stein'} von ${seats[dameSeat(p)].name}` : isTarget ? 'Ziel' : 'freies Feld'}
            >
              {p !== null && (
                <span
                  className={cls('dame-piece', isKing(p) && 'king', sel === i && 'sel', mustJump && movable.has(i) && sel === null && 'must', !mustJump && movable.has(i) && sel === null && 'can')}
                  style={{ background: SEAT_COLORS[dameSeat(p)] }}
                >
                  {isKing(p) && '♛'}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="game-hint">{hint}</p>
    </div>
  );
}
