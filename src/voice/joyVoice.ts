import { useSyncExternalStore } from 'react';
import { ownVoice, pronounce } from './catalog';
import type { FromWorker, ToWorker } from './worker';

/**
 * Joys eigene Stimme – Steuerung im Hauptprogramm: Worker starten, Sätze anfordern und der Reihe
 * nach abspielen. Fertige Sätze bleiben im Speicher, damit Wiederholungen sofort kommen.
 */

export type VoiceStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface VoiceState {
  voice: string | null;
  status: VoiceStatus;
  /** Download-Fortschritt 0–1 (nur, wenn wirklich geladen wird) */
  progress: number;
  downloading: boolean;
}

/** Gleicher Name wie im Worker */
const CACHE = 'joyboy-voice-v1';

let state: VoiceState = { voice: null, status: 'idle', progress: 0, downloading: false };
const listeners = new Set<() => void>();
const set = (patch: Partial<VoiceState>) => {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
};
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const useJoyVoice = () => useSyncExternalStore(subscribe, () => state, () => state);
export const joyVoiceState = () => state;

/** Für Hinweise in der App (Download beginnt, Stimme ist bereit, Fehler) */
type VoiceEvent = 'download' | 'ready' | 'error';
const eventListeners = new Set<(e: VoiceEvent) => void>();
export function onVoiceEvent(fn: (e: VoiceEvent) => void): () => void {
  eventListeners.add(fn);
  return () => eventListeners.delete(fn);
}
const emit = (e: VoiceEvent) => eventListeners.forEach((fn) => fn(e));

export const ownVoiceSupported = () => typeof window !== 'undefined' && typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined' && !!(window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);

const base = () => new URL('voice/', document.baseURI).href;
const modelUrl = (voice: string) => `${base()}models/${ownVoice(voice).file}.onnx`;

/** Ist die Stimme schon auf dem Gerät? */
export async function isDownloaded(voice: string): Promise<boolean> {
  try {
    const cache = await caches.open(CACHE);
    return !!(await cache.match(modelUrl(voice)));
  } catch {
    return false;
  }
}

// ───────── Worker ─────────

let worker: Worker | null = null;
let ready: Promise<void> | null = null;
let nextId = 1;
const waiting = new Map<number, { resolve: (b: AudioBuffer | null) => void }>();

function handle(m: FromWorker) {
  if (m.t === 'progress') {
    if (!state.downloading) {
      set({ downloading: true });
      emit('download');
      void navigator.storage?.persist?.().catch(() => undefined);
    }
    set({ progress: m.total ? m.loaded / m.total : 0 });
  } else if (m.t === 'audio') {
    const w = waiting.get(m.id);
    waiting.delete(m.id);
    const ctx = audioCtx();
    if (!w || !ctx) return w?.resolve(null);
    const buf = ctx.createBuffer(1, m.pcm.length, m.rate);
    buf.getChannelData(0).set(m.pcm);
    w.resolve(buf);
  } else if (m.t === 'failed') {
    waiting.get(m.id)?.resolve(null);
    waiting.delete(m.id);
  }
}

/** Stimme laden (beim ersten Mal ca. 63 MB, danach aus dem Gerätespeicher) */
export function prepare(voice: string): Promise<void> {
  if (!ownVoiceSupported()) return Promise.reject(new Error('nicht unterstützt'));
  if (ready && state.voice === voice) return ready;
  worker?.terminate();
  waiting.forEach((w) => w.resolve(null));
  waiting.clear();
  memo.clear();
  const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  worker = w;
  set({ voice, status: 'loading', progress: 0, downloading: false });
  ready = new Promise<void>((resolve, reject) => {
    w.onmessage = (e: MessageEvent<FromWorker>) => {
      const m = e.data;
      if (m.t === 'ready') {
        const wasDownloading = state.downloading;
        set({ status: 'ready', progress: 1, downloading: false });
        if (wasDownloading) emit('ready');
        resolve();
      } else if (m.t === 'error') {
        set({ status: 'error', downloading: false });
        emit('error');
        ready = null;
        reject(new Error(m.message));
      } else handle(m);
    };
    w.onerror = () => {
      set({ status: 'error', downloading: false });
      ready = null;
      reject(new Error('Worker'));
    };
  });
  const msg: ToWorker = { t: 'load', base: base(), file: ownVoice(voice).file };
  w.postMessage(msg);
  return ready;
}

