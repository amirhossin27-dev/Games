/** Joys eigene Stimmen: neuronale Piper-Stimmen (CC0), die direkt auf dem Gerät rechnen. */
export interface OwnVoice {
  id: string;
  name: string;
  desc: string;
  /** Dateiname unter public/voice/models (ohne .onnx) */
  file: string;
  /** Download-Größe in MB */
  mb: number;
}

export const OWN_VOICES: OwnVoice[] = [
  { id: 'joy:kerstin', name: 'Kerstin', desc: 'Frauenstimme', file: 'de_DE-kerstin-low', mb: 63 },
  { id: 'joy:thorsten', name: 'Thorsten', desc: 'Männerstimme', file: 'de_DE-thorsten-medium', mb: 63 },
];

export const DEFAULT_OWN_VOICE = OWN_VOICES[0].id;

export const isOwnVoice = (id: string | undefined): boolean => !!id && id.startsWith('joy:');
export const ownVoice = (id: string): OwnVoice => OWN_VOICES.find((v) => v.id === id) ?? OWN_VOICES[0];

/** Wörter, die eSpeak falsch ausspricht (englische Namen) */
const LEXICON: [RegExp, string][] = [
  [/\bJoyboy\b/gi, 'Dschoiboi'],
  [/\bJoys\b/g, 'Dschois'],
  [/\bJoy\b/g, 'Dschoi'],
  [/\bTic-Tac-Toe\b/gi, 'Tick-Tack-To'],
  [/\bOnline\b/gi, 'Onlein'],
  [/\bPong\b/g, 'Pongg'],
];

export const pronounce = (text: string): string => LEXICON.reduce((t, [re, to]) => t.replace(re, to), text);
