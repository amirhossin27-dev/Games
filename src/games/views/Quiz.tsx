import { useEffect, useRef, useState } from 'react';
import { buzz, sfx } from '../../arcade/engine';
import type { PlayProps } from '../../engine/game';
import { useGame } from '../../engine/useGame';
import { quizDef, quizPoints, type QuizState } from '../../learn/quiz';
import type { Subject, Task } from '../../learn/tasks';
import { speak, speakIfAuto, VOICE_ENABLED } from '../../lib/speech';
import { cls } from '../../lib/util';
import { Icon } from '../../ui/Icon';
import { AnalogClock, SeatStrip, SpeakButton } from '../../ui/parts';

const DEFS = {
  rechnen: quizDef('rechnen'),
  buchstaben: quizDef('buchstaben'),
  uhr: quizDef('uhr'),
  welt: quizDef('welt'),
  woerter: quizDef('woerter'),
  englisch: quizDef('englisch'),
};

export const ANSWER_COLORS = ['#417A4D', '#B5532E', '#2F6E9E', '#6E4C86'];

export function Shape({ i }: { i: number }) {
  const s = ['circle', 'triangle', 'square', 'diamond'][i % 4];
  return (
    <svg className="shape" viewBox="0 0 24 24" fill="#FFFDF8" aria-hidden="true">
      {s === 'circle' && <circle cx="12" cy="12" r="9" />}
      {s === 'triangle' && <path d="M12 3l10 18H2z" />}
      {s === 'square' && <rect x="3" y="3" width="18" height="18" rx="2" />}
      {s === 'diamond' && <path d="M12 2l10 10-10 10L2 12z" />}
    </svg>
  );
}

function TenFrame({ filled, crossed = 0 }: { filled: number; crossed?: number }) {
  return (
    <span className="tenframe">
      {Array.from({ length: 10 }, (_, i) => {
        const on = i < filled;
        const off = on && i >= filled - crossed;
        return <span key={i} className={cls(on && 'on', off && 'off')} style={on ? { background: off ? '#FFFDF8' : i < 5 ? '#6FA8D6' : '#D9774F' } : undefined} />;
      })}
    </span>
  );
}

/** Aufgabe mit Bild, Zehnerfeld oder Uhr (auch für die Tutorials). */
export function TaskCard({ task, speakable = true, letter }: { task: Task; speakable?: boolean; letter?: boolean }) {
  const v = task.visual;
  return (
    <div className="quiz-card">
      {speakable && <SpeakButton text={task.say} />}
      {v?.k === 'picture' && <span className="quiz-pic">{v.e}</span>}
      {v?.k === 'clock' && <AnalogClock h={v.h} m={v.m} size={160} />}
      {v?.k === 'tiles' && v.e && <span className="quiz-pic">{v.e}</span>}
      {task.hint && <span className="quiz-hint">{task.hint}</span>}
      <span className={cls('quiz-prompt', letter && 'letter', task.prompt.length > 10 && 'small')}>{task.prompt}</span>
      {v?.k === 'tiles' && (
        <span className="quiz-tiles" aria-label={`Teile: ${v.parts.join(', ')}`}>
          {v.parts.map((p, i) => (
            <span key={i} className="quiz-tile" style={{ transform: `rotate(${((i * 37) % 7) - 3}deg)` }}>
              {p}
            </span>
          ))}
        </span>
      )}
      {v?.k === 'picture' && v.word && <span className="quiz-word">{v.word.toUpperCase()}</span>}
      {v?.k === 'tenframe' && (
        <span className="tenframes" aria-hidden="true">
          {v.minus ? (
            <TenFrame filled={v.a} crossed={v.b} />
          ) : (
            <>
              <TenFrame filled={v.a} />
              <span className="display">+</span>
              <TenFrame filled={v.b} />
            </>
          )}
        </span>
      )}
    </div>
  );
}

