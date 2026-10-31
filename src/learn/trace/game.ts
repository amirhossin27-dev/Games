import type { GameDef } from '../../engine/game';
import type { Level } from '../../lib/store';
import { pick, placesFromScores, shuffle, type Rnd } from '../../lib/util';
import { int } from '../choice';
import { SCHWUNGE } from './shapes';

/**
 * Regeln der Nachspur-Spiele (Schwung-Strecke, Zahlen-Spur). Aufgebaut wie die Quiz-Engine:
 * Allein, gegen Robo und online spuren alle dieselbe Vorlage gleichzeitig; teilen sich mehrere
 * Kinder ein Gerät, geht es reihum. Ans Spiel (und übers Netz) geht nur das Ergebnis, nicht die Striche.
 */

export type TraceGameKind = 'schwung' | 'zahlen';

export type TraceTask =
  | { k: 'schwung'; id: string; mover: string; goal: string }
  | {
      k: 'zahl';
      /** Was geschrieben wird, z. B. „7“ oder „15“ */
      text: string;
      /** guided = mit Vorlage nachspuren, free = ohne Vorlage selbst schreiben */
      mode: 'guided' | 'free';
      /** Großer Text über der Fläche, z. B. „8 + 5 = ?“ */
      prompt: string;
      /** Kleine Anleitung */
      hint: string;
      /** Menge als Bilder zum Zählen */
      count?: { n: number; e: string };
    };

export const TRACE_SOLO = 6;
export const TRACE_EACH = 3;
export const TRACE_REVEAL_MS = 1700;

export interface TraceAnswer {
  /** 0 = nicht geschafft (nur beim freien Schreiben), sonst 1–3 */
  stars: number;
  ms: number;
}

export interface TraceState {
  game: TraceGameKind;
  level: Level;
  n: number;
  order: 'together' | 'turns';
  tasks: TraceTask[];
  q: number;
  phase: 'ask' | 'reveal' | 'done';
  answers: (TraceAnswer | null)[];
  scores: number[];
  /** Sauber geschafft (mindestens 2 Sterne) */
  correct: number[];
  asked: number[];
}

export type TraceAction = { t: 'done'; stars: number; ms: number } | { t: 'next' };

/** Wer etwas nachspurt und womit es ans Ziel kommt (keine Herzen). */
const MOVERS: [string, string][] = [
  ['🐻', '🍯'],
  ['🚗', '🏠'],
  ['🐝', '🌻'],
  ['🐌', '🍓'],
  ['🚀', '🌙'],
  ['🐭', '🧀'],
  ['🐶', '🦴'],
  ['🐰', '🥕'],
  ['🐞', '🍃'],
  ['🚂', '🏁'],
];

const COUNT_EMOJI = ['🍎', '⭐', '🐟', '🌼', '🍓', '⚽', '🐞', '🍐'];

function schwungTasks(level: Level, count: number, rnd: Rnd): TraceTask[] {
  const pool = SCHWUNGE.filter((s) => s.level === level);
  const movers = shuffle(MOVERS, rnd);
  const out: TraceTask[] = [];
  let bag: typeof pool = [];
  while (out.length < count) {
    if (!bag.length) bag = shuffle(pool, rnd);
    const s = bag.pop()!;
    const [mover, goal] = movers[out.length % movers.length];
    out.push({ k: 'schwung', id: s.id, mover, goal });
  }
  return out;
}

export function numberTask(level: Level, rnd: Rnd): TraceTask {
  const e = pick(COUNT_EMOJI, rnd);
  if (level === 0) {
    const n = int(0, 9, rnd);
    return { k: 'zahl', text: String(n), mode: 'guided', prompt: String(n), hint: n === 0 ? 'Null – gar nichts da. Spure die 0 nach.' : `Spure die ${n} nach.`, count: { n, e } };
  }
  if (level === 1) {
    const n = rnd() < 0.6 ? int(10, 20, rnd) : int(1, 9, rnd);
    return { k: 'zahl', text: String(n), mode: 'guided', prompt: 'Wie viele sind es?', hint: 'Zähle und spure die Zahl nach.', count: { n, e } };
  }
  // Schwer: ohne Vorlage selbst schreiben – das Ergebnis muss man wissen.
  const r = rnd();
  if (r < 0.55) {
    const minus = rnd() < 0.45;
    const x = minus ? int(0, 19, rnd) : int(2, 20, rnd);
    if (minus) {
      const b = int(1, 20 - x, rnd);
      return { k: 'zahl', text: String(x), mode: 'free', prompt: `${x + b} − ${b} = ?`, hint: 'Rechne und schreib das Ergebnis.' };
    }
    const a = int(1, x - 1, rnd);
    return { k: 'zahl', text: String(x), mode: 'free', prompt: `${a} + ${x - a} = ?`, hint: 'Rechne und schreib das Ergebnis.' };
  }
  if (r < 0.8) {
    const before = rnd() < 0.5;
    const x = before ? int(0, 19, rnd) : int(1, 20, rnd);
    return before
      ? { k: 'zahl', text: String(x), mode: 'free', prompt: `Was kommt vor ${x + 1}?`, hint: 'Schreib die Zahl davor.' }
      : { k: 'zahl', text: String(x), mode: 'free', prompt: `Was kommt nach ${x - 1}?`, hint: 'Schreib die Zahl danach.' };
  }
  const n = int(11, 20, rnd);
  return { k: 'zahl', text: String(n), mode: 'free', prompt: 'Wie viele sind es?', hint: 'Zähle und schreib die Zahl selbst.', count: { n, e } };
}

