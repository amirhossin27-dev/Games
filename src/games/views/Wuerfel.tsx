import { useEffect, useState } from 'react';
import { buzz, sfx, tone } from '../../arcade/engine';
import type { PlayProps } from '../../engine/game';
import { useGame } from '../../engine/useGame';
import { cls } from '../../lib/util';
import { Die, SeatStrip, useOnChange } from '../../ui/parts';
import { bonusOf, catScore, KCAT_HINT, KCAT_LABEL, total, upperSum, BONUS_AT, wuerfelDef, type WuerfelState } from '../rules/wuerfel';
import { nameOf, turnHint } from './Classic';

export function Wuerfel(props: PlayProps) {
  const { seats } = props;
  const g = useGame(wuerfelDef, props);
  const s: WuerfelState = g.s;
  const [hold, setHold] = useState<boolean[]>([false, false, false, false, false]);
  const [rolling, setRolling] = useState(false);
  const myMove = g.myTurn && typeof g.turn === 'number';

  // Neuer Zug: nichts mehr gehalten
  useEffect(() => {
    if (s.rolls === 0) setHold([false, false, false, false, false]);
  }, [s.turn, s.rolls]);
  useOnChange(s.dice, () => {
    setRolling(true);
    window.setTimeout(() => setRolling(false), 400);
    tone(480, 50, 'triangle', 0.05);
    buzz(15);
  });
  useOnChange(s.last, (_, last) => {
    if (last && last.pts >= 25) sfx.match();
    else if (last) sfx.tap();
  });

  const shown = myMove ? hold : s.held;
  const solo = seats.length === 1;

  let hint = turnHint(g, seats, '');
  if (!hint && !g.outcome) {
    if (!myMove) hint = `${nameOf(seats, s.turn)} ist dran`;
    else if (s.rolls === 0) hint = `${nameOf(seats, s.turn)}: Würfeln!`;
    else if (s.rolls < 3) hint = 'Würfel antippen zum Halten – oder unten ein Feld wählen';
    else hint = 'Wähle ein Feld für dein Ergebnis';
  }

  return (
    <div className="g-col">
      {!solo && <SeatStrip seats={seats} active={g.turn} scores={s.sheets.map((sh) => total(sh, s.cats))} />}
      <div className="dice-row">
        {s.dice.map((d, i) => (
          <Die
            key={i}
            value={d}
            held={s.rolls > 0 && shown[i]}
            rolling={rolling && !shown[i]}
            onClick={myMove && s.rolls > 0 && s.rolls < 3 ? () => setHold((h) => h.map((x, k) => (k === i ? !x : x))) : undefined}
            label={`Würfel ${d}${shown[i] ? ', gehalten' : ''}`}
          />
        ))}
      </div>
      <button type="button" className="btn primary" disabled={!myMove || s.rolls >= 3} onClick={() => g.act({ t: 'roll', hold })}>
        Würfeln ({s.rolls}/3)
      </button>
      <p className="game-hint">{hint}</p>
      <table className="sheet-table">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Feld</th>
            {seats.map((p, i) => (
              <th key={i} style={{ textAlign: 'center' }}>
                {solo ? 'Punkte' : p.name.split(' ').pop()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {s.cats.map((cat, k) => (
            <tr key={cat} style={k === 6 ? { borderTop: '4px solid transparent' } : undefined}>
              <td>
                <span style={{ display: 'block', lineHeight: 1.1 }}>{KCAT_LABEL[cat]}</span>
                <span className="small muted" style={{ fontWeight: 400 }}>
                  {KCAT_HINT[cat]}
                </span>
              </td>
              {seats.map((_, p) => {
                const val = s.sheets[p][cat];
                const pickable = myMove && p === s.turn && s.rolls > 0 && val === undefined;
                return (
                  <td key={p} className={cls('num', p === s.turn && 'me')}>
                    {pickable ? (
                      <button type="button" className="pick" onClick={() => g.act({ t: 'score', cat })} aria-label={`${KCAT_LABEL[cat]}: ${catScore(cat, s.dice)} Punkte eintragen`}>
                        {catScore(cat, s.dice)}
                      </button>
                    ) : (
                      (val ?? '·')
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="sum">
            <td>Bonus (ab {BONUS_AT} oben)</td>
            {s.sheets.map((sh, p) => (
              <td key={p} className="num">
                {bonusOf(sh) || `${upperSum(sh)}`}
              </td>
            ))}
          </tr>
          <tr className="sum">
            <td>Gesamt</td>
            {s.sheets.map((sh, p) => (
              <td key={p} className="num">
                {total(sh, s.cats)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