export function AnswerGrid({ task, chosen, reveal, disabled, onPick }: { task: Task; chosen: number | null; reveal: boolean; disabled: boolean; onPick: (i: number) => void }) {
  return (
    <div className="answers">
      {task.options.map((o, i) => {
        const ok = reveal && i === task.correct;
        const bad = reveal && chosen === i && i !== task.correct;
        const dim = reveal && !ok && !bad;
        return (
          <button
            key={i}
            type="button"
            className={cls('answer', task.pictures && 'pic', o.length > 3 && 'text', ok && 'ok', bad && 'bad', dim && 'dim')}
            style={{ background: ANSWER_COLORS[i % 4] }}
            disabled={disabled}
            onClick={() => onPick(i)}
            aria-label={`Antwort ${o}`}
          >
            {!task.pictures && <Shape i={i} />}
            {o}
            {ok && (
              <span className="mark ok">
                <Icon name="check" size={16} stroke={3.4} />
              </span>
            )}
            {bad && (
              <span className="mark bad">
                <Icon name="close" size={14} stroke={3.4} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Quiz(props: PlayProps & { subject: Subject }) {
  const { seats, subject } = props;
  const g = useGame(DEFS[subject], props);
  const s: QuizState = g.s;
  const task = s.tasks[s.q];
  const asker = s.order === 'turns' ? s.q % s.n : null;
  /** Wessen Antwort zeigt dieses Gerät? */
  const me = asker ?? g.view;
  const mine = s.answers[me];
  const askStart = useRef(performance.now());
  const [elapsed, setElapsed] = useState(0);

  // Neue Aufgabe: Uhr zurücksetzen und vorlesen
  useEffect(() => {
    if (s.phase !== 'ask') return;
    askStart.current = performance.now();
    setElapsed(0);
    const name = asker !== null && g.humans > 1 ? `${seats[asker].name}, ` : '';
    if (!seats[me]?.robo) speakIfAuto(name + task.say);
    const t = window.setInterval(() => setElapsed(performance.now() - askStart.current), 250);
    return () => window.clearInterval(t);
  }, [s.q, s.phase]);

  // Töne bei der Auflösung
  useEffect(() => {
    if (s.phase !== 'reveal' || !mine) return;
    if (mine.i === task.correct) sfx.match();
    else {
      sfx.miss();
      buzz(60);
    }
  }, [s.phase]);

  const canAnswer = g.myTurn && s.phase === 'ask' && !mine && !seats[me].robo;
  const pick = (i: number) => {
    if (!canAnswer) return;
    sfx.tap();
    g.act({ t: 'answer', i, ms: performance.now() - askStart.current }, me);
  };

  const remaining = Math.max(0, 1 - elapsed / 10_000);
  const total = s.tasks.length;
  const right = mine && mine.i === task.correct;

  let hint: string;
  if (s.phase === 'reveal') hint = '';
  else if (asker !== null && seats[asker].robo) hint = `${seats[asker].name} überlegt …`;
  else if (asker !== null && g.humans > 1) hint = `${seats[asker].name} ist dran`;
  else if (mine) hint = 'Warte auf die anderen …';
  else hint = '';

  return (
    <div className="g-col">
      {seats.length > 1 && <SeatStrip seats={seats} active={asker ?? (s.phase === 'ask' ? 'all' : null)} scores={s.scores} done={s.order === 'together' ? s.answers.map(Boolean) : undefined} />}
      <div className="row" style={{ width: '100%' }}>
        <span className="label">
          Aufgabe {s.q + 1} von {total}
        </span>
        <div className="timer-bar grow" aria-hidden="true">
          <i style={{ width: `${(s.phase === 'ask' && !mine ? remaining : 0) * 100}%` }} />
        </div>
      </div>
      <TaskCard task={task} letter={subject === 'buchstaben' && task.prompt.length === 1} />
      <AnswerGrid task={task} chosen={mine?.i ?? null} reveal={s.phase !== 'ask'} disabled={!canAnswer} onPick={pick} />
      {s.phase === 'reveal' && mine && (
        <div className={cls('quiz-feedback', right ? 'ok' : 'bad')} role="status">
          {right ? <Icon name="check" stroke={3} /> : <Icon name="help" />}
          <span className="grow">
            {right ? `Richtig! +${quizPoints(mine.ms)} Punkte` : `Richtig ist: ${task.options[task.correct]}. ${task.explain ?? ''}`}
          </span>
          {VOICE_ENABLED && !right && task.explain && (
            <button type="button" className="icon-btn soft" aria-label="Tipp vorlesen" onClick={() => speak(`Richtig ist ${task.options[task.correct]}. ${task.explain}`)}>
              <Icon name="speaker" />
            </button>
          )}
        </div>
      )}
      {hint && <p className="game-hint">{hint}</p>}
    </div>
  );
}
