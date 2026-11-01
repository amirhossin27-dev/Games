/**
 * Sammelt alle Sätze, die Joy in der App vorlesen kann, und schreibt sie nach scripts/stimme/saetze.json.
 * Daraus spricht scripts/stimme/sprechen.py die Tondateien in public/stimme/.
 *
 * Aufruf: npx -y tsx scripts/stimme/saetze.ts
 *
 * Kommen neue Spiele, Fragen oder Hinweise dazu, das Skript erneut laufen lassen und danach
 * sprechen.py starten. Fehlende Sätze liest Joy einfach nicht vor; die App geht trotzdem.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAMES } from '../../src/games/registry';
import { SLF_LETTERS } from '../../src/games/rules/slf';
import { makeTask, type Subject } from '../../src/learn/tasks';
import { numberTask } from '../../src/learn/trace/game';
import { neededKeys } from '../../src/lib/voiceplan';
import { SPRUECHE } from '../../src/lib/sprueche';
import { ARCADE_AFTER_CHOICES } from '../../src/lib/unlock';
import { lockSpeech, tipSpeech } from '../../src/lib/speechtexts';
import { CODE_ANIMALS } from '../../src/net/codes';
import { ROBO_NAMES } from '../../src/net/roomLogic';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

/** Schlüssel → woher der Satz kommt (nur zur Übersicht) */
const keys = new Map<string, Set<string>>();
const add = (src: string, text: string | string[], wholeUpTo = Infinity) => {
  for (const k of neededKeys(text, wholeUpTo)) {
    if (!keys.has(k)) keys.set(k, new Set());
    keys.get(k)!.add(src);
  }
};

// ───── Lernspiele: Fragen, Tipps ─────
let seed = 20261031;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const SUBJECTS: Subject[] = ['rechnen', 'buchstaben', 'uhr', 'welt', 'woerter', 'englisch'];
for (const subject of SUBJECTS)
  for (const level of [0, 1, 2] as const) {
    let fresh = 0;
    // So lange würfeln, bis 20.000 Aufgaben hintereinander nichts Neues mehr bringen
    for (let i = 0; fresh < 20000; i++) {
      const t = makeTask(subject, level, rnd);
      const before = keys.size;
      // Rechnen: ganze Sätze nur mit Zahlen bis 10, sonst Bausteine
      const upTo = subject === 'rechnen' ? 10 : Infinity;
      add(`${subject}-${level}`, t.say, upTo);
      if (t.explain) add(`${subject}-${level}-tipp`, tipSpeech(t), upTo);
      fresh = keys.size === before ? fresh + 1 : 0;
    }
  }

// Zahlen-Spuren: Hinweise über der Fläche
add('spuren', 'Fang beim grünen Punkt an.');
for (const level of [0, 1, 2] as const) {
  let fresh = 0;
  for (let i = 0; fresh < 5000; i++) {
    const before = keys.size;
    add(`spuren-${level}`, numberTask(level, rnd).hint);
    fresh = keys.size === before ? fresh + 1 : 0;
  }
}

// ───── Anleitungen ─────
for (const g of GAMES) for (const step of g.tutorial) add('anleitung', step.say);
add('anleitung', ['Super, das ist richtig! Du bist bereit.', 'Fast! Probier es nochmal.']);

// ───── Ende eines Spiels ─────
add('spielende', ['Neuer Rekord!', 'Super gespielt!', 'Unentschieden!', 'Gleichstand vorne!']);
for (const r of ROBO_NAMES) add('spielende', `${r} gewinnt diesmal!`);

// ───── Joy spricht (Sprechblasen, Hinweise) ─────
add('joy', [
  'Hallo! Ich bin Joy. Wie heißt du – und welches Tier bist du?',
  'Hier kannst du deinen Namen und dein Tier ändern.',
  'Wer spielt jetzt? Tippe auf dein Tier.',
  'Ich verbinde mich mit dem Spielzimmer …',
  'Du hast geklingelt!',
  'Spielt zusammen, jedes Kind an seinem eigenen Gerät – bis zu vier!',
  'Gib das Gerät weiter – nicht spicken!',
  'Noch 5 Minuten Spielzeit!',
  'Noch 1 Minute Spielzeit!',
]);
add('spruch', [...SPRUECHE]);
for (const n of ARCADE_AFTER_CHOICES) add('sperre', lockSpeech(n));
for (const l of SLF_LETTERS) add('stadt-land-fluss', `Der Buchstabe ist ${l}.`);

// Namen: Hinweise aus src/lib/names.ts (return '…')
const names = readFileSync(join(root, 'src/lib/names.ts'), 'utf8');
for (const m of names.matchAll(/return '([^']+[.!?])'/g)) add('name', m[1]);
add('name', 'Bitte nimm einen Namen vom Würfel.');

// ───── Spielzimmer ─────
add('zimmer', 'Der Spielzimmer-Code ist:');
for (const a of CODE_ANIMALS) add('zimmer', a.name);
const room = readFileSync(join(root, 'src/net/room.ts'), 'utf8');
for (const m of room.matchAll(/'([A-ZÄÖÜ][^'\n]{8,}[.!?])'/g)) add('zimmer', m[1]);

// ───── Ausgabe ─────
const list = [...keys.entries()]
  .map(([key, src]) => ({ key, src: [...src].sort() }))
  .sort((a, b) => a.key.localeCompare(b.key, 'de'));
writeFileSync(join(here, 'saetze.json'), JSON.stringify(list, null, 0).replace(/\},\{/g, '},\n{') + '\n');
const bySrc = new Map<string, number>();
for (const { src } of list) bySrc.set(src[0], (bySrc.get(src[0]) ?? 0) + 1);
console.log(`${list.length} Aufnahmen nötig`);
console.log([...bySrc.entries()].map(([s, n]) => `${s}: ${n}`).join(', '));