// ───────── Abspielen ─────────

let audio: AudioContext | null = null;

function audioCtx(): AudioContext | null {
  if (!audio) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    audio = new AC();
  }
  if (audio.state === 'suspended') void audio.resume().catch(() => undefined);
  return audio;
}

// iOS gibt Ton erst nach einer Berührung frei – beim ersten Tippen aufwecken.
if (typeof window !== 'undefined') {
  const wake = () => {
    // Vorlesen soll auch bei stummgeschaltetem iPhone zu hören sein (wie die Sprachausgabe vorher)
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'playback';
    audioCtx();
    window.removeEventListener('pointerdown', wake, true);
    window.removeEventListener('keydown', wake, true);
  };
  window.addEventListener('pointerdown', wake, true);
  window.addEventListener('keydown', wake, true);
}

/** Fertige Sätze (Stimme + Text → Audio), damit Tutorials beim zweiten Mal sofort sprechen */
const memo = new Map<string, Promise<AudioBuffer | null>>();
const MEMO_MAX = 80;

function request(text: string): Promise<AudioBuffer | null> {
  const key = text;
  const hit = memo.get(key);
  if (hit) {
    memo.delete(key);
    memo.set(key, hit);
    return hit;
  }
  const id = nextId++;
  const p = new Promise<AudioBuffer | null>((resolve) => waiting.set(id, { resolve }));
  const msg: ToWorker = { t: 'say', id, text };
  worker?.postMessage(msg);
  // Fehlgeschlagene Sätze nicht merken
  void p.then((b) => b || memo.delete(key));
  memo.set(key, p);
  while (memo.size > MEMO_MAX) memo.delete(memo.keys().next().value!);
  return p;
}

let gen = 0;
let playing: AudioBufferSourceNode | null = null;
let pending: { parts: string[]; voice: string; at: number } | null = null;

function play(buf: AudioBuffer, myGen: number): Promise<void> {
  return new Promise((resolve) => {
    const ctx = audioCtx();
    if (!ctx || myGen !== gen) return resolve();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.onended = () => {
      if (playing === src) playing = null;
      resolve();
    };
    playing = src;
    src.start();
  });
}

/** Lange Sätze an Komma oder Doppelpunkt teilen: Der erste Teil ist schneller fertig. */
export function chunk(sentence: string, max = 70): string[] {
  if (sentence.length <= max) return [sentence];
  const out: string[] = [];
  let rest = sentence;
  while (rest.length > max) {
    const cut = Math.max(rest.lastIndexOf(', ', max), rest.lastIndexOf(': ', max));
    if (cut < 20) break;
    out.push(rest.slice(0, cut + 1));
    rest = rest.slice(cut + 2);
  }
  out.push(rest);
  return out;
}

async function speakParts(parts: string[], myGen: number) {
  // Alle Teile gleich anfordern – der Worker rechnet, während der erste schon läuft
  const bufs = parts.flatMap((p) => chunk(p)).map((p) => request(pronounce(p)));
  for (const b of bufs) {
    const buf = await b;
    if (myGen !== gen) return;
    if (buf) await play(buf, myGen);
  }
}

/** Sätze vorlesen. Ist die Stimme noch nicht geladen, kommt der Text, sobald sie bereit ist. */
export function say(parts: string[], voice: string) {
  stop();
  if (!parts.length || !ownVoiceSupported()) return;
  const myGen = gen;
  if (state.voice !== voice || state.status !== 'ready') {
    pending = { parts, voice, at: Date.now() };
    prepare(voice)
      .then(() => {
        // Nur nachholen, wenn seitdem nichts anderes gesagt wurde und es noch passt
        if (pending && myGen === gen && Date.now() - pending.at < 20000) void speakParts(pending.parts, gen);
        pending = null;
      })
      .catch(() => undefined);
    return;
  }
  void speakParts(parts, myGen);
}

export function stop() {
  gen++;
  pending = null;
  try {
    playing?.stop();
  } catch {
    // schon zu Ende
  }
  playing = null;
  const msg: ToWorker = { t: 'cancel', before: nextId };
  worker?.postMessage(msg);
}
