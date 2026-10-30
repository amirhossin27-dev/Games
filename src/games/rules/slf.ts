import { SLF_WORDS } from '../../data/slf';
import type { GameDef } from '../../engine/game';
import type { Level } from '../../lib/store';
import { placesFromScores, type Rnd } from '../../lib/util';

/**
 * Stadt-Land-Fluss für 2–4 (nach Arta, erweitert). An einem Gerät schreibt reihum jedes Kind
 * seine Antworten (mit Sichtschutz), Robo schreibt sofort. Danach sehen alle die Antworten,
 * und Quatsch-Antworten können weggetippt werden.
 */

export const SLF_ALL = [
  { id: 'stadt', label: 'Stadt' },
  { id: 'land', label: 'Land' },
  { id: 'fluss', label: 'Fluss' },
  { id: 'tier', label: 'Tier' },
  { id: 'name', label: 'Name' },
  { id: 'beruf', label: 'Beruf' },
] as const;

export type SlfCat = (typeof SLF_ALL)[number]['id'];

const CATS_FOR: Record<Level, SlfCat[]> = {
  0: ['tier', 'name', 'stadt'],
  1: ['stadt', 'land', 'tier', 'name'],
  2: ['stadt', 'land', 'fluss', 'tier', 'name', 'beruf'],
};

export const catLabel = (id: SlfCat) => SLF_ALL.find((c) => c.id === id)!.label;

/** Ohne die fiesen Buchstaben C, Q, X, Y … */
export const SLF_LETTERS = [...'ABDEFGHIKLMNOPRSTW'];
export const SLF_ROUNDS = 3;
/** Schreibzeit je Kind und Buchstabe */
export const SLF_SECONDS: Record<Level, number> = { 0: 120, 1: 100, 2: 90 };
const MAX_LEN = 30;

export function fold(word: string): string {
  return word
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[^a-z0-9]/g, '');
}

export function firstLetter(word: string): string {
  return (word.trim()[0] ?? '').normalize('NFD').replace(/[^A-Za-z]/g, '').toUpperCase();
}

let banks: Map<string, Set<string>> | null = null;
function bank(cat: string): Set<string> {
  banks ??= new Map(Object.entries(SLF_WORDS).map(([k, words]) => [k, new Set(words.map(fold))]));
  return banks.get(cat) ?? new Set();
}

