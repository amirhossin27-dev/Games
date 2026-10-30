import type { Level } from '../lib/store';
import { pick, shuffle, type Rnd } from '../lib/util';

/** Eine Aufgabe mit vier Antworten – für Rechen-Rallye, Buchstaben-Jagd und Uhr-Profi. */
export interface Task {
  /** Großer Text der Aufgabe, z. B. „8 + 5 = ?“ */
  prompt: string;
  /** Was Joy vorliest */
  say: string;
  options: string[];
  correct: number;
  visual?: Visual;
  /** Kleiner Lern-Tipp, wenn es falsch war */
  explain?: string;
  /** Antworten sind Bilder (groß darstellen) */
  pictures?: boolean;
}

export type Visual =
  | { k: 'tenframe'; a: number; b: number; minus: boolean }
  | { k: 'picture'; e: string; word?: string }
  | { k: 'clock'; h: number; m: number };

export type Subject = 'rechnen' | 'buchstaben' | 'uhr';

function withOptions(correct: string, distractors: string[], rnd: Rnd) {
  const unique = [...new Set(distractors.filter((d) => d !== correct))].slice(0, 3);
  const options = shuffle([correct, ...unique], rnd);
  return { options, correct: options.indexOf(correct) };
}

const int = (min: number, max: number, rnd: Rnd) => min + Math.floor(rnd() * (max - min + 1));

// ───── Rechnen ─────

function numberDistractors(x: number, max: number, rnd: Rnd): string[] {
  const near = shuffle([x + 1, x - 1, x + 2, x - 2, x + 10, x - 10, x + 3], rnd);
  const out = near.filter((v) => v >= 0 && v <= max + 10 && v !== x);
  while (out.length < 3) out.push(x + out.length + 4);
  return out.map(String);
}

export function mathTask(level: Level, rnd: Rnd = Math.random): Task {
  if (level === 2 && rnd() < 0.4) {
    const a = int(2, 10, rnd);
    const b = int(2, 10, rnd);
    const x = a * b;
    return {
      prompt: `${a} · ${b} = ?`,
      say: `Wie viel ist ${a} mal ${b}?`,
      ...withOptions(String(x), [String(x + a), String(x - a), String(x + b), String(x - b), String(x + 1)], rnd),
      explain: `${a} mal ${b} heißt: ${b}-mal die ${a}.`,
    };
  }
  const max = level === 0 ? 10 : level === 1 ? 20 : 100;
  const minus = rnd() < (level === 0 ? 0.3 : 0.45);
  let a: number;
  let b: number;
  if (minus) {
    a = int(level === 0 ? 2 : 6, max, rnd);
    b = int(1, Math.min(a, level === 2 ? 60 : 10), rnd);
  } else if (level === 1) {
    // Mittel: meistens über die Zehn
    a = int(3, 9, rnd);
    b = int(Math.max(2, 11 - a), 10, rnd);
    if (rnd() < 0.3) a += 10;
    if (a + b > max) b = max - a;
  } else {
    a = int(1, max - 1, rnd);
    b = int(1, max - a, rnd);
  }
  const x = minus ? a - b : a + b;
  const op = minus ? '−' : '+';
  let explain: string | undefined;
  if (!minus && a < 10 && a + b > 10 && b <= 10) explain = `${a} + ${10 - a} = 10, dann noch ${b - (10 - a)} dazu.`;
  else if (minus && a > 10 && a - b < 10 && b <= 10) explain = `Erst ${a - 10} weg bis zur 10, dann noch ${b - (a - 10)}.`;
  else if (!minus) explain = `Zähl von ${Math.max(a, b)} aus ${Math.min(a, b)} weiter.`;
  else explain = `Zähl von ${a} aus ${b} zurück.`;
  return {
    prompt: `${a} ${op} ${b} = ?`,
    say: `Wie viel ist ${a} ${minus ? 'minus' : 'plus'} ${b}?`,
    ...withOptions(String(x), numberDistractors(x, max, rnd), rnd),
    visual: a <= 10 && b <= 10 ? { k: 'tenframe', a, b, minus } : undefined,
    explain,
  };
}

// ───── Buchstaben ─────

