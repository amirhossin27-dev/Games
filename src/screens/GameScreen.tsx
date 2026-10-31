import { useEffect, useRef, useState, type ReactNode } from 'react';
import { setSoundStyle, sfx, unlockAudio, useTouchLock } from '../arcade/engine';
import type { NetLink, Outcome } from '../engine/game';
import { GameView } from '../games/play';
import { GAME_BY_ID, type GameMeta } from '../games/registry';
import { nav, type Session } from '../lib/nav';
import { levelOf, recordResults, starsForPlace, starsForRatio, starsForScore, type PlayResult, type RecordOutcome } from '../lib/progress';
import { actions, useData, type Profile, type Settings } from '../lib/store';
import { speakIfAuto, stopSpeaking } from '../lib/speech';
import { arcadeAfter, isLearnGame, learnedToday, learnText } from '../lib/unlock';
import { cls } from '../lib/util';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import { Joy } from '../ui/Joy';
import { Confetti, Stars } from '../ui/parts';
import { TimePill } from '../ui/TimePill';

interface Result {
  outcome: Outcome;
  stars: number[];
  records: Record<string, RecordOutcome>;
}

/** Sterne je Platz am Ende einer Runde */
function starsFor(meta: GameMeta, o: Outcome, n: number, best: number | undefined): number[] {
  const allTied = n > 1 && o.places.every((p) => p === 1);
  return Array.from({ length: n }, (_, i) => {
    if (meta.subject && o.correct && o.asked) return starsForRatio(o.correct[i] / Math.max(1, o.asked[i]));
    if (n === 1 && o.solo) return starsForScore(o.solo.score, best, !!meta.lowerIsBetter, o.solo.failed);
    return starsForPlace(o.places[i], allTied);
  });
}

/** Steuerung im Online-Spielzimmer */
export interface OnlineControls {
  host: boolean;
  hostName: string;
  again(): void;
  lobby(): void;
  leave(): void;
  /** Chat des Zimmers öffnen */
  chat?(): void;
  /** Kinder, die gerade dazugekommen sind und in der nächsten Runde mitspielen */
  next?: string[];
  /** Gastgeber: Wer klingelt (und wer wartet) – im Spiel unten, am Ende im Ergebnis */
  bar?(atEnd: boolean): ReactNode;
}

