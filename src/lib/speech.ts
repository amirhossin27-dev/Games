import { activeProfile, getData } from './store';

/**
 * Joy liest vor – über die Sprachausgabe des Geräts. Geräte bringen sehr unterschiedliche Stimmen mit:
 * von roboterhaft (eSpeak, alte Windows-Stimmen, Apple-„Eloquence“) bis fast menschlich
 * (Apple Premium, Edge „Natural“, Google). Joyboy bewertet alle deutschen Stimmen und nimmt die
 * natürlichste – Eltern können im Elternbereich auch selbst eine wählen.
 */

export type VoiceQuality = 'natural' | 'good' | 'basic';

export interface VoiceInfo {
  id: string;
  name: string;
  quality: VoiceQuality;
  /** Stimme kommt über das Internet (Google, Microsoft) */
  online: boolean;
  score: number;
  voice: SpeechSynthesisVoice;
}

// Apples Spaß- und Retro-Stimmen klingen bewusst künstlich
const ROBOTIC = /eloquence|espeak|\b(eddy|flo|grandma|grandpa|oma|opa|reed|rocko|sandy|shelley|albert|zarvox|trinoids|whisper|wobble|bahh|bells|boing|bubbles|cellos|jester|organ|superstar)\b/i;
const NATURAL = /natural|neural|wavenet|studio|journey|chirp|polyglot/i;
const FRIENDLY = /\b(anna|helena|petra|vicki|marlene|seraphina|amala|katja|louisa|tanja)\b/i;

export function rateVoice(v: Pick<SpeechSynthesisVoice, 'name' | 'voiceURI' | 'lang' | 'localService' | 'default'>): number {
  const id = `${v.name} ${v.voiceURI}`;
  let score = 0;
  if (/premium/i.test(id)) score += 60;
  else if (/enhanced|erweitert|verbessert/i.test(id)) score += 45;
  if (NATURAL.test(id)) score += 55;
  if (/google/i.test(v.name) && !v.localService) score += 40;
  if (/compact/i.test(v.voiceURI)) score -= 15;
  // Alte Windows-Stimmen (Hedda, Katja, Stefan ohne „Online“)
  if (/^microsoft/i.test(v.name) && !/online|natural/i.test(v.name)) score -= 20;
  if (ROBOTIC.test(id)) score -= 60;
  const lang = v.lang.replace('_', '-').toLowerCase();
  if (lang === 'de-de') score += 5;
  else if (lang.startsWith('de-')) score += 2;
  if (FRIENDLY.test(v.name)) score += 3;
  if (v.default) score += 2;
  return score;
}

const qualityOf = (score: number): VoiceQuality => (score >= 35 ? 'natural' : score >= -10 ? 'good' : 'basic');

/** Name ohne Zusätze wie „Microsoft …“, „(Deutsch (Deutschland))“ oder „- German (Germany)“ */
function shortName(v: SpeechSynthesisVoice): string {
  const n = v.name
    .replace(/^(microsoft|google|apple)\s+/i, (m) => (/google/i.test(m) ? 'Google ' : ''))
    .replace(/\s*[-–]\s*(german|deutsch).*$/i, '')
    .replace(/\s*\((deutsch|german)[^)]*\)+\s*$/i, '')
    .replace(/\s*\(natural\)/i, '')
    .replace(/\s+online\b/i, '')
    .trim();
  return n || v.name;
}

let cache: VoiceInfo[] | null = null;
const listeners = new Set<() => void>();

export function germanVoices(): VoiceInfo[] {
  if (cache?.length) return cache;
  const all = speechAvailable() ? window.speechSynthesis.getVoices() : [];
  cache = all
    .filter((v) => v.lang?.toLowerCase().replace('_', '-').startsWith('de'))
    .map((v) => {
      const score = rateVoice(v);
      return { id: v.voiceURI || v.name, name: shortName(v), quality: qualityOf(score), online: !v.localService, score, voice: v };
    })
    .sort((a, b) => b.score - a.score);
  return cache;
}

/** Bescheid geben, sobald der Browser seine Stimmen geladen hat (Chrome lädt sie nach). */
export function onVoicesChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    cache = null;
    listeners.forEach((fn) => fn());
  });
}

export const speechAvailable = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Gewählte Stimme aus dem Elternbereich, sonst die natürlichste */
export function currentVoice(): VoiceInfo | null {
  const list = germanVoices();
  const want = getData().settings.voice;
  return (want && list.find((v) => v.id === want)) || list[0] || null;
}

/** Satzweise vorlesen: klingt natürlicher und umgeht Abbrüche bei langen Texten (Chrome). */
export function sentences(text: string): string[] {
  const clean = text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/\s+[–—]\s+/g, ', ')
    .replace(/…/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
  return (clean.match(/[^.!?]+[.!?]*/g) ?? []).map((s) => s.trim()).filter((s) => /[\p{L}\p{N}]/u.test(s));
}

export function speak(text: string, voiceId?: string) {
  if (!speechAvailable() || !text) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const v = voiceId ? germanVoices().find((x) => x.id === voiceId) ?? currentVoice() : currentVoice();
    for (const part of sentences(text)) {
      const u = new SpeechSynthesisUtterance(part);
      u.lang = v?.voice.lang ?? 'de-DE';
      if (v) u.voice = v.voice;
      // Natürliche Stimmen nicht verbiegen: normale Tonhöhe, nur etwas ruhiger für Kinder
      u.rate = 0.95;
      u.pitch = 1;
      synth.speak(u);
    }
  } catch {
    // Keine Sprachausgabe – der Text steht ja auch da.
  }
}

export function stopSpeaking() {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // ignorieren
  }
}

/** Soll Joy von selbst vorlesen? (Einstellung im Elternbereich, „auto“ = für 4–7-Jährige.) */
export function autoSpeak(): boolean {
  const d = getData();
  if (d.settings.speech === 'off') return false;
  if (d.settings.speech === 'on') return true;
  const p = activeProfile(d);
  return !!p && p.age <= 1;
}

export function speakIfAuto(text: string) {
  if (autoSpeak()) speak(text);
}

export type Platform = 'ios' | 'mac' | 'android' | 'windows' | 'other';

export function platform(): Platform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Mac OS X/.test(ua)) return 'mac';
  if (/Windows/.test(ua)) return 'windows';
  return 'other';
}