/** Wörter mit Bild. `anlaut: false` = der erste Laut passt nicht zum Buchstaben (Sch-, St-, Ei …). */
export const WORDS: { w: string; e: string; anlaut?: false }[] = [
  { w: 'Apfel', e: '🍎' }, { w: 'Ameise', e: '🐜' }, { w: 'Auto', e: '🚗' }, { w: 'Ananas', e: '🍍' },
  { w: 'Banane', e: '🍌' }, { w: 'Ball', e: '⚽' }, { w: 'Bär', e: '🐻' }, { w: 'Baum', e: '🌳' }, { w: 'Biene', e: '🐝' }, { w: 'Buch', e: '📕' },
  { w: 'Dino', e: '🦖' }, { w: 'Delfin', e: '🐬' }, { w: 'Drache', e: '🐉' },
  { w: 'Elefant', e: '🐘' }, { w: 'Ente', e: '🦆' }, { w: 'Erdbeere', e: '🍓' }, { w: 'Ei', e: '🥚', anlaut: false }, { w: 'Eis', e: '🍦', anlaut: false },
  { w: 'Fisch', e: '🐟' }, { w: 'Frosch', e: '🐸' }, { w: 'Fuchs', e: '🦊' }, { w: 'Flugzeug', e: '✈️' },
  { w: 'Giraffe', e: '🦒' }, { w: 'Gurke', e: '🥒' }, { w: 'Geschenk', e: '🎁' }, { w: 'Gitarre', e: '🎸' },
  { w: 'Haus', e: '🏠' }, { w: 'Hase', e: '🐰' }, { w: 'Hund', e: '🐶' }, { w: 'Hai', e: '🦈' }, { w: 'Hut', e: '🎩' },
  { w: 'Igel', e: '🦔' }, { w: 'Insel', e: '🏝️' },
  { w: 'Kuchen', e: '🍰' }, { w: 'Katze', e: '🐱' }, { w: 'Käse', e: '🧀' }, { w: 'Kuh', e: '🐮' }, { w: 'Krone', e: '👑' },
  { w: 'Löwe', e: '🦁' }, { w: 'Löffel', e: '🥄' }, { w: 'Lampe', e: '💡' },
  { w: 'Mond', e: '🌙' }, { w: 'Maus', e: '🐭' }, { w: 'Melone', e: '🍉' }, { w: 'Möhre', e: '🥕' },
  { w: 'Nase', e: '👃' }, { w: 'Nudeln', e: '🍝' },
  { w: 'Oma', e: '👵' }, { w: 'Ohr', e: '👂' }, { w: 'Opa', e: '👴' },
  { w: 'Pilz', e: '🍄' }, { w: 'Pinguin', e: '🐧' }, { w: 'Pizza', e: '🍕' },
  { w: 'Rakete', e: '🚀' }, { w: 'Rose', e: '🌹' }, { w: 'Regenbogen', e: '🌈' }, { w: 'Rad', e: '🛞' },
  { w: 'Sonne', e: '☀️' }, { w: 'Socke', e: '🧦' }, { w: 'Stern', e: '⭐', anlaut: false }, { w: 'Schnecke', e: '🐌', anlaut: false },
  { w: 'Tomate', e: '🍅' }, { w: 'Tiger', e: '🐯' }, { w: 'Torte', e: '🎂' },
  { w: 'Uhr', e: '⌚' }, { w: 'Ufo', e: '🛸' },
  { w: 'Vogel', e: '🐦', anlaut: false }, { w: 'Vulkan', e: '🌋', anlaut: false },
  { w: 'Wal', e: '🐳' }, { w: 'Wolke', e: '☁️' }, { w: 'Wurm', e: '🪱' },
  { w: 'Zebra', e: '🦓' }, { w: 'Zug', e: '🚂' }, { w: 'Zitrone', e: '🍋' },
];

const LETTERS = [...'ABDEFGHIKLMNOPRSTUWZ'];
const initial = (w: string) => w[0].toUpperCase().replace('Ä', 'A').replace('Ö', 'O').replace('Ü', 'U');

