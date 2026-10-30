import { pick, type Rnd } from './util';

/** `dino` gibt es nicht mehr zur Auswahl (jetzt Bär) – bleibt nur, damit alte Spielstände noch gezeichnet werden. */
export type AvatarKind = 'fuchs' | 'frosch' | 'loewe' | 'panda' | 'katze' | 'eule' | 'hase' | 'baer' | 'dino' | 'robo';

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
  { kind: 'baer', name: 'Bär', f: false, emoji: '🐻' },
];

export const ROBO: AnimalInfo = { kind: 'robo', name: 'Robo', f: false, emoji: '🤖' };

export const animalInfo = (kind: AvatarKind): AnimalInfo => ANIMALS.find((a) => a.kind === kind) ?? ROBO;

/** Lieblingsfarben (Hintergrund des Avatars) – kräftig genug, dass man sie im Spiel gut auseinanderhält */
export const COLORS = [
  { hex: '#FFB066', name: 'Orange' },
  { hex: '#6CC4F5', name: 'Himmel' },
  { hex: '#5ED6A6', name: 'Minze' },
  { hex: '#FF8FC0', name: 'Rosa' },
  { hex: '#B79CFF', name: 'Flieder' },
  { hex: '#FFDD45', name: 'Zitrone' },
  { hex: '#9BE15D', name: 'Gras' },
  { hex: '#FF8A7A', name: 'Koralle' },
];

/** Die früheren, blassen Farben → ihre kräftige Version */
const OLD_COLORS: Record<string, string> = {
  '#F6D3B8': '#FFB066',
  '#DCE9F3': '#6CC4F5',
  '#DDEBDD': '#5ED6A6',
  '#F3DCE6': '#FF8FC0',
  '#E9E1F0': '#B79CFF',
  '#F7EDC8': '#FFDD45',
};

export const upgradeColor = (hex: string): string => OLD_COLORS[hex?.toUpperCase()] ?? hex;

export const ADJECTIVES = ['Flink', 'Mutig', 'Schlau', 'Lustig', 'Wild', 'Fröhlich', 'Stark', 'Klein', 'Bunt', 'Fix', 'Kühn', 'Frech'];

export function generatedName(adj: string, kind: AvatarKind): string {
  const a = animalInfo(kind);
  return `${adj}${a.f ? 'e' : 'er'} ${a.name}`;
}

/** Aus dem Dino wird ein Bär – auch im Namen („Flinker Dino“ → „Flinker Bär“). */
export function upgradeAnimal(kind: AvatarKind, name: string): { kind: AvatarKind; name: string } {
  if (kind !== 'dino') return { kind, name };
  const adj = ADJECTIVES.find((x) => name.trim() === `${x}er Dino`);
  return { kind: 'baer', name: adj ? generatedName(adj, 'baer') : name };
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

/** Enthält der Text ein Schimpfwort? (Satzzeichen und Großschreibung werden ignoriert) */
export const isRude = (text: string) => {
  const folded = text.toLowerCase().replace(/[^a-zäöüß]/g, '');
  return BAD.some((w) => folded.includes(w));
};

export function nameProblem(raw: string): string | null {
  const name = raw.trim();
  if (name.length < 2) return 'Dein Name braucht mindestens 2 Buchstaben.';
  if (name.length > NAME_MAX) return `Höchstens ${NAME_MAX} Zeichen.`;
  if (isRude(name)) return 'Such dir bitte einen netten Namen aus.';
  if (/\d{4,}|@|https?:/i.test(name)) return 'Bitte keine Telefonnummern, E-Mails oder Links.';
  return null;
}

export function isGeneratedName(name: string): boolean {
  return ADJECTIVES.some((adj) => ANIMALS.some((a) => generatedName(adj, a.kind) === name.trim()));
}
