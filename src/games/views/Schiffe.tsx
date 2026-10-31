import { useEffect, useState, type ReactNode } from 'react';
import { buzz, sfx } from '../../arcade/engine';
import type { PlayProps } from '../../engine/game';
import { useGame } from '../../engine/useGame';
import { cls } from '../../lib/util';
import { Icon } from '../../ui/Icon';
import { Curtain, SeatStrip, useOnChange } from '../../ui/parts';
import { battleDef, coordName, isSunk, knownWater, randomFleet, SHIP_NAME, type BattleState, type Fleet } from '../rules/schiffe';
import { nameOf, turnHint } from './Classic';

const LETTERS = 'ABCDEFGHIJ';

function Sea({ size, cell, small }: { size: number; cell: (i: number) => ReactNode; small?: boolean }) {
  const items: ReactNode[] = [<span key="corner" />];
  for (let c = 0; c < size; c++)
    items.push(
      <span key={`c${c}`} className="lbl">
        {LETTERS[c]}
      </span>,
    );
  for (let r = 0; r < size; r++) {
    items.push(
      <span key={`r${r}`} className="lbl">
        {r + 1}
      </span>,
    );
    for (let c = 0; c < size; c++) items.push(cell(r * size + c));
  }
  return (
    <div className="sea" style={{ gridTemplateColumns: `18px repeat(${size}, minmax(0, 1fr))`, width: small ? 'min(70%, 240px)' : undefined }}>
      {items}
    </div>
  );
}

export function Schiffe(props: PlayProps) {
  const { seats } = props;
  const g = useGame(battleDef, props);
  const s: BattleState = g.s;
  const me = g.view;
  const opp = 1 - me;
  const [draft, setDraft] = useState<Fleet>(() => randomFleet(s.size, s.fleetLens, Math.random));

  // Neues Kind am Zug in der Aufstellung → neue Flotte vorschlagen
  useEffect(() => {
    if (s.phase === 'setup') setDraft(randomFleet(s.size, s.fleetLens, Math.random));
  }, [me, s.phase]);

  useOnChange(s.last, (_, last) => {
    if (!last) return;
    if (last.sunk) {
      sfx.win();
      buzz([60, 40, 60]);
    } else if (last.hit) {
      sfx.hit();
      buzz(40);
    } else sfx.splash();
  });

  const setupTurn = s.phase === 'setup' && g.myTurn && s.fleets[me] === null;
  if (s.phase === 'setup') {
    const ships = new Set(draft.flat());
    return (
      <div className="g-col">
        <SeatStrip seats={seats} active={g.turn} />
        <p className="game-hint big">{setupTurn ? `${seats[me].name}: Stell deine Flotte auf` : turnHint(g, seats, `${nameOf(seats, g.turn)} stellt auf …`)}</p>
        <Sea size={s.size} cell={(i) => <span key={i} className={cls('sea-cell', setupTurn && ships.has(i) && 'ship')} />} />
        {setupTurn && (
          <div className="row">
            <button type="button" className="btn secondary small" onClick={() => setDraft(randomFleet(s.size, s.fleetLens, Math.random))}>
              <Icon name="dice" /> Neu aufstellen
            </button>
            <button type="button" className="btn primary small" onClick={() => g.act({ t: 'ready', fleet: draft })}>
              Fertig
            </button>
          </div>
        )}
        <p className="small muted center">Flotte: {s.fleetLens.map((l) => `${SHIP_NAME[l]} (${l})`).join(', ')}</p>
        {g.curtain !== null && <Curtain seat={seats[g.curtain]} note="Gleich stellst du deine Flotte auf." onReveal={g.reveal} />}
      </div>
    );
  }

  const enemy = s.fleets[opp]!;
  const mineFleet = s.fleets[me]!;
  const myShots = s.shots[me];
  const theirShots = s.shots[opp];
  const water = knownWater(enemy, myShots, s.size);
  const canShoot = g.myTurn && s.turn === me;
  const sunkCount = enemy.filter((x) => isSunk(x, myShots)).length;

  let note = '';
  if (s.last) {
    const who = seats[s.last.by].name;
    note = `${who} schießt auf ${coordName(s.last.at, s.size)}: ${s.last.sunk ? `Versenkt! (${SHIP_NAME[s.last.sunk]})` : s.last.hit ? 'Treffer! Nochmal!' : 'Wasser.'}`;
  }

  return (
    <div className="g-col">
      <SeatStrip seats={seats} active={g.turn} scores={seats.map((_, p) => `${s.fleets[1 - p]!.filter((x) => isSunk(x, s.shots[p])).length}/${s.fleetLens.length}`)} />
      <p className="game-hint big">{s.winner !== undefined ? `${seats[s.winner].name} hat alle Schiffe versenkt!` : canShoot ? 'Tippe aufs Meer des anderen!' : turnHint(g, seats, `${nameOf(seats, s.turn)} zielt …`)}</p>
      <Sea
        size={s.size}
        cell={(i) => {
          const shot = myShots.includes(i);
          const ship = enemy.find((x) => x.includes(i));
          const hit = shot && !!ship;
          const sunk = hit && isSunk(ship!, myShots);
          return (
            <button
              key={i}
              type="button"
              className={cls('sea-cell', shot && !ship && 'miss', hit && 'hit', sunk && 'sunk', !shot && water.has(i) && 'water', s.last?.at === i && s.last.by === me && 'last')}
              disabled={!canShoot || shot}
              onClick={() => g.act({ t: 'shoot', at: i })}
              aria-label={`${coordName(i, s.size)}${shot ? (hit ? ', Treffer' : ', Wasser') : ''}`}
            />
          );
        }}
      />
      <p className="small muted">
        {note || `Versenkt: ${sunkCount} von ${s.fleetLens.length}`}
      </p>
      <p className="label">Deine Flotte</p>
      <Sea
        small
        size={s.size}
        cell={(i) => {
          const shot = theirShots.includes(i);
          const ship = mineFleet.some((x) => x.includes(i));
          return <span key={i} className={cls('sea-cell', ship && 'ship', shot && !ship && 'miss', shot && ship && 'hit')} />;
        }}
      />
      {g.curtain !== null && <Curtain seat={seats[g.curtain]} note={note} onReveal={g.reveal} />}
    </div>
  );
}
