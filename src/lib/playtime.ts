import { useSyncExternalStore } from 'react';

/**
 * Spielzeit-Limit für Eltern: Ist das eingestellte Kontingent aufgebraucht, sperrt Joyboy für
 * 12 Stunden. Gezählt wird, solange die App sichtbar offen ist (nicht im Elternbereich und nicht
 * auf dem Sperrbildschirm). Ein Kontingent gilt für ein 12-Stunden-Fenster ab der ersten
 * Spielsekunde; danach (oder nach Ablauf einer Sperre) beginnt es von vorn.
 *
 * Die Logik ist bewusst als reine Funktionen gebaut (testbar), darunter liegt ein kleiner
 * Speicher mit eigener Uhr, die – wenn Internet da ist – mit der Serverzeit abgeglichen wird.
 * So hilft es nicht, die Uhr am Gerät vorzustellen.
 */

export const LOCK_MS = 12 * 60 * 60 * 1000;
export const LIMIT_CHOICES = [15, 30, 45, 60, 90, 120];

export interface PlayState {
  /** Minuten pro 12-Stunden-Fenster, `null` = kein Limit */
  limitMin: number | null;
  usedSec: number;
  windowStart: number | null;
  lockedUntil: number | null;
  /** Von Eltern geschenkte Extra-Zeit in diesem Fenster */
  bonusSec: number;
}

export interface PlayStatus {
  locked: boolean;
  /** Restzeit in Sekunden, `null` ohne Limit */
  remainingSec: number | null;
  unlockAt: number | null;
  usedSec: number;
}

export const freshPlay = (limitMin: number | null = null): PlayState => ({ limitMin, usedSec: 0, windowStart: null, lockedUntil: null, bonusSec: 0 });

const budget = (s: PlayState) => (s.limitMin === null ? Infinity : s.limitMin * 60 + s.bonusSec);

/** Abgelaufene Sperre oder abgelaufenes Fenster → neues Kontingent. */
export function normalize(s: PlayState, now: number): PlayState {
  if (s.lockedUntil !== null) return now >= s.lockedUntil ? freshPlay(s.limitMin) : s;
  if (s.windowStart !== null && now - s.windowStart >= LOCK_MS) return freshPlay(s.limitMin);
  return s;
}

export function addPlay(s: PlayState, now: number, sec: number): PlayState {
  const cur = normalize(s, now);
  if (cur.lockedUntil !== null || sec <= 0) return cur;
  const next: PlayState = { ...cur, windowStart: cur.windowStart ?? now, usedSec: cur.usedSec + sec };
  if (next.usedSec >= budget(next)) return { ...next, usedSec: budget(next), lockedUntil: now + LOCK_MS };
  return next;
}

export function statusOf(s: PlayState, now: number): PlayStatus {
  const cur = normalize(s, now);
  const locked = cur.lockedUntil !== null;
  return {
    locked,
    remainingSec: cur.limitMin === null ? null : locked ? 0 : Math.max(0, budget(cur) - cur.usedSec),
    unlockAt: cur.lockedUntil,
    usedSec: cur.usedSec,
  };
}

export function withLimit(s: PlayState, limitMin: number | null, now: number): PlayState {
  const cur = normalize(s, now);
  if (limitMin === null) return { ...cur, limitMin: null, lockedUntil: null };
  const next = { ...cur, limitMin };
  // Neues Limit schon aufgebraucht? Dann greift die Sperre sofort.
  if (next.lockedUntil === null && next.usedSec >= budget(next)) return { ...next, usedSec: budget(next), lockedUntil: now + LOCK_MS };
  return next;
}

/** Eltern heben die Sperre auf und starten ein neues Kontingent. */
export function unlocked(s: PlayState): PlayState {
  return freshPlay(s.limitMin);
}

