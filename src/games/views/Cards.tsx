import { useState } from 'react';
import { buzz, sfx } from '../../arcade/engine';
import type { PlayProps } from '../../engine/game';
import { useGame } from '../../engine/useGame';
import { cls } from '../../lib/util';
import { Curtain, SeatStrip, Sheet, useOnChange } from '../../ui/parts';
import { cardName, isRed, mauDef, mauPlayable, mauTop, rankText, SUIT_NAME, SUIT_SYMBOL, SUITS, type Card, type MauState, type Suit } from '../rules/maumau';
import { nameOf, turnHint } from './Classic';

export function PlayingCard({ card, onClick, can, disabled }: { card: Card | null; onClick?: () => void; can?: boolean; disabled?: boolean }) {
  if (!card) return <span className="pcard back" aria-label="verdeckte Karte" role="img" />;
  const body = (
    <>
      <span className="r">{rankText(card.r)}</span>
      <span className="s">{SUIT_SYMBOL[card.s]}</span>
    </>
  );
  if (!onClick)
    return (
      <span className={cls('pcard', isRed(card.s) && 'red')} role="img" aria-label={cardName(card)}>
        {body}
      </span>
    );
  return (
    <button type="button" className={cls('pcard', isRed(card.s) && 'red', can && 'can')} onClick={onClick} disabled={disabled} aria-label={cardName(card)}>
      {body}
    </button>
  );
}

export function MauMau(props: PlayProps) {
  const { seats } = props;
  const g = useGame(mauDef, props);
  const s: MauState = g.s;
  const [wishFor, setWishFor] = useState<number | null>(null);
  const me = g.view;
  const hand = s.hands[me] ?? [];
  const top = mauTop(s);
  const myMove = g.myTurn && s.turn === me;

  useOnChange(s.pile.length, () => {
    sfx.flip();
    buzz(10);
  });
  useOnChange(s.last, (_, last) => {
    if (last?.kind === 'draw') sfx.take();
  });

  const play = (c: Card) => {
    if (!myMove || !mauPlayable(s, c)) return;
    if (c.r === 11) setWishFor(c.id);
    else g.act({ t: 'play', id: c.id });
  };

  let note = '';
  if (s.last?.kind === 'play' && s.last.card) {
    note = `${seats[s.last.by].name} legt ${cardName(s.last.card)}`;
    if (s.last.skipped !== undefined) note += ` – ${seats[s.last.skipped].name} setzt aus`;
  } else if (s.last?.kind === 'draw') note = `${seats[s.last.by].name} zieht ${s.last.got === 1 ? 'eine Karte' : `${s.last.got} Karten`}`;

  let hint = turnHint(g, seats, '');
  if (!hint && !g.outcome) {
    if (myMove) {
      if (s.penalty > 0) hint = `Leg eine 7 – oder zieh ${s.penalty} Karten`;
      else if (s.drawn !== null) hint = 'Die gezogene Karte passt! Legen oder weiter?';
      else hint = 'Leg eine passende Karte oder zieh eine';
    } else hint = `${nameOf(seats, s.turn)} ist dran`;
  }

  return (
    <div className="g-col">
      <SeatStrip seats={seats} active={g.turn} scores={s.hands.map((h) => `${h.length} Karten`)} />
      <div className="table-row">
        <button type="button" className="pcard back" disabled={!myMove || s.drawn !== null} onClick={() => g.act({ t: 'draw' })} aria-label={s.penalty ? `${s.penalty} Karten ziehen` : 'Karte ziehen'} />
        <PlayingCard card={top} />
        <div className="col" style={{ gap: 6, minWidth: 90 }}>
          {s.wish && (
            <span className="pill">
              Wunsch: <span style={{ color: isRed(s.wish) ? '#B5532E' : undefined }}>{SUIT_SYMBOL[s.wish]}</span>
            </span>
          )}
          {s.penalty > 0 && <span className="pill warn">+{s.penalty} ziehen</span>}
        </div>
      </div>
      <p className="game-hint">{note}</p>
      <div className="hand-row" aria-label="Deine Karten">
        {hand.map((c) => {
          const can = myMove && mauPlayable(s, c);
          return <PlayingCard key={c.id} card={c} can={can} disabled={!can} onClick={() => play(c)} />;
        })}
      </div>
      {myMove && s.drawn !== null && (
        <button type="button" className="btn secondary small" onClick={() => g.act({ t: 'pass' })}>
          Weiter
        </button>
      )}
      <p className="game-hint big">{s.winner !== undefined ? `Mau-Mau! ${seats[s.winner].name} gewinnt!` : hint}</p>
      {g.curtain !== null && <Curtain seat={seats[g.curtain]} note={note} onReveal={g.reveal} />}
      {wishFor !== null && (
        <Sheet title="Welche Farbe wünschst du dir?" onClose={() => setWishFor(null)}>
          <div className="wish">
            {SUITS.map((x: Suit) => (
              <button
                key={x}
                type="button"
                style={{ color: isRed(x) ? '#B5532E' : '#2D3A31' }}
                onClick={() => {
                  g.act({ t: 'play', id: wishFor, wish: x });
                  setWishFor(null);
                }}
                aria-label={SUIT_NAME[x]}
              >
                {SUIT_SYMBOL[x]}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}
