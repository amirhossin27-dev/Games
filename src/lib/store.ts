import { useSyncExternalStore } from 'react';
import type { AvatarKind } from './names';
import { dayKey, randomId, weekKey } from './util';

/**
 * Alle dauerhaften Daten der App liegen im Browser (localStorage) – Profile, Spielstände,
 * Einstellungen und das Eltern-Passwort (nur als Hash). Die Spielzeit hat einen eigenen,
 * kleinen Speicher (playtime.ts), weil sie jede Sekunde tickt.
 */

/** 0 = 4–5 Jahre, 1 = 6–7, 2 = 8–9, 3 = 10+ */
export type AgeGroup = 0 | 1 | 2 | 3;
/** 0 = leicht, 1 = mittel, 2 = schwer */
export type Level = 0 | 1 | 2;

export const AGE_LABEL: Record<AgeGroup, string> = { 0: '4–5', 1: '6–7', 2: '8–9', 3: '10+' };
export const LEVEL_LABEL: Record<Level, string> = { 0: 'Leicht', 1: 'Mittel', 2: 'Schwer' };

export const levelForAge = (age: AgeGroup): Level => (age === 0 ? 0 : age === 1 ? 0 : age === 2 ? 1 : 2);

export interface GameStat {
  played: number;
  won: number;
  /** Rekord (Punkte, Züge oder Sekunden – je nach Spiel) */
  best?: number;
  /** Beste Wertung 0–3 Sterne */
  stars: number;
}

export interface Counters {
  /** Richtig gelöste Aufgaben je Fach */
  math: number;
  letters: number;
  clock: number;
  world: number;
  words: number;
  english: number;
  /** Spiele mit anderen Kindern */
  together: number;
  /** Siege in Logik-Spielen */
  logicWins: number;
  /** Neue Rekorde */
  records: number;
}

export interface Profile {
  id: string;
  name: string;
  avatar: AvatarKind;
  color: string;
  age: AgeGroup;
  createdAt: number;
  stars: number;
  games: Record<string, GameStat>;
  counters: Counters;
  /** Spiele, deren Tutorial bis zum Ende angeschaut wurde (zählt fürs Abzeichen) */
  tutorials: string[];
  /** Früher: übersprungene Tutorials. Wird nicht mehr genutzt (Tutorials kommen nur noch auf Wunsch), bleibt für alte Spielstände. */
  skipped: string[];
  badges: string[];
  week: { id: string; stars: number };
  /** Kinder, mit denen schon online gespielt wurde (Cloud-ID → Anzeige) */
  friends: Record<string, Friend>;
  /** Heute gespielte Lernspiele – schalten die Arcade-Spiele frei (unlock.ts) */
  learnDay: { date: string; count: number };
  /** Letzte Änderung – entscheidet beim Abgleich mit der Cloud */
  updatedAt: number;
}

export interface Friend {
  name: string;
  avatar: AvatarKind;
  color: string;
}

export interface Settings {
  sound: boolean;
  /** auto = für 4–7-Jährige automatisch vorlesen */
  speech: 'auto' | 'on' | 'off';
  /** Nur Namen aus dem Namens-Würfel erlauben */
  onlyGeneratedNames: boolean;
  /** Arcade-Spiele erst nach so vielen Lernspielen am Tag (0 = aus, fehlt = Standard aus unlock.ts) */
  arcadeAfter?: number;
  /** Online-Funktionen von den Eltern erlaubt (fehlt = aus, siehe net/consent.ts) */
  online?: boolean;
}

export interface ParentLock {
  salt: string;
  hash: string;
  /** Notfall-Code, falls das Passwort vergessen wurde */
  rsalt: string;
  rhash: string;
}

export interface AppData {
  v: 1;
  profiles: Profile[];
  active: string | null;
  settings: Settings;
  parent: ParentLock | null;
}

const KEY = 'joyboy:data:v1';

export const emptyCounters = (): Counters => ({ math: 0, letters: 0, clock: 0, world: 0, words: 0, english: 0, together: 0, logicWins: 0, records: 0 });