export function GameScreen({ session, net, online }: { session: Session; net?: NetLink; online?: OnlineControls }) {
  const meta = GAME_BY_ID[session.game];
  const data = useData();
  const ref = useRef<HTMLDivElement>(null);
  useTouchLock(ref);
  // Arcade und Duelle piepen im 8-Bit-Stil, Lern- und Brettspiele klingen weich (Xylofon, Holz, Glöckchen).
  useEffect(() => {
    setSoundStyle(meta.kind === 'def' ? 'soft' : 'retro');
    return () => setSoundStyle('soft');
  }, [meta.kind]);
  const [result, setResult] = useState<Result | null>(null);
  const first = session.seats[0];
  const firstProfile = data.profiles.find((p) => p.id === first.profileId);
  // Der Rekord vor dieser Runde (damit „Neuer Rekord!“ stimmt)
  const best = useRef(firstProfile?.games[meta.id]?.best);

  const onEnd = (o: Outcome) => {
    const n = session.seats.length;
    const stars = starsFor(meta, o, n, best.current);
    const humans = session.seats.filter((s) => !s.robo).length;
    const allTied = n > 1 && o.places.every((p) => p === 1);
    const results: PlayResult[] = [];
    session.seats.forEach((s, i) => {
      if (!s.profileId) return;
      results.push({
        profileId: s.profileId,
        game: meta.id,
        stars: stars[i],
        won: n > 1 && o.places[i] === 1 && !allTied,
        together: humans > 1,
        logic: !!meta.logic,
        score: n === 1 && o.solo && !o.solo.failed ? o.solo.score : undefined,
        lowerIsBetter: meta.lowerIsBetter,
        correct: o.correct?.[i],
        subject: meta.subject,
        learn: isLearnGame(meta),
      });
    });
    const records = recordResults(results);
    const winnerHuman = session.seats.some((s, i) => !s.robo && o.places[i] === 1);
    if (winnerHuman || n === 1) sfx.win();
    else sfx.lose();
    setResult({ outcome: o, stars, records });
  };

  // Neue Runde (auch wenn der Gastgeber online „Nochmal“ tippt)
  useEffect(() => {
    best.current = data.profiles.find((p) => p.id === first.profileId)?.games[meta.id]?.best;
    setResult(null);
  }, [session.round]);

  const again = () => {
    if (online) online.again();
    else nav.again();
  };

  const close = () => {
    stopSpeaking();
    if (!online) return nav.closeGame();
    if (online.host ? window.confirm('Runde für alle beenden und zurück ins Spielzimmer?') : window.confirm('Spielzimmer verlassen? Robo spielt dann für dich weiter.')) {
      if (online.host) online.lobby();
      else online.leave();
    }
  };

  return (
    <div ref={ref} className={cls('game-screen', meta.kind !== 'def' && 'dark')} onPointerDown={unlockAudio}>
      <header className="g-head">
        <button type="button" className="icon-btn" onClick={close} aria-label="Spiel beenden">
          <Icon name="close" />
        </button>
        <div className="g-title">
          <h1>{meta.name}</h1>
          <TimePill className="sm" />
        </div>
        <button type="button" className="icon-btn" onClick={() => nav.tutorial(meta.id)} aria-label="Spielregeln ansehen">
          <Icon name="help" />
        </button>
        {online?.chat && (
          <button type="button" className="icon-btn" onClick={online.chat} aria-label="Chat">
            <Icon name="chat" />
          </button>
        )}
        <button type="button" className="icon-btn" onClick={() => actions.settings({ sound: !data.settings.sound })} aria-label={data.settings.sound ? 'Ton aus' : 'Ton an'}>
          <Icon name={data.settings.sound ? 'speaker' : 'mute'} />
        </button>
      </header>
      <div className={cls('g-stage', meta.kind !== 'def' && 'fixed')}>
        <GameView
          key={session.round}
          id={meta.id}
          props={{ seats: session.seats, level: session.level, starter: session.round % session.seats.length, best: best.current, onEnd, net }}
        />
      </div>
      {!result && online?.bar?.(false)}
      {result && (
        <ResultCard
          session={session}
          meta={meta}
          result={result}
          profiles={data.profiles}
          settings={data.settings}
          onAgain={again}
          onClose={online ? (online.host ? online.lobby : online.leave) : close}
          best={best.current}
          online={online}
        />
      )}
    </div>
  );
}