function numberTasks(level: Level, count: number, rnd: Rnd): TraceTask[] {
  const out: TraceTask[] = [];
  for (let tries = 0; out.length < count; tries++) {
    const t = numberTask(level, rnd);
    if (tries > 300 || !out.some((x) => x.k === 'zahl' && t.k === 'zahl' && x.text === t.text)) out.push(t);
  }
  return out;
}

export function makeTraceTasks(game: TraceGameKind, level: Level, count: number, rnd: Rnd): TraceTask[] {
  return game === 'schwung' ? schwungTasks(level, count, rnd) : numberTasks(level, count, rnd);
}

/** Punkte: 3 je Stern, bis zu 2 extra fürs zügige Spuren. */
export function tracePoints(a: TraceAnswer): number {
  if (a.stars <= 0) return 0;
  return a.stars * 3 + (a.ms < 8000 ? 2 : a.ms < 15000 ? 1 : 0);
}

export function traceAsker(s: TraceState): number | 'all' {
  return s.order === 'together' ? 'all' : s.q % s.n;
}

const responders = (s: TraceState) => {
  const who = traceAsker(s);
  return who === 'all' ? Array.from({ length: s.n }, (_, i) => i) : [who];
};

/** Wie oft Robo drei Sterne schafft bzw. (Schwer, frei schreiben) danebenliegt */
const ROBO: Record<Level, { three: number; fail: number }> = {
  0: { three: 0.4, fail: 0 },
  1: { three: 0.45, fail: 0 },
  2: { three: 0.5, fail: 0.15 },
};

export function traceDef(game: TraceGameKind): GameDef<TraceState, TraceAction> {
  return {
    init({ n, level, shared, rnd }) {
      const order = shared ? 'turns' : 'together';
      const count = order === 'turns' ? TRACE_EACH * n : TRACE_SOLO;
      return {
        game,
        level,
        n,
        order,
        tasks: makeTraceTasks(game, level, count, rnd),
        q: 0,
        phase: 'ask',
        answers: Array(n).fill(null),
        scores: Array(n).fill(0),
        correct: Array(n).fill(0),
        asked: Array(n).fill(0),
      };
    },
    turn(s) {
      if (s.phase !== 'ask') return null;
      return traceAsker(s);
    },
    apply(s, a, by) {
      if (a.t === 'next') {
        if (s.phase !== 'reveal') return null;
        const q = s.q + 1;
        if (q >= s.tasks.length) return { ...s, phase: 'done' };
        return { ...s, q, phase: 'ask', answers: Array(s.n).fill(null) };
      }
      if (s.phase !== 'ask' || !responders(s).includes(by) || s.answers[by]) return null;
      if (!Number.isInteger(a.stars) || a.stars < 0 || a.stars > 3 || !(a.ms >= 0)) return null;
      const answer = { stars: a.stars, ms: a.ms };
      const answers = s.answers.slice();
      answers[by] = answer;
      const scores = s.scores.slice();
      const correct = s.correct.slice();
      const asked = s.asked.slice();
      asked[by]++;
      scores[by] += tracePoints(answer);
      if (a.stars >= 2) correct[by]++;
      const all = responders(s).every((p) => answers[p]);
      return { ...s, answers, scores, correct, asked, phase: all ? 'reveal' : 'ask' };
    },
    outcome(s) {
      if (s.phase !== 'done') return null;
      return {
        places: placesFromScores(s.scores),
        scores: s.scores,
        correct: s.correct,
        asked: s.asked,
        solo: s.n === 1 ? { score: s.correct[0] } : undefined,
      };
    },
    robo(s, seat, level, rnd) {
      if (s.phase !== 'ask' || !responders(s).includes(seat) || s.answers[seat]) return null;
      const r = ROBO[level];
      const task = s.tasks[s.q];
      const free = task.k === 'zahl' && task.mode === 'free';
      const x = rnd();
      const stars = free && x < r.fail ? 0 : x < r.fail + r.three ? 3 : rnd() < 0.7 ? 2 : 1;
      return { t: 'done', stars, ms: 6000 + rnd() * 9000 };
    },
    roboDelay: (s) => (s.order === 'turns' ? 2500 + Math.random() * 2500 : 5000 + Math.random() * 8000),
    phaseKey: (s) => `${s.q}:${s.phase}`,
    auto(s) {
      if (s.phase !== 'reveal') return null;
      const anyFail = s.answers.some((a) => a && a.stars === 0);
      return { action: { t: 'next' }, by: 0, delay: anyFail ? TRACE_REVEAL_MS + 1500 : TRACE_REVEAL_MS };
    },
    endDelay: 600,
  };
}
