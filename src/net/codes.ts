/**
 * Zimmer-Code aus vier Tieren – zum Vorlesen, auch für Kinder, die noch nicht lesen können.
 * Jedes Tier steht für eine Hex-Ziffer; in der Datenbank heißt das Zimmer z. B. „0a3f“.
 */

export const CODE_ANIMALS: { e: string; name: string }[] = [
  { e: '🦊', name: 'Fuchs' },
  { e: '🐸', name: 'Frosch' },
  { e: '🦁', name: 'Löwe' },
  { e: '🐼', name: 'Panda' },
  { e: '🐱', name: 'Katze' },
  { e: '🦉', name: 'Eule' },
  { e: '🐰', name: 'Hase' },
  { e: '🦖', name: 'Dino' },
  { e: '🐻', name: 'Bär' },
  { e: '🐧', name: 'Pinguin' },
  { e: '🐘', name: 'Elefant' },
  { e: '🐵', name: 'Affe' },
  { e: '🐢', name: 'Schildkröte' },
  { e: '🐳', name: 'Wal' },
  { e: '🐝', name: 'Biene' },
  { e: '🦄', name: 'Einhorn' },
];

export const CODE_LEN = 4;

export const isCode = (code: string) => /^[0-9a-f]{4}$/.test(code);

export const codeAnimals = (code: string) => [...code].map((c) => CODE_ANIMALS[parseInt(c, 16)]);

export const codeWords = (code: string) => codeAnimals(code).map((a) => a.name).join(', ');

export const codeFromIndexes = (idx: number[]) => idx.map((i) => i.toString(16)).join('');

export function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(2));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Link zum Mitspielen, z. B. …/Games/#zimmer=0a3f */
export const roomLink = (code: string) => `${location.origin}${location.pathname}#zimmer=${code}`;
