import { getData, setData, type Counters, type Profile } from './store';
import { dayKey, weekKey } from './util';

// ───── Level ─────

const LEVEL_AT = [0, 10, 25, 50, 90, 140, 200, 280, 380, 500, 650, 820, 1000, 1250, 1500];
const LEVEL_NAMES = ['Neuling', 'Entdecker', 'Abenteurer', 'Spürnase', 'Profi', 'Könner', 'Meister', 'Champion', 'Held', 'Superheld', 'Legende', 'Weltmeister', 'Joyboy-Star', 'Joyboy-Star', 'Joyboy-Star'];

export interface LevelInfo {
  level: number;
  name: string;
  /** Sterne bis zum nächsten Level */
  toNext: number;
  /** Fortschritt im aktuellen Level 0–1 */
  progress: number;
}

export function levelOf(stars: number): LevelInfo {
  let i = 0;
  while (i + 1 < LEVEL_AT.length && stars >= LEVEL_AT[i + 1]) i++;
  const from = LEVEL_AT[i];
  const to = LEVEL_AT[i + 1] ?? from + 300;
  return { level: i + 1, name: LEVEL_NAMES[i], toNext: Math.max(0, to - stars), progress: Math.min(1, (stars - from) / (to - from)) };
}

// ───── Abzeichen ─────

export type BadgeIcon = 'math' | 'letters' | 'clock' | 'cards' | 'book' | 'users' | 'star' | 'trophy' | 'flame';

export interface Badge {
  id: string;
  name: string;
  text: string;
  icon: BadgeIcon;
  color: string;
  need: number;
  have: (p: Profile) => number;
}

export const BADGES: Badge[] = [
  { id: 'rechen-profi', name: 'Rechen-Profi', text: '50 Rechenaufgaben richtig', icon: 'math', color: '#2F6E9E', need: 50, have: (p) => p.counters.math },
  { id: 'wort-zauberer', name: 'Wort-Zauberer', text: '40 Buchstaben-Aufgaben richtig', icon: 'letters', color: '#8A2F5A', need: 40, have: (p) => p.counters.letters },
  { id: 'uhr-meister', name: 'Uhr-Meister', text: '30 Uhrzeiten richtig gelesen', icon: 'clock', color: '#B5532E', need: 30, have: (p) => p.counters.clock },
  { id: 'gedaechtnis-ass', name: 'Gedächtnis-Ass', text: '10-mal Paare finden gespielt', icon: 'cards', color: '#417A4D', need: 10, have: (p) => p.games.paare?.played ?? 0 },
  { id: 'regel-kenner', name: 'Regel-Kenner', text: '5 Spielregeln gelernt', icon: 'book', color: '#6B5410', need: 5, have: (p) => p.tutorials.length },
  { id: 'teamplayer', name: 'Teamplayer', text: '10 Spiele mit anderen Kindern', icon: 'users', color: '#6E4C86', need: 10, have: (p) => p.counters.together },
  { id: 'strategie-stern', name: 'Strategie-Stern', text: '10 Siege in Logik-Spielen', icon: 'star', color: '#5E4277', need: 10, have: (p) => p.counters.logicWins },
  { id: 'arcade-ass', name: 'Arcade-Ass', text: '5 neue Rekorde', icon: 'trophy', color: '#3D4A66', need: 5, have: (p) => p.counters.records },
  { id: 'tages-held', name: 'Tages-Held', text: '5 Tagesaufgaben geschafft', icon: 'flame', color: '#B5532E', need: 5, have: (p) => p.counters.dailyDone },
];

export function withBadges(p: Profile): { profile: Profile; earned: Badge[] } {
  const earned = BADGES.filter((b) => !p.badges.includes(b.id) && b.have(p) >= b.need);
  if (!earned.length) return { profile: p, earned };
  return { profile: { ...p, badges: [...p.badges, ...earned.map((b) => b.id)] }, earned };
}

// ───── Tagesaufgabe ─────

export type DailyKind = 'math' | 'letters' | 'clock' | 'games' | 'stars' | 'together';

export interface DailyTask {
  kind: DailyKind;
  target: number;
  text: string;
}

const DAILY: DailyTask[] = [
  { kind: 'math', target: 10, text: 'Löse 10 Rechenaufgaben' },
  { kind: 'games', target: 3, text: 'Spiele 3 Spiele' },
  { kind: 'letters', target: 8, text: 'Finde 8 Buchstaben' },
  { kind: 'stars', target: 6, text: 'Sammle 6 Sterne' },
  { kind: 'clock', target: 6, text: 'Lies 6 Uhrzeiten richtig' },
  { kind: 'together', target: 1, text: 'Spiel einmal mit anderen' },
];

export const DAILY_REWARD = 3;

export function dailyTask(date = new Date()): DailyTask {
  const days = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  return DAILY[days % DAILY.length];
}

export function dailyOf(p: Profile): { task: DailyTask; progress: number; done: boolean } {
  const today = dayKey();
  const fresh = p.daily.date !== today;
  return { task: dailyTask(), progress: fresh ? 0 : p.daily.progress, done: fresh ? false : p.daily.done };
}

// ───── Ergebnis eintragen ─────

export type Subject = 'math' | 'letters' | 'clock';

