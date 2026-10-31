import { useEffect, useState } from 'react';
import { sfx } from '../arcade/engine';
import type { TutArt, TutorialStep } from '../engine/tutorial';
import { GAME_BY_ID, type GameId } from '../games/registry';
import { AnswerGrid, TaskCard } from '../games/views/Quiz';
import { inkColor, TraceTaskCard, TraceTaskPad } from '../games/views/Trace';
import { nav } from '../lib/nav';
import { finishTutorial } from '../lib/progress';
import { speak, speakIfAuto, stopSpeaking, VOICE_ENABLED } from '../lib/speech';
import { useProfile } from '../lib/store';
import { cls } from '../lib/util';
import { GameArt } from '../ui/GameArt';
import { Icon } from '../ui/Icon';
import { Joy } from '../ui/Joy';
import { AnalogClock, Die, Hand, SpeakButton, toast } from '../ui/parts';

const ARROW: Record<string, string> = { left: '←', right: '→', up: '↑', down: '↓' };

function Art({ art, color, onSolved }: { art: TutArt; color?: string; onSolved: (ok: boolean) => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => setPicked(null), [art]);
  switch (art.k) {
    case 'art':
      return (
        <div style={{ width: '100%', maxWidth: 300 }}>
          <GameArt kind={art.art} height={190} />
        </div>
      );
    case 'gesture':
      return (
        <div className={cls('gesture-field', `g-${art.g}`)}>
          {ARROW[art.g] && (
            <span className="display" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: '4rem', color: '#CBBF9F' }} aria-hidden="true">
              {ARROW[art.g]}
            </span>
          )}
          <Hand />
          {art.label && <span className="gesture-label">{art.label}</span>}
        </div>
      );
    case 'pics':
      return (
        <div className="tut-pics">
          <div className="pics">
            {art.items.map((p, i) => (
              <span key={i}>{p}</span>
            ))}
          </div>
          {art.caption && <p className="display center">{art.caption}</p>}
        </div>
      );
    case 'grid': {
      const rows = Math.ceil(art.cells.length / art.cols);
      const square = art.cols <= 5;
      return (
        <div style={{ position: 'relative' }}>
          <div className={cls('mini-grid', square && 'square')} style={{ gridTemplateColumns: `repeat(${art.cols}, auto)`, gridTemplateRows: `repeat(${rows}, auto)` }}>
            {art.cells.map((c, i) => (
              <span key={i} className={cls(art.mark?.includes(i) && 'mark')} style={c?.startsWith('#') ? { background: c } : undefined}>
                {c && !c.startsWith('#') ? c : ''}
                {art.point === i && <Hand style={{ left: '30%', top: '45%', width: 46, height: 46 }} />}
              </span>
            ))}
          </div>
        </div>
      );
    }
    case 'cards':
      return (
        <div className="tut-cards">
          {art.cards.map((c, i) => (
            <span key={i} className={cls('mini-card', !c.t && 'back', c.red && 'red', c.dim && 'dim')}>
              {c.t}
              {art.point === i && <Hand style={{ left: '35%', top: '55%' }} />}
            </span>
          ))}
        </div>
      );
    case 'dice':
      return (
        <div className="dice-row">
          {art.values.map((v, i) => (
            <Die key={i} value={v} held={art.held?.[i]} />
          ))}
        </div>
      );
    case 'clock':
      return (
        <div className="col" style={{ alignItems: 'center' }}>
          <AnalogClock h={art.h} m={art.m} size={180} />
          {art.label && <p className="display" style={{ fontSize: '1.4rem' }}>{art.label}</p>}
        </div>
      );
    case 'trace':
      return (
        <div className="col" style={{ width: '100%', gap: 8, alignItems: 'center' }}>
          <TraceTaskCard task={art.task} />
          <TraceTaskPad
            task={art.task}
            level={art.level}
            color={inkColor(color, 0)}
            autoDemo
            disabled={!art.tryIt}
            onDone={(r) => onSolved(r.stars > 0)}
          />
        </div>
      );
    case 'quiz': {
      const reveal = picked !== null && picked === art.task.correct;
      return (
        <div className="col" style={{ width: '100%', gap: 12, position: 'relative' }}>
          <TaskCard task={art.task} speakable={false} />
          <div style={{ position: 'relative' }}>
            <AnswerGrid
              task={art.task}
              chosen={picked}
              reveal={art.tryIt ? reveal || picked !== null : false}
              disabled={!art.tryIt || reveal}
              onPick={(i) => {
                setPicked(i);
                const ok = i === art.task.correct;
                if (ok) sfx.match();
                else sfx.miss();
                onSolved(ok);
              }}
            />
            {art.point !== undefined && !art.tryIt && <Hand style={{ left: art.point % 2 ? '72%' : '22%', top: art.point < 2 ? '18%' : '68%' }} />}
          </div>
        </div>
      );
    }
  }
}

