import { pick, type Rnd } from './util';

export type AvatarKind = 'fuchs' | 'frosch' | 'loewe' | 'panda' | 'katze' | 'eule' | 'hase' | 'dino' | 'robo';

export interface AnimalInfo {
  kind: AvatarKind;
  name: string;
  /** Weiblich → „Flinke Eule“ statt „Flinker Eule“ */
  f: boolean;
  /** Für Spiele, die Spieler als Zeichen auf die Leinwand malen */
  emoji: string;
}

/** Die Tiere, die Kinder sich aussuchen können (Robo ist den Computer-Gegnern vorbehalten). */
export const ANIMALS: AnimalInfo[] = [
  { kind: 'fuchs', name: 'Fuchs', f: false, emoji: '🦊' },
  { kind: 'frosch', name: 'Frosch', f: false, emoji: '🐸' },
  { kind: 'loewe', name: 'Löwe', f: false, emoji: '🦁' },
  { kind: 'panda', name: 'Panda', f: false, emoji: '🐼' },
  { kind: 'katze', name: 'Katze', f: true, emoji: '🐱' },
  { kind: 'eule', name: 'Eule', f: true, emoji: '🦉' },
  { kind: 'hase', name: 'Hase', f: false, emoji: '🐰' },
  { kind: 'dino', name: 'Dino', f: false, emoji: '🦖' },
];

export const ROBO: AnimalInfo = { kind: 'robo', name: 'Robo', f: false, emoji: '🤖' };

export const animalInfo = (kind: AvatarKind): AnimalInfo => ANIMALS.find((a) => a.kind === kind) ?? ROBO;

/** Lieblingsfarben (Hintergrund des Avatars) */
export const COLORS = [
  { hex: '#F6D3B8', name: 'Aprikose' },
  { hex: '#DCE9F3', name: 'Himmel' },
  { hex: '#DDEBDD', name: 'Minze' },
  { hex: '#F3DCE6', name: 'Rosa' },
  { hex: '#E9E1F0', name: 'Flieder' },
  { hex: '#F7EDC8', name: 'Zitrone' },
];

export const ADJECTIVES = ['Flink', 'Mutig', 'Schlau', 'Lustig', 'Wild', 'Fröhlich', 'Stark', 'Klein', 'Bunt', 'Fix', 'Kühn', 'Frech'];

export function generatedName(adj: string, kind: AvatarKind): string {
  const a = animalInfo(kind);
  return `${adj}${a.f ? 'e' : 'er'} ${a.name}`;
}

export function randomName(kind: AvatarKind, rnd: Rnd = Math.random): string {
  return generatedName(pick(ADJECTIVES, rnd), kind);
}

export const NAME_MAX = 16;

/**
 * Kleiner Wortfilter für Spielernamen. Kein Anspruch auf Vollständigkeit – er fängt die
 * üblichen Schimpfwörter ab, damit niemand im Spielzimmer beleidigt wird.
 */
const BAD = ['arsch', 'scheiß', 'scheiss', 'fick', 'fuck', 'shit', 'hure', 'wichser', 'fotze', 'nazi', 'hitler', 'bitch', 'penis', 'vagina', 'sex', 'idiot', 'depp', 'spast', 'behindert', 'schlampe', 'kacke', 'pisse', 'dumm'];

export function nameProblem(raw: string): string | null {
  const name = raw.trim();
  if (name.length < 2) return 'Dein Name braucht mindestens 2 Buchstaben.';
  if (name.length > NAME_MAX) return `Höchstens ${NAME_MAX} Zeichen.`;
  const folded = name.toLowerCase().replace(/[^a-zäöüß]/g, '');
  if (BAD.some((w) => folded.includes(w))) return 'Such dir bitte einen netten Namen aus.';
  if (/\d{4,}|@|https?:/i.test(name)) return 'Bitte keine Telefonnummern, E-Mails oder Links.';
  return null;
}

export function isGeneratedName(name: string): boolean {
  return ADJECTIVES.some((adj) => ANIMALS.some((a) => generatedName(adj, a.kind) === name.trim()));
}