function variants(cat: string, w: string): string[] {
  if (cat !== 'beruf') return [w];
  const out = [w];
  if (w.endsWith('in')) {
    const base = w.slice(0, -2);
    out.push(base, base.replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u'));
  }
  if (w.endsWith('frau')) out.push(`${w.slice(0, -4)}mann`);
  return out;
}

export type Verdict = 'ok' | 'unknown' | 'wrong' | 'empty';

export function judge(cat: string, letter: string, word: string | undefined): Verdict {
  const w = (word ?? '').trim();
  if (!w) return 'empty';
  if (firstLetter(w) !== letter) return 'wrong';
  return variants(cat, fold(w)).some((v) => bank(cat).has(v)) ? 'ok' : 'unknown';
}

export const wordsFor = (cat: string, letter: string) => (SLF_WORDS[cat] ?? []).filter((w) => firstLetter(w) === letter);

export interface SlfRound {
  letter: string;
  answers: string[][];
  veto: boolean[][];
}

export interface SlfState {
  n: number;
  cats: SlfCat[];
  letters: string[];
  round: number;
  phase: 'write' | 'review' | 'done';
  writer: number;
  first: number;
  answers: (string[] | null)[];
  rounds: SlfRound[];
  /** Vorbereitete Robo-Antworten [Runde][Platz] */
  robo: string[][][];
}

export type SlfAction = { t: 'submit'; answers: string[] } | { t: 'veto'; who: number; cat: number } | { t: 'next' };

const SKILL: Record<SlfCat, number> = { stadt: 0.85, land: 0.75, fluss: 0.55, tier: 0.85, name: 0.9, beruf: 0.75 };
const ROBO_FACTOR: Record<Level, number> = { 0: 0.55, 1: 0.75, 2: 0.9 };

function roboAnswers(cats: SlfCat[], letter: string, level: Level, rnd: Rnd): string[] {
  return cats.map((c) => {
    const words = wordsFor(c, letter);
    return words.length && rnd() < SKILL[c] * ROBO_FACTOR[level] ? words[Math.floor(rnd() * words.length)] : '';
  });
}

/** Zählt die Antwort (bekannt oder unbekannt, aber nicht weggetippt)? */
export function counts(r: SlfRound, cats: SlfCat[], seat: number, cat: number): boolean {
  const v = judge(cats[cat], r.letter, r.answers[seat][cat]);
  return (v === 'ok' || v === 'unknown') && !r.veto[seat][cat];
}

/** Punkte je Kategorie: allein 20, eine andere Antwort als alle anderen 10, gleiche Antwort 5. */
export function catPoints(r: SlfRound, cats: SlfCat[], cat: number): number[] {
  const n = r.answers.length;
  const valid = Array.from({ length: n }, (_, p) => counts(r, cats, p, cat));
  const nValid = valid.filter(Boolean).length;
  return Array.from({ length: n }, (_, p) => {
    if (!valid[p]) return 0;
    if (nValid === 1) return 20;
    const mine = fold(r.answers[p][cat]);
    const same = r.answers.some((a, o) => o !== p && valid[o] && fold(a[cat]) === mine);
    return same ? 5 : 10;
  });
}

export function roundPoints(r: SlfRound, cats: SlfCat[]): number[] {
  const out = Array(r.answers.length).fill(0);
  cats.forEach((_, c) => catPoints(r, cats, c).forEach((p, i) => (out[i] += p)));
  return out;
}

export function slfTotals(s: SlfState): number[] {
  const out = Array(s.n).fill(0);
  for (const r of s.rounds) roundPoints(r, s.cats).forEach((p, i) => (out[i] += p));
  return out;
}

function pickLetters(rnd: Rnd): string[] {
  const pool = SLF_LETTERS.slice();
  const out: string[] = [];
  while (out.length < SLF_ROUNDS) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return out;
}

export function slfDef(robos: boolean[]): GameDef<SlfState, SlfAction> {
  return {
    init({ n, starter, level, rnd }) {
      const cats = CATS_FOR[level];
      const letters = pickLetters(rnd);
      return {
        n,
        cats,
        letters,
        round: 0,
        phase: 'write',
        writer: starter % n,
        first: starter % n,
        answers: Array(n).fill(null),
        rounds: [],
        robo: letters.map((l) => Array.from({ length: n }, (_, p) => (robos[p] ? roboAnswers(cats, l, level, rnd) : []))),
      };
    },
    turn(s) {
      if (s.phase === 'done') return null;
      return s.phase === 'write' ? s.writer : 'all';
    },
    apply(s, a, by) {
      if (a.t === 'submit') {
        if (s.phase !== 'write' || s.writer !== by || s.answers[by]) return null;
        const mine = s.cats.map((_, k) => String(a.answers[k] ?? '').trim().slice(0, MAX_LEN));
        const answers = s.answers.map((x, i) => (i === by ? mine : x));
        for (let k = 1; k <= s.n; k++) {
          const w = (by + k) % s.n;
          if (!answers[w]) return { ...s, answers, writer: w };
        }
        const done = answers as string[][];
        return {
          ...s,
          answers,
          phase: 'review',
          rounds: [...s.rounds, { letter: s.letters[s.round], answers: done, veto: done.map(() => s.cats.map(() => false)) }],
        };
      }
      if (a.t === 'veto') {
        if (s.phase !== 'review' || a.who < 0 || a.who >= s.n || a.cat < 0 || a.cat >= s.cats.length) return null;
        const r = s.rounds[s.rounds.length - 1];
        const veto = r.veto.map((row, p) => (p === a.who ? row.map((v, k) => (k === a.cat ? !v : v)) : row));
        return { ...s, rounds: [...s.rounds.slice(0, -1), { ...r, veto }] };
      }
      if (s.phase !== 'review') return null;
      const round = s.round + 1;
      if (round >= SLF_ROUNDS) return { ...s, round, phase: 'done' };
      const first = (s.first + 1) % s.n;
      return { ...s, round, phase: 'write', first, writer: first, answers: Array(s.n).fill(null) };
    },
    outcome(s) {
      if (s.phase !== 'done') return null;
      const scores = slfTotals(s);
      return { places: placesFromScores(scores), scores };
    },
    robo(s, seat) {
      if (s.phase !== 'write' || s.writer !== seat) return null;
      return { t: 'submit', answers: s.robo[s.round][seat] };
    },
    roboDelay: () => 1500,
    viewer: (s) => (s.phase === 'write' ? s.writer : null),
    endDelay: 400,
  };
}