/** Eltern schenken Extra-Minuten – auch mitten in einer Sperre. */
export function withBonus(s: PlayState, min: number, now: number): PlayState {
  const cur = normalize(s, now);
  const used = cur.usedSec;
  const base = cur.limitMin === null ? used : cur.limitMin * 60;
  const bonusSec = Math.max(cur.bonusSec, used - base) + min * 60;
  return { ...cur, bonusSec, lockedUntil: null, windowStart: cur.windowStart ?? now };
}

// ───── Speicher & Uhr ─────

const KEY = 'joyboy:play:v1';
const OFFSET_KEY = 'joyboy:clock:v1';

interface Stored {
  play: PlayState;
}

function loadPlay(): PlayState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshPlay();
    const s = (JSON.parse(raw) as Stored).play;
    return { ...freshPlay(), ...s };
  } catch {
    return freshPlay();
  }
}

let offset = 0;
try {
  offset = Number(localStorage.getItem(OFFSET_KEY)) || 0;
} catch {
  offset = 0;
}

/** Aktuelle Zeit – mit der Serverzeit verrechnet, wenn sie bekannt ist. */
export const nowMs = () => Date.now() + offset;

let play: PlayState = typeof localStorage === 'undefined' ? freshPlay() : loadPlay();
let snapshot = { play, status: statusOf(play, nowMs()) };
const listeners = new Set<() => void>();

function emit() {
  snapshot = { play, status: statusOf(play, nowMs()) };
  listeners.forEach((l) => l());
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ play } satisfies Stored));
  } catch {
    // ignorieren
  }
}

export function setPlay(next: PlayState) {
  play = next;
  persist();
  emit();
}

export const getPlay = () => play;

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export function usePlaytime() {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

export const playActions = {
  setLimit: (min: number | null) => setPlay(withLimit(play, min, nowMs())),
  unlock: () => setPlay(unlocked(play)),
  bonus: (min: number) => setPlay(withBonus(play, min, nowMs())),
};

/** Serverzeit aus dem Date-Header von GitHub Pages holen (nur wenn online). */
export async function syncServerTime() {
  try {
    const t0 = Date.now();
    const res = await fetch(`./manifest.webmanifest?__time=${t0}`, { method: 'HEAD', cache: 'no-store' });
    const t1 = Date.now();
    const date = res.headers.get('date');
    if (!date) return;
    const server = Date.parse(date);
    if (!Number.isFinite(server)) return;
    offset = server + 500 - (t0 + t1) / 2;
    // Unter einer Minute Abweichung lohnt sich keine Korrektur.
    if (Math.abs(offset) < 60_000) offset = 0;
    localStorage.setItem(OFFSET_KEY, String(Math.round(offset)));
    emit();
  } catch {
    // offline – dann gilt die letzte bekannte Abweichung
  }
}

type Warn = (remainingSec: number) => void;
const warnListeners = new Set<Warn>();
export function onPlayWarning(fn: Warn) {
  warnListeners.add(fn);
  return () => {
    warnListeners.delete(fn);
  };
}

let started = false;

/** Einmal beim App-Start: zählt jede Sekunde, solange `counting()` stimmt und die App sichtbar ist. */
export function startPlaytime(counting: () => boolean) {
  if (started) return;
  started = true;
  void syncServerTime();
  window.setInterval(() => void syncServerTime(), 10 * 60_000);
  window.addEventListener('online', () => void syncServerTime());
  let last = performance.now();
  window.setInterval(() => {
    const t = performance.now();
    const dt = Math.min(5, (t - last) / 1000);
    last = t;
    const before = statusOf(play, nowMs());
    if (document.visibilityState === 'visible' && counting()) {
      const next = addPlay(play, nowMs(), dt);
      if (next !== play) {
        play = next;
        persist();
      }
    } else {
      play = normalize(play, nowMs());
    }
    emit();
    const after = snapshot.status;
    for (const mark of [300, 60]) {
      if (before.remainingSec !== null && after.remainingSec !== null && before.remainingSec > mark && after.remainingSec <= mark && !after.locked) {
        warnListeners.forEach((l) => l(after.remainingSec!));
      }
    }
  }, 1000);
}
