import { useEffect, useMemo, useRef } from 'react';
import { SEAT_COLORS, type PlayProps } from '../../engine/game';
import { useGame } from '../../engine/useGame';
import { traceDef, tracePoints, type TraceGameKind, type TraceState, type TraceTask } from '../../learn/trace/game';
import { digitLayout, schwungLayout, SCHWUNG_BY_ID, type Layout } from '../../learn/trace/shapes';
import { speakIfAuto } from '../../lib/speech';
import type { Level } from '../../lib/store';
import { cls } from '../../lib/util';
import { Icon } from '../../ui/Icon';
import { SeatStrip, Stars } from '../../ui/parts';
import { TracePad, type TraceResult } from '../../ui/TracePad';

const DEFS = { schwung: traceDef('schwung'), zahlen: traceDef('zahlen') };

export function layoutFor(task: TraceTask): Layout {
  return task.k === 'schwung' ? schwungLayout(task.id) : digitLayout(task.text);
}

/** Kräftige Farbe für die Striche: Lieblingsfarbe, wenn sie dunkel genug ist, sonst Spielfarbe. */
export function inkColor(color: string | undefined, seat: number): string {
  const m = color && /^#([0-9a-f]{6})$/i.exec(color);
  if (m) {
    const v = parseInt(m[1], 16);
    const lum = (0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255;
    if (lum < 0.62) return color!;
  }
  return SEAT_COLORS[seat % SEAT_COLORS.length];
}

/** Was über der Fläche steht: Name des Schwungs, Zahl, Menge zum Zählen oder Rechenaufgabe */
export function TraceTaskCard({ task }: { task: TraceTask }) {
  if (task.k === 'schwung') {
    return (
      <div className="trace-card">
        <span className="trace-hint">
          Bring {task.mover} zu {task.goal}
        </span>
        <b className="display">{SCHWUNG_BY_ID[task.id]?.name}</b>
      </div>
    );
  }
  return (
    <div className="trace-card">
      {task.count && task.count.n > 0 && (
        <span className="trace-count" aria-label={`${task.count.n} Bilder`}>
          {Array.from({ length: task.count.n }, (_, i) => (
            <span key={i} className={cls(i % 5 === 4 && 'gap')}>
              {task.count!.e}
            </span>
          ))}
        </span>
      )}
      {(task.mode === 'free' || !task.count) && <b className={cls('display', 'trace-prompt')}>{task.prompt}</b>}
      <span className="trace-hint">{task.hint}</span>
    </div>
  );
}

/** Vorlage und Fläche für eine Aufgabe (auch für die Tutorials) */
export function TraceTaskPad({ task, level, color, disabled, autoDemo, showAnswer, onDone }: { task: TraceTask; level: Level; color: string; disabled?: boolean; autoDemo?: boolean; showAnswer?: boolean; onDone(r: TraceResult): void }) {
  const layout = useMemo(() => layoutFor(task), [task]);
  return (
    <TracePad
      layout={layout}
      level={level}
      free={task.k === 'zahl' && task.mode === 'free'}
      color={color}
      mover={task.k === 'schwung' ? { e: task.mover, goal: task.goal } : undefined}
      autoDemo={autoDemo}
      disabled={disabled}
      showAnswer={showAnswer}
      onDone={onDone}
    />
  );
}

export function Trace(props: PlayProps & { game: TraceGameKind }) {
  const { seats, game } = props;
  const g = useGame(DEFS[game], props);
  const s: TraceState = g.s;
  const task = s.tasks[s.q];
  const asker = s.order === 'turns' ? s.q % s.n : null;
  const me = asker ?? g.view;
  const mine = s.answers[me];
  const start = useRef(performance.now());

  useEffect(() => {
    if (s.phase !== 'ask') return;
    start.current = performance.now();
    const name = asker !== null && g.humans > 1 ? `${seats[asker].name}, ` : '';
    if (!seats[me]?.robo) speakIfAuto([name, task.k === 'schwung' ? 'Fang beim grünen Punkt an.' : task.hint]);
  }, [s.q, s.phase]);

  const canTrace = g.myTurn && s.phase === 'ask' && !mine && !seats[me].robo;
  const done = (r: TraceResult) => {
    if (!canTrace) return;
    g.act({ t: 'done', stars: r.stars, ms: performance.now() - start.current }, me);
  };

  let hint = '';
  if (s.phase === 'ask') {
    if (asker !== null && seats[asker].robo) hint = `${seats[asker].name} spurt …`;
    else if (asker !== null && g.humans > 1) hint = `${seats[asker].name} ist dran`;
    else if (mine) hint = 'Warte auf die anderen …';
  }
  const free = task.k === 'zahl' && task.mode === 'free';
  const level = s.level;

  return (
    <div className="g-col">
      {seats.length > 1 && <SeatStrip seats={seats} active={asker ?? (s.phase === 'ask' ? 'all' : null)} scores={s.scores} done={s.order === 'together' ? s.answers.map(Boolean) : undefined} />}
      <div className="row" style={{ width: '100%' }}>
        <span className="label">
          Aufgabe {s.q + 1} von {s.tasks.length}
        </span>
      </div>
      <TraceTaskCard task={task} />
      <TraceTaskPad
        key={`${s.q}:${me}`}
        task={task}
        level={level}
        color={inkColor(seats[me]?.color, me)}
        autoDemo={level === 0}
        disabled={!canTrace}
        showAnswer={s.phase !== 'ask' && free && !!mine && mine.stars === 0}
        onDone={done}
      />
      {s.phase === 'reveal' && mine && (
        <div className={cls('quiz-feedback', mine.stars > 0 ? 'ok' : 'bad')} role="status">
          {mine.stars > 0 ? <Icon name="check" stroke={3} /> : <Icon name="help" />}
          <span className="grow">{mine.stars > 0 ? `+${tracePoints(mine)} Punkte` : `Richtig ist: ${task.k === 'zahl' ? task.text : ''}`}</span>
          {mine.stars > 0 && <Stars n={mine.stars} size={22} />}
        </div>
      )}
      {hint && <p className="game-hint">{hint}</p>}
    </div>
  );
}