export interface PlayResult {
  profileId: string;
  game: string;
  stars: number;
  /** Mehrspieler: gewonnen (Platz 1 und nicht alle gleich) */
  won: boolean;
  /** Mit anderen Kindern gespielt */
  together: boolean;
  logic: boolean;
  /** Solo-Wertung */
  score?: number;
  lowerIsBetter?: boolean;
  /** Richtige Antworten in Lernspielen */
  correct?: number;
  subject?: Subject;
  /** Lernspiel – zählt fürs Freischalten der Arcade-Spiele */
  learn?: boolean;
}

export interface RecordOutcome {
  newRecord: boolean;
  earned: Badge[];
  dailyDone: boolean;
  starsGained: number;
  levelUp: boolean;
}

export function applyResult(p: Profile, r: PlayResult): { profile: Profile; out: RecordOutcome } {
  const stat = p.games[r.game] ?? { played: 0, won: 0, stars: 0 };
  let newRecord = false;
  let best = stat.best;
  if (r.score !== undefined) {
    const better = best === undefined ? false : r.lowerIsBetter ? r.score < best : r.score > best;
    newRecord = better;
    if (best === undefined || better) best = r.score;
  }
  const counters: Counters = { ...p.counters };
  if (r.subject && r.correct) counters[r.subject] += r.correct;
  if (r.together) counters.together++;
  if (r.logic && r.won) counters.logicWins++;
  if (newRecord) counters.records++;

  // Tagesaufgabe
  const today = dayKey();
  let daily = p.daily.date === today ? { ...p.daily } : { date: today, progress: 0, done: false };
  const task = dailyTask();
  const add: Record<DailyKind, number> = {
    math: r.subject === 'math' ? (r.correct ?? 0) : 0,
    letters: r.subject === 'letters' ? (r.correct ?? 0) : 0,
    clock: r.subject === 'clock' ? (r.correct ?? 0) : 0,
    games: 1,
    stars: r.stars,
    together: r.together ? 1 : 0,
  };
  daily.progress = Math.min(task.target, daily.progress + add[task.kind]);
  let bonus = 0;
  let dailyDone = false;
  if (!daily.done && daily.progress >= task.target) {
    daily = { ...daily, done: true };
    bonus = DAILY_REWARD;
    counters.dailyDone++;
    dailyDone = true;
  }

  const learnDay = p.learnDay.date === today ? { ...p.learnDay } : { date: today, count: 0 };
  if (r.learn) learnDay.count++;

  const gained = r.stars + bonus;
  const week = p.week.id === weekKey() ? { ...p.week, stars: p.week.stars + gained } : { id: weekKey(), stars: gained };
  const next: Profile = {
    ...p,
    stars: p.stars + gained,
    week,
    daily,
    learnDay,
    counters,
    games: { ...p.games, [r.game]: { played: stat.played + 1, won: stat.won + (r.won ? 1 : 0), best, stars: Math.max(stat.stars, r.stars) } },
  };
  const { profile, earned } = withBadges(next);
  return { profile, out: { newRecord, earned, dailyDone, starsGained: gained, levelUp: levelOf(profile.stars).level > levelOf(p.stars).level } };
}

/** Ergebnisse mehrerer Kinder (an einem Gerät) eintragen. */
export function recordResults(results: PlayResult[]): Record<string, RecordOutcome> {
  const d = getData();
  const outs: Record<string, RecordOutcome> = {};
  const profiles = d.profiles.map((p) => {
    const r = results.find((x) => x.profileId === p.id);
    if (!r) return p;
    const { profile, out } = applyResult(p, r);
    outs[p.id] = out;
    return profile;
  });
  setData({ ...d, profiles });
  return outs;
}

/** Tutorial abgeschlossen – kann das Abzeichen „Regel-Kenner“ bringen. */
export function finishTutorial(profileId: string, game: string): Badge[] {
  const d = getData();
  let earned: Badge[] = [];
  const profiles = d.profiles.map((p) => {
    if (p.id !== profileId || p.tutorials.includes(game)) return p;
    const res = withBadges({ ...p, tutorials: [...p.tutorials, game] });
    earned = res.earned;
    return res.profile;
  });
  setData({ ...d, profiles });
  return earned;
}

/** Sterne für Lernspiele nach Trefferquote (mitmachen gibt immer mindestens einen). */
export function starsForRatio(ratio: number): number {
  return ratio >= 0.9 ? 3 : ratio >= 0.7 ? 2 : 1;
}

/** Sterne nach Platz: 1. → 3, 2. → 2, sonst 1; Unentschieden für alle → 2. */
export function starsForPlace(place: number, allTied: boolean): number {
  if (allTied) return 2;
  return place === 1 ? 3 : place === 2 ? 2 : 1;
}

/** Sterne für Solo-Rekordspiele. */
export function starsForScore(score: number, best: number | undefined, lowerIsBetter: boolean, failed = false): number {
  if (failed) return 1;
  if (best === undefined) return 2;
  const better = lowerIsBetter ? score < best : score > best;
  if (better) return 3;
  const close = lowerIsBetter ? score <= best * 1.5 : score >= best * 0.6;
  return close ? 2 : 1;
}