function ResultCard({
  session,
  meta,
  result,
  profiles,
  settings,
  onAgain,
  onClose,
  best,
  online,
}: {
  session: Session;
  meta: GameMeta;
  result: Result;
  profiles: Profile[];
  settings: Settings;
  onAgain: () => void;
  onClose: () => void;
  best?: number;
  online?: OnlineControls;
}) {
  const { outcome, stars } = result;
  const seats = session.seats;
  const n = seats.length;
  const solo = n === 1;
  const order = seats.map((_, i) => i).sort((a, b) => outcome.places[a] - outcome.places[b]);
  const winners = order.filter((i) => outcome.places[i] === 1);
  const allTied = !solo && winners.length === n;
  const humanWon = winners.some((i) => !seats[i].robo);
  const me = seats[0].profileId ? result.records[seats[0].profileId] : undefined;
  const meProfile = profiles.find((p) => p.id === seats[0].profileId);

  let title: string;
  if (solo) title = me?.newRecord ? 'Neuer Rekord!' : 'Super gespielt!';
  else if (allTied) title = 'Unentschieden!';
  else if (winners.length === 1) title = seats[winners[0]].robo ? `${seats[winners[0]].name} gewinnt diesmal!` : `${seats[winners[0]].name} gewinnt!`;
  else title = 'Gleichstand vorne!';

  const scoreText = (i: number) => {
    if (outcome.correct && outcome.asked) return `${outcome.correct[i]} von ${outcome.asked[i]} richtig`;
    if (outcome.scores) return `${outcome.scores[i]} ${meta.id === 'maumau' ? 'Karten übrig' : meta.id === 'paare' ? 'Paare' : 'Punkte'}`;
    return '';
  };

  const sayRef = useRef(false);
  if (!sayRef.current) {
    sayRef.current = true;
    window.setTimeout(() => speakIfAuto(title), 200);
  }

  // Erst lernen, dann spielen: zeigen, wie weit es bis zu den Arcade-Spielen ist
  const need = arcadeAfter(settings);
  const unlockNote = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    if (!need || !p || !isLearnGame(meta)) return null;
    const done = learnedToday(p);
    if (done === need) return <b>Arcade-Spiele freigeschaltet!</b>;
    if (done < need) return `Arcade-Spiele: ${learnText(need - done)}`;
    return null;
  };

  const heights = [96, 72, 54, 40];
  const blockColor = ['#F2C94C', '#DCE9F3', '#F6E1D8', '#EFE6D4'];

  return (
    <div className="result-backdrop">
      {(humanWon || solo) && <Confetti />}
      <div className="result" role="dialog" aria-label="Ergebnis">
        <div className="row">
          <Joy size={56} mood={humanWon || solo ? 'cheer' : 'happy'} />
          <div className="grow">
            <h2>{title}</h2>
            <p className="muted small">{meta.name}</p>
          </div>
        </div>

        {solo ? (
          <div className="card center col" style={{ alignItems: 'center' }}>
            <span className="display" style={{ fontSize: '2.4rem', lineHeight: 1 }}>
              {outcome.correct ? `${outcome.correct[0]} / ${outcome.asked?.[0]}` : outcome.solo?.failed ? '–' : outcome.solo?.score}
            </span>
            <span className="muted">{outcome.correct ? 'richtig' : meta.scoreLabel}</span>
            {best !== undefined && !me?.newRecord && <span className="small muted">Dein Rekord: {best}</span>}
          </div>
        ) : (
          <div className="podium">
            {order.map((i) => {
              const place = outcome.places[i];
              return (
                <div key={i} className="step">
                  <Avatar kind={seats[i].avatar} size={place === 1 ? 54 : 44} bg={seats[i].color} ring={place === 1 ? '#F2C94C' : undefined} />
                  <span>{seats[i].name}</span>
                  <span className="muted small">{scoreText(i)}</span>
                  <span className="block" style={{ height: heights[Math.min(3, place - 1)], background: blockColor[Math.min(3, place - 1)] }}>
                    {place}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {seats.map((s, i) =>
          s.profileId ? (
            <div key={i} className="reward">
              <Avatar kind={s.avatar} size={40} bg={s.color} />
              <div className="grow">
                <b className="display">{s.name}</b>
                <div className="small muted">
                  {result.records[s.profileId]?.levelUp ? 'Neues Level! ' : ''}
                  {result.records[s.profileId]?.earned.map((b) => `Abzeichen: ${b.name}`).join(' · ')}
                </div>
                {unlockNote(s.profileId) && <div className="small">{unlockNote(s.profileId)}</div>}
              </div>
              <Stars n={stars[i]} size={22} />
            </div>
          ) : null,
        )}

        {meProfile && (
          <div className="col" style={{ gap: 4 }}>
            <div className="row between small">
              <span className="label">
                Level {levelOf(meProfile.stars).level} · {levelOf(meProfile.stars).name}
              </span>
              <span className="muted">noch {levelOf(meProfile.stars).toNext} Sterne</span>
            </div>
            <div className="bar">
              <i style={{ width: `${levelOf(meProfile.stars).progress * 100}%` }} />
            </div>
          </div>
        )}

        {online?.next?.length ? (
          <p className="small center" role="status">
            <b>{online.next.join(', ')}</b> {online.next.length > 1 ? 'spielen' : 'spielt'} in der nächsten Runde mit!
          </p>
        ) : null}

        {online?.bar?.(true)}

        {online && !online.host ? (
          <p className="card center display" role="status">
            Warte, bis {online.hostName} „Nochmal“ tippt …
          </p>
        ) : (
          <button type="button" className="btn primary big block" onClick={onAgain}>
            <Icon name="refresh" /> Nochmal spielen
          </button>
        )}
        <button type="button" className="btn secondary block" onClick={onClose}>
          {online ? (online.host ? 'Zurück ins Spielzimmer' : 'Spielzimmer verlassen') : 'Anderes Spiel'}
        </button>
      </div>
    </div>
  );
}
