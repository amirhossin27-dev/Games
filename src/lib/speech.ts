import { useSyncExternalStore } from 'react';
import { activeProfile, getData } from './store';
import { planVoice } from './voiceplan';

/**
 * Joy liest vor – mit vorab aufgenommenen Sätzen in public/stimme (erzeugt mit scripts/stimme).
 * Rechenaufgaben und Uhrzeiten werden aus Bausteinen zusammengesetzt (siehe voiceplan.ts).
 * Für Sätze ohne Aufnahme, etwa mit selbst getippten Namen, bleibt Joy still. Der Text steht ja da.
 */

/**
 * Hauptschalter für Joys Stimme. Auf `false` gesetzt verschwinden Vorlesen, Lautsprecher-Knöpfe
 * und die Einstellung im Elternbereich.
 */
export const VOICE_ENABLED = true;

/** Pause zwischen zwei Sätzen und zwischen Bausteinen eines Satzes (Sekunden) */
const SENTENCE_GAP = 0.35;
const PART_GAP = 0.07;

const DIR = `${import.meta.env.BASE_URL}stimme/`;

// ───── Verzeichnis der Aufnahmen ─────

/** Satz → Datei-Name (ohne .mp3). `null`, solange das Verzeichnis noch lädt. */
let clips: Record<string, string> | null = null;
const listeners = new Set<() => void>();
let loading = false;

function loadIndex() {
  if (loading || typeof fetch === 'undefined') return;
  loading = true;
  fetch(`${DIR}index.json`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((i: { clips?: Record<string, string> }) => {
      clips = i.clips ?? {};
      listeners.forEach((f) => f());
      // Wollte Joy schon etwas sagen, bevor das Verzeichnis da war (z. B. die Begrüßung)?
      const w = waiting;
      waiting = null;
      if (w && w.turn === turn) speak(w.text);
    })
    .catch(() => {
      // Offline beim allerersten Start: später noch einmal versuchen
      loading = false;
    });
}

const has = (key: string) => !!clips && key in clips;

/** Gibt es für diesen Text etwas vorzulesen? */
export function canSpeak(text: string | string[]): boolean {
  return VOICE_ENABLED && !!clips && planVoice(text, has).length > 0;
}

/** Für Knöpfe: neu zeichnen, sobald die Aufnahmen bereit sind. */
export function useVoiceReady(): boolean {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    () => clips !== null,
    () => false,
  );
}

// ───── Abspielen ─────

let ctx: AudioContext | undefined;

function audio(): AudioContext | undefined {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return undefined;
    ctx = new AC();
  }
  if (ctx.state !== 'running') void ctx.resume().catch(() => undefined);
  return ctx;
}

if (VOICE_ENABLED && typeof window !== 'undefined') {
  loadIndex();
  // Viele Geräte (vor allem iPhone und iPad) spielen Ton erst nach einer Berührung.
  const wake = () => {
    if (ctx?.state !== 'running') audio();
    if (!clips) loadIndex();
  };
  window.addEventListener('pointerdown', wake, { capture: true, passive: true });
  window.addEventListener('keydown', wake, { capture: true });
}

/** Zuletzt gebrauchte Aufnahmen, schon fertig dekodiert */
const buffers = new Map<string, Promise<AudioBuffer | null>>();

function clip(id: string, c: AudioContext): Promise<AudioBuffer | null> {
  const known = buffers.get(id);
  if (known) {
    buffers.delete(id);
    buffers.set(id, known);
    return known;
  }
  const p = fetch(`${DIR}${id}.mp3`)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
    .then((b) => new Promise<AudioBuffer>((res, rej) => void c.decodeAudioData(b, res, rej)))
    .catch(() => {
      buffers.delete(id);
      return null;
    });
  buffers.set(id, p);
  if (buffers.size > 80) buffers.delete(buffers.keys().next().value as string);
  return p;
}

let playing: AudioBufferSourceNode[] = [];
/** Zählt mit, damit ein neuer Satz einen noch ladenden alten ablöst */
let turn = 0;
/** Satz, der auf das Verzeichnis wartet */
let waiting: { text: string | string[]; turn: number } | null = null;

/** Text vorlesen. Ein Array sind Teile, die einzeln gesucht werden (fehlt einer, wird er übersprungen). */
export function speak(text: string | string[]) {
  stopSpeaking();
  if (!VOICE_ENABLED || typeof window === 'undefined') return;
  if (!clips) {
    waiting = { text, turn };
    loadIndex();
    return;
  }
  const plan = planVoice(text, has);
  if (!plan.length) return;
  const c = audio();
  if (!c) return;
  const my = turn;
  const ids = clips;
  void (async () => {
    const parts = await Promise.all(plan.map((s) => Promise.all(s.map((k) => clip(ids[k], c)))));
    if (my !== turn) return;
    // Direkt nach einer Berührung braucht das Aufwecken einen Moment
    if (c.state !== 'running') await Promise.race([c.resume(), new Promise((r) => setTimeout(r, 300))]).catch(() => undefined);
    if (my !== turn || c.state !== 'running') return;
    let t = c.currentTime + 0.05;
    parts.forEach((sentence, i) => {
      if (i) t += SENTENCE_GAP;
      sentence.forEach((b, j) => {
        if (!b) return;
        if (j) t += PART_GAP;
        const src = c.createBufferSource();
        src.buffer = b;
        src.connect(c.destination);
        src.start(t);
        src.onended = () => {
          playing = playing.filter((p) => p !== src);
        };
        playing.push(src);
        t += b.duration;
      });
    });
  })();
}

export function stopSpeaking() {
  turn++;
  for (const p of playing) {
    try {
      p.stop();
    } catch {
      // schon zu Ende
    }
  }
  playing = [];
}

/** Soll Joy von selbst vorlesen? (Einstellung im Elternbereich, „auto“ = für 4–7-Jährige.) */
export function autoSpeak(): boolean {
  if (!VOICE_ENABLED) return false;
  const d = getData();
  if (d.settings.speech === 'off') return false;
  if (d.settings.speech === 'on') return true;
  const p = activeProfile(d);
  return !!p && p.age <= 1;
}

export function speakIfAuto(text: string | string[]) {
  if (autoSpeak()) speak(text);
}