export function Tutorial({ game }: { game: GameId }) {
  const meta = GAME_BY_ID[game];
  const profile = useProfile();
  const steps: TutorialStep[] = meta.tutorial;
  const [i, setI] = useState(0);
  const [solved, setSolved] = useState<boolean | null>(null);
  const step = steps[i];
  const last = i === steps.length - 1;
  const needsTry = (step.art.k === 'quiz' || step.art.k === 'trace') && !!step.art.tryIt;

  const say = needsTry && solved === true ? 'Super, das ist richtig! Du bist bereit.' : needsTry && solved === false ? 'Fast! Probier es nochmal.' : step.say;

  useEffect(() => {
    setSolved(null);
    speakIfAuto(steps[i].say);
  }, [i]);
  useEffect(() => {
    if (solved !== null) speakIfAuto(say);
  }, [solved]);
  useEffect(() => () => stopSpeaking(), []);

  /** `completed`: bis zum Ende angeschaut (zählt fürs Abzeichen „Regel-Kenner“) */
  const finish = (completed: boolean) => {
    stopSpeaking();
    if (profile && completed) {
      const earned = finishTutorial(profile.id, game);
      earned.forEach((b) => toast(`Neues Abzeichen: ${b.name}!`));
    }
    nav.closeTutorial();
  };

  return (
    <div className="tut" role="dialog" aria-label={`So geht's: ${meta.name}`}>
      <div className="tut-inner">
        <div className="row between">
          <button type="button" className="icon-btn" aria-label="Tutorial schließen" onClick={() => finish(false)}>
            <Icon name="close" />
          </button>
          <div className="col" style={{ alignItems: 'center', gap: 0 }}>
            <b className="display">So geht's: {meta.name}</b>
            <span className="small muted">
              Schritt {i + 1} von {steps.length}
            </span>
          </div>
          <button type="button" className="btn ghost small" onClick={() => finish(false)}>
            Fertig
          </button>
        </div>
        <div className="tut-progress" aria-hidden="true">
          {steps.map((_, k) => (
            <span key={k} className={cls(k <= i && 'on')} />
          ))}
        </div>
        <div className="tut-stage">
          <Art art={step.art} color={profile?.color} onSolved={(ok) => setSolved((cur) => (cur === true ? true : ok))} />
        </div>
        <div className="joy-row">
          <Joy size={66} mood={solved ? 'cheer' : 'talk'} />
          <div className={cls('bubble', VOICE_ENABLED && 'with-speaker')}>
            <p style={{ fontSize: '1.1rem', fontWeight: 700 }}>{say}</p>
            <SpeakButton text={say} />
          </div>
        </div>
        <div className="tut-nav">
          <button type="button" className="btn secondary" disabled={i === 0} onClick={() => setI(i - 1)}>
            Zurück
          </button>
          {!last ? (
            <button type="button" className="btn primary" onClick={() => setI(i + 1)}>
              Weiter <Icon name="arrow" />
            </button>
          ) : (
            <button type="button" className="btn primary" disabled={needsTry && solved !== true} onClick={() => finish(true)}>
              {needsTry && solved !== true ? (step.art.k === 'trace' ? 'Erst nachspuren' : 'Tippe die Antwort') : 'Verstanden!'}
            </button>
          )}
        </div>
        {VOICE_ENABLED && (
          <button type="button" className="btn ghost small" onClick={() => speak(say)}>
            Nochmal vorlesen
          </button>
        )}
      </div>
    </div>
  );
}
