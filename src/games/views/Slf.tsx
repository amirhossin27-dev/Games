import { useEffect, useRef, useState } from 'react';
import { buzz, sfx } from '../../arcade/engine';
import type { PlayProps } from '../../engine/game';
import { useGame } from '../../engine/useGame';
import type { Level } from '../../lib/store';
import { speakIfAuto } from '../../lib/speech';
import { cls } from '../../lib/util';
import { Icon } from '../../ui/Icon';
import { Curtain, SeatStrip, useOnChange } from '../../ui/parts';
import { catLabel, catPoints, judge, roundPoints, slfDef, slfTotals, SLF_ROUNDS, SLF_SECONDS, type SlfState } from '../rules/slf';
import { nameOf, turnHint } from './Classic';

const VERDICT_ICON = { ok: '✓', unknown: '?', wrong: '✗', empty: '–' } as const;

function WriteForm({ s, level, onSubmit }: { s: SlfState; level: Level; onSubmit: (a: string[]) => void }) {
  const [answers, setAnswers] = useState<string[]>(() => s.cats.map(() => ''));
  const [left, setLeft] = useState(SLF_SECONDS[level]);
  const sent = useRef(false);
  const letter = s.letters[s.round];
  const latest = useRef(answers);
  latest.current = answers;

  useEffect(() => {
    speakIfAuto(`Der Buchstabe ist ${letter}.`);
    const t = window.setInterval(() => setLeft((x) => x - 1), 1000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    if (left <= 0 && !sent.current) {
      sent.current = true;
      onSubmit(latest.current);
    }
  }, [left]);

  return (
    <form
      className="slf-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (sent.current) return;
        sent.current = true;
        onSubmit(answers);
      }}
    >
      <div className="row" style={{ justifyContent: 'center', gap: 16 }}>
        <span className="slf-letter" aria-label={`Buchstabe ${letter}`}>
          {letter}
        </span>
        <span className="col" style={{ gap: 2 }}>
          <span className="label">Runde {s.round + 1} von {SLF_ROUNDS}</span>
          <span className={cls('pill', left <= 15 && 'warn')}>
            <Icon name="hourglass" size={18} /> {left} Sek.
          </span>
        </span>
      </div>
      {s.cats.map((c, k) => (
        <label key={c}>
          {catLabel(c)}
          <input
            className="input"
            value={answers[k]}
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="next"
            placeholder={`${letter} …`}
            onChange={(e) => setAnswers((a) => a.map((x, i) => (i === k ? e.target.value : x)))}
          />
        </label>
      ))}
      <button type="submit" className="btn primary block">
        Fertig!
      </button>
      <p className="small muted center">Ein leeres Feld ist okay – dafür gibt es nur keine Punkte.</p>
    </form>
  );
}

export function Slf(props: PlayProps) {
  const { seats, level } = props;
  const [def] = useState(() => slfDef(seats.map((x) => x.robo)));
  const g = useGame(def, props);
  const s: SlfState = g.s;
  const totals = slfTotals(s);

  useOnChange(s.phase, (_, p) => {
    if (p === 'review') {
      sfx.point();
      buzz(30);
    }
  });

  if (s.phase === 'write') {
    // An einem Gerät schreibt einer nach dem anderen, sonst alle gleichzeitig.
    const writer = s.sequential ? s.writer : g.view;
    const humanWriting = g.myTurn && g.isHuman(writer) && !s.answers[writer];
    return (
      <div className="g-col">
        <SeatStrip seats={seats} active={s.sequential ? writer : 'all'} scores={totals} done={s.answers.map(Boolean)} />
        {humanWriting ? (
          <WriteForm key={`${s.round}-${writer}`} s={s} level={level} onSubmit={(answers) => g.act({ t: 'submit', answers }, writer)} />
        ) : (
          <p className="game-hint big">{s.sequential ? turnHint(g, seats, `${nameOf(seats, writer)} schreibt …`) : 'Fertig! Warte auf die anderen …'}</p>
        )}
        {g.curtain !== null && <Curtain seat={seats[g.curtain]} note={`Gleich kommt der Buchstabe für Runde ${s.round + 1}.`} onReveal={g.reveal} />}
      </div>
    );
  }

  const r = s.rounds[s.rounds.length - 1];
  const pts = r ? roundPoints(r, s.cats) : seats.map(() => 0);
  return (
    <div className="g-col">
      <SeatStrip seats={seats} scores={totals} />
      {r && (
        <>
          <div className="row" style={{ justifyContent: 'center' }}>
            <span className="slf-letter">{r.letter}</span>
            <span className="label">
              Runde {s.rounds.length}: Antworten ansehen
              <br />
              <span className="small muted">Quatsch? Antwort antippen zum Wegstreichen.</span>
            </span>
          </div>
          <div className="slf-table">
            <table>
              <thead>
                <tr>
                  <th />
                  {seats.map((p, i) => (
                    <th key={i}>{p.name.split(' ').pop()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.cats.map((c, k) => {
                  const cp = catPoints(r, s.cats, k);
                  return (
                    <tr key={c}>
                      <th>{catLabel(c)}</th>
                      {seats.map((_, p) => {
                        const v = judge(c, r.letter, r.answers[p][k]);
                        const vetoed = r.veto[p][k];
                        return (
                          <td key={p}>
                            <button
                              type="button"
                              className={cls('slf-ans', vetoed && 'veto')}
                              disabled={!r.answers[p][k] || s.phase === 'done'}
                              onClick={() => g.act({ t: 'veto', who: p, cat: k }, g.view)}
                              aria-label={`${r.answers[p][k] || 'leer'}${vetoed ? ', gestrichen' : ''}`}
                            >
                              <span className="w">
                                {VERDICT_ICON[v]} {r.answers[p][k] || '–'}
                              </span>
                              <span className="p">+{cp[p]}</span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                <tr>
                  <th>Runde</th>
                  {pts.map((x, i) => (
                    <td key={i}>
                      <b className="display">{x}</b>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
      {s.phase === 'review' && (
        <button type="button" className="btn primary big block" onClick={() => g.act({ t: 'next' }, g.view)}>
          {s.round + 1 >= SLF_ROUNDS ? 'Zum Ergebnis' : 'Nächster Buchstabe'}
        </button>
      )}
    </div>
  );
}