export function letterTask(level: Level, rnd: Rnd = Math.random): Task {
  const pool = WORDS.filter((x) => x.anlaut !== false);
  if (level === 1) {
    // Welches Bild beginnt mit …?
    const target = pick(pool, rnd);
    const letter = initial(target.w);
    const others = shuffle(pool.filter((x) => initial(x.w) !== letter), rnd).slice(0, 3);
    const opts = withOptions(target.e, others.map((o) => o.e), rnd);
    return {
      prompt: letter,
      say: `Welches Bild beginnt mit ${letter}?`,
      ...opts,
      pictures: true,
      explain: `${target.w} beginnt mit ${letter}.`,
    };
  }
  if (level === 2) {
    // Fehlender Buchstabe
    const long = WORDS.filter((x) => x.w.length >= 4);
    const target = pick(long, rnd);
    const pos = int(1, target.w.length - 1, rnd);
    const missing = target.w[pos];
    const gap = `${target.w.slice(0, pos)}_${target.w.slice(pos + 1)}`;
    const abc = [...'aeiounrstlmdbkghfpwz'].filter((c) => c !== missing.toLowerCase());
    const opts = withOptions(missing, shuffle(abc, rnd).slice(0, 3), rnd);
    return {
      prompt: gap,
      say: `Welcher Buchstabe fehlt bei ${target.w}?`,
      ...opts,
      visual: { k: 'picture', e: target.e },
      explain: `Richtig heißt es: ${target.w}.`,
    };
  }
  const target = pick(pool, rnd);
  const letter = initial(target.w);
  const others = shuffle(LETTERS.filter((l) => l !== letter), rnd).slice(0, 3);
  return {
    prompt: 'Womit fängt es an?',
    say: `Womit fängt ${target.w} an?`,
    ...withOptions(letter, others, rnd),
    visual: { k: 'picture', e: target.e, word: target.w },
    explain: `${target.w} fängt mit ${letter} an.`,
  };
}

// ───── Uhr ─────

const hour12 = (h: number) => ((h - 1 + 12) % 12) + 1;

/** Uhrzeit so, wie man sie sagt: „halb 4“, „Viertel nach 3“ … */
export function clockWords(h: number, m: number): string {
  const next = hour12(h + 1);
  if (m === 0) return `${hour12(h)} Uhr`;
  if (m === 15) return `Viertel nach ${hour12(h)}`;
  if (m === 30) return `halb ${next}`;
  if (m === 45) return `Viertel vor ${next}`;
  return `${hour12(h)}:${String(m).padStart(2, '0')}`;
}

const digital = (h: number, m: number) => `${hour12(h)}:${String(m).padStart(2, '0')}`;

export function clockTask(level: Level, rnd: Rnd = Math.random): Task {
  const h = int(1, 12, rnd);
  if (level === 0) {
    const label = clockWords(h, 0);
    const others = shuffle([hour12(h + 1), hour12(h - 1), hour12(h + 3), hour12(h + 6), hour12(h - 2)], rnd).map((x) => clockWords(x, 0));
    return { prompt: 'Wie spät ist es?', say: 'Wie spät ist es?', ...withOptions(label, others, rnd), visual: { k: 'clock', h, m: 0 }, explain: 'Der kurze Zeiger zeigt die Stunde. Der lange steht oben auf der 12.' };
  }
  if (level === 1) {
    const m = pick([0, 15, 30, 45], rnd);
    const label = clockWords(h, m);
    const cand = [
      clockWords(h, (m + 15) % 60),
      clockWords(h, (m + 30) % 60),
      clockWords(hour12(h + 1), m),
      clockWords(hour12(h - 1), m),
      clockWords(h, (m + 45) % 60),
    ];
    return {
      prompt: 'Wie spät ist es?',
      say: 'Wie spät ist es?',
      ...withOptions(label, shuffle(cand, rnd), rnd),
      visual: { k: 'clock', h, m },
      explain: m === 30 ? 'Halb heißt: eine halbe Stunde bis zur nächsten vollen Stunde.' : 'Der lange Zeiger zeigt die Minuten: unten ist halb, rechts Viertel nach, links Viertel vor.',
    };
  }
  const m = int(0, 11, rnd) * 5;
  const label = digital(h, m);
  const cand = [digital(h, (m + 5) % 60), digital(h, (m + 55) % 60), digital(hour12(h + 1), m), digital(hour12(m / 5 || 12), h * 5 === 60 ? 0 : (h * 5) % 60)];
  return {
    prompt: 'Wie spät ist es?',
    say: 'Wie spät ist es?',
    ...withOptions(label, shuffle(cand, rnd), rnd),
    visual: { k: 'clock', h, m },
    explain: 'Jede Zahl auf der Uhr sind 5 Minuten für den langen Zeiger.',
  };
}

export function makeTask(subject: Subject, level: Level, rnd: Rnd = Math.random): Task {
  return subject === 'rechnen' ? mathTask(level, rnd) : subject === 'buchstaben' ? letterTask(level, rnd) : clockTask(level, rnd);
}
