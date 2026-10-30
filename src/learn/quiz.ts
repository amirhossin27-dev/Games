import type { GameDef } from '../engine/game';
import type { Level } from '../lib/store';
import { placesFromScores } from '../lib/util';
import { makeTask, type Subject, type Task } from './tasks';

/**
 * Aufgaben-Engine für alle Lernspiele: Alle beantworten dieselbe Aufgabe gleichzeitig (ein Kind
 * gegen Robo – und später online). Teilen sich mehrere Kinder ein Gerät, geht es reihum: Jedes
 * Kind bekommt seine eigene Aufgabe.
 */

export const QUIZ_SOLO = 10;
export const QUIZ_EACH = 5;
export const REVEAL_MS = 1900;

export interface QuizAnswer {
  i: number;
  ms: number;
}

export interface QuizState {
  subject: Subject;
  level: Level;
  n: number;
  /** together = alle gleichzeitig, turns = reihum */
  order: 'together' | 'turns';
  tasks: Task[];
  q: number;
  phase: 'ask' | 'reveal' | 'done';
  answers: (QuizAnswer | null)[];
  scores: number[];
  correct: number[];
  asked: number[];
}

export type QuizAction = { t: 'answer'; i: number; ms: number } | { t: 'next' };

/** Wer beantwortet die aktuelle Aufgabe? */
export function quizAsker(s: QuizState): number | 'all' {
  return s.order === 'together' ? 'all' : s.q % s.n;
}

const responders = (s: QuizState) => {
  const who = quizAsker(s);
  return who === 'all' ? Array.from({ length: s.n }, (_, i) => i) : [who];
};

/** Punkte: 10 fürs Richtige, bis zu 3 extra fürs Schnellsein. */
export function quizPoints(ms: number): number {
  return 10 + (ms < 3000 ? 3 : ms < 6000 ? 2 : ms < 10000 ? 1 : 0);
}

/** Wie sicher Robo antwortet – je nach Stufe. */
const ROBO_SKILL: Record<Level, number> = { 0: 0.6, 1: 0.72, 2: 0.84 };

export function quizDef(subject: Subject): GameDef<QuizState, QuizAction> {
  return {
    init({ n, level, humans, rnd }) {
      const order = humans > 1 ? 'turns' : 'together';
      const count = order === 'turns' ? QUIZ_EACH * n : QUIZ_SOLO;
      const tasks: Task[] = [];
      // Keine Aufgabe doppelt hintereinander
      while (tasks.length < count) {
        const t = makeTask(subject, level, rnd);
        if (!tasks.some((x) => x.prompt === t.prompt && x.options[x.correct] === t.options[t.correct])) tasks.push(t);
      }
      return {
        subject,
        level,
        n,
        order,
        tasks,
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
      return quizAsker(s);
    },
    apply(s, a, by) {
      if (a.t === 'next') {
        if (s.phase !== 'reveal') return null;
        const q = s.q + 1;
        if (q >= s.tasks.length) return { ...s, phase: 'done' };
        return { ...s, q, phase: 'ask', answers: Array(s.n).fill(null) };
      }
      if (s.phase !== 'ask' || !responders(s).includes(by) || s.answers[by]) return null;
      const task = s.tasks[s.q];
      if (!Number.isInteger(a.i) || a.i < 0 || a.i >= task.options.length) return null;
      const answers = s.answers.slice();
      answers[by] = { i: a.i, ms: Math.max(0, a.ms) };
      const right = a.i === task.correct;
      const scores = s.scores.slice();
      const correct = s.correct.slice();
      const asked = s.asked.slice();
      asked[by]++;
      if (right) {
        scores[by] += quizPoints(a.ms);
        correct[by]++;
      }
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
      const task = s.tasks[s.q];
      const right = rnd() < ROBO_SKILL[level];
      const wrong = task.options.map((_, i) => i).filter((i) => i !== task.correct);
      const i = right ? task.correct : wrong[Math.floor(rnd() * wrong.length)];
      return { t: 'answer', i, ms: 2500 + rnd() * 5000 };
    },
    roboDelay: (s) => (s.order === 'turns' ? 1400 + Math.random() * 1200 : 2200 + Math.random() * 4500),
    phaseKey: (s) => `${s.q}:${s.phase}`,
    auto(s) {
      if (s.phase !== 'reveal') return null;
      // Bei einer falschen Antwort etwas länger zeigen – mit Lern-Tipp.
      const anyWrong = s.answers.some((a) => a && a.i !== s.tasks[s.q].correct);
      return { action: { t: 'next' }, by: 0, delay: anyWrong ? REVEAL_MS + 1600 : REVEAL_MS };
    },
    endDelay: 600,
  };
}