export function newProfile(p: Pick<Profile, 'name' | 'avatar' | 'color' | 'age'>): Profile {
  return {
    id: randomId(12),
    ...p,
    name: p.name.trim(),
    createdAt: Date.now(),
    stars: 0,
    games: {},
    counters: emptyCounters(),
    tutorials: [],
    skipped: [],
    badges: [],
    week: { id: weekKey(), stars: 0 },
    friends: {},
    learnDay: { date: dayKey(), count: 0 },
    updatedAt: Date.now(),
  };
}

function defaults(): AppData {
  return { v: 1, profiles: [], active: null, settings: { sound: true, speech: 'auto', onlyGeneratedNames: false }, parent: null };
}

function fixProfile(p: Profile): Profile {
  return {
    ...p,
    games: p.games ?? {},
    counters: { ...emptyCounters(), ...p.counters },
    tutorials: p.tutorials ?? [],
    skipped: p.skipped ?? [],
    badges: p.badges ?? [],
    week: p.week ?? { id: weekKey(), stars: 0 },
    friends: p.friends ?? {},
    learnDay: p.learnDay ?? { date: dayKey(), count: 0 },
    updatedAt: p.updatedAt ?? p.createdAt ?? 0,
  };
}

export const normalizeProfile = fixProfile;

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const d = JSON.parse(raw) as Partial<AppData>;
    const base = defaults();
    const profiles = Array.isArray(d.profiles) ? d.profiles.map(fixProfile) : [];
    return {
      v: 1,
      profiles,
      active: profiles.some((p) => p.id === d.active) ? (d.active ?? null) : null,
      settings: { ...base.settings, ...d.settings },
      parent: d.parent ?? null,
    };
  } catch {
    return defaults();
  }
}

let data: AppData = typeof localStorage === 'undefined' ? defaults() : load();
const listeners = new Set<() => void>();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Speicher voll oder gesperrt (privates Fenster) – die App läuft trotzdem weiter.
  }
}

export function getData(): AppData {
  return data;
}

/**
 * Neuen Stand übernehmen. Geänderte Profile bekommen einen neuen Zeitstempel – außer beim
 * Übernehmen aus der Cloud (`keepStamps`), da gilt der Zeitstempel von dort.
 */
export function setData(next: AppData, keepStamps = false) {
  if (!keepStamps) {
    const before = new Map(data.profiles.map((p) => [p.id, p]));
    const now = Date.now();
    next = { ...next, profiles: next.profiles.map((p) => (before.get(p.id) === p ? p : { ...p, updatedAt: Math.max(now, (before.get(p.id)?.updatedAt ?? 0) + 1) })) };
  }
  data = next;
  save();
  listeners.forEach((l) => l());
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useData(): AppData {
  return useSyncExternalStore(subscribe, getData, getData);
}

export function activeProfile(d: AppData = data): Profile | null {
  return d.profiles.find((p) => p.id === d.active) ?? null;
}

export function useProfile(): Profile | null {
  return activeProfile(useData());
}

export function updateProfile(id: string, fn: (p: Profile) => Profile) {
  setData({ ...data, profiles: data.profiles.map((p) => (p.id === id ? fn(p) : p)) });
}

export const actions = {
  addProfile(p: Pick<Profile, 'name' | 'avatar' | 'color' | 'age'>): Profile {
    const profile = newProfile(p);
    setData({ ...data, profiles: [...data.profiles, profile], active: profile.id });
    return profile;
  },
  setActive(id: string | null) {
    setData({ ...data, active: id });
  },
  removeProfile(id: string) {
    const profiles = data.profiles.filter((p) => p.id !== id);
    setData({ ...data, profiles, active: data.active === id ? null : data.active });
  },
  editProfile(id: string, changes: Partial<Pick<Profile, 'name' | 'avatar' | 'color' | 'age'>>) {
    updateProfile(id, (p) => ({ ...p, ...changes }));
  },
  settings(changes: Partial<Settings>) {
    setData({ ...data, settings: { ...data.settings, ...changes } });
  },
  setParent(lock: ParentLock | null) {
    setData({ ...data, parent: lock });
  },
};

/** Für die Arcade-Spiele aus Arta */
export const soundOn = () => data.settings.sound;
