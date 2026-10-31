import { shuffle, type Rnd } from '../lib/util';

/** Richtige Antwort und bis zu drei falsche, gemischt – für alle Lernspiele. */
export function withOptions(correct: string, distractors: string[], rnd: Rnd) {
  const unique = [...new Set(distractors.filter((d) => d !== correct))].slice(0, 3);
  const options = shuffle([correct, ...unique], rnd);
  return { options, correct: options.indexOf(correct) };
}

export const int = (min: number, max: number, rnd: Rnd) => min + Math.floor(rnd() * (max - min + 1));

/** Eine Frage aus einer festen Sammlung: Frage, richtige Antwort, mindestens drei falsche. */
export interface BankItem {
  q: string;
  a: string;
  w: string[];
  /** Bild zur Frage */
  e?: string;
  /** Lern-Tipp, wenn es falsch war */
  x?: string;
}
