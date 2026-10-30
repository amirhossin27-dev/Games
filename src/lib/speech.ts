import { activeProfile, getData } from './store';

/** Joy liest vor – über die Sprachausgabe des Browsers (deutsche Stimme, wenn vorhanden). */

/**
 * Hauptschalter für Joys Stimme. Vorerst aus, bis die Stimme überarbeitet ist.
 * Auf `true` setzen, dann sind Vorlesen, Lautsprecher-Knöpfe und die Einstellung im Elternbereich wieder da.
 */
export const VOICE_ENABLED = false;

let voice: SpeechSynthesisVoice | null | undefined;

function germanVoice(): SpeechSynthesisVoice | null {
  if (voice !== undefined && voice !== null) return voice;
  const all = window.speechSynthesis?.getVoices() ?? [];
  const de = all.filter((v) => v.lang?.toLowerCase().startsWith('de'));
  voice = de.find((v) => /anna|helena|petra|katja|google/i.test(v.name)) ?? de[0] ?? null;
  return voice;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    voice = undefined;
  });
}

export const speechAvailable = () => VOICE_ENABLED && typeof window !== 'undefined' && 'speechSynthesis' in window;

export function speak(text: string) {
  if (!speechAvailable() || !text) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ''));
    u.lang = 'de-DE';
    const v = germanVoice();
    if (v) u.voice = v;
    u.rate = 0.95;
    u.pitch = 1.1;
    synth.speak(u);
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
  if (!VOICE_ENABLED) return false;
  const d = getData();
  if (d.settings.speech === 'off') return false;
  if (d.settings.speech === 'on') return true;
  const p = activeProfile(d);
  return !!p && p.age <= 1;
}

export function speakIfAuto(text: string) {
  if (autoSpeak()) speak(text);
}
