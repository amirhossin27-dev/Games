import type { Level } from '../lib/store';
import { pick, shuffle, type Rnd } from '../lib/util';
import { withOptions } from './choice';
import type { Task } from './tasks';

/**
 * Wort-Baumeister: Buchstaben und Silben zum Wort ordnen, Wörter zusammensetzen und richtig schreiben.
 * Leicht: Buchstaben ordnen · Mittel: Silben (ordnen, fehlende Silbe, Silben zählen) · Schwer: zusammengesetzte
 * Wörter, Rechtschreibung und lange Wörter aus Silben.
 */

/** Kurze Wörter zum Buchstaben-Ordnen (mindestens drei verschiedene Buchstaben) */
export const SHORT_WORDS: [string, string][] = [
  ['HUND', '🐶'], ['MAUS', '🐭'], ['BAUM', '🌳'], ['HAUS', '🏠'], ['BALL', '⚽'], ['EIS', '🍦'],
  ['OMA', '👵'], ['OPA', '👴'], ['AUTO', '🚗'], ['MOND', '🌙'], ['HASE', '🐰'], ['KUH', '🐮'],
  ['ROSE', '🌹'], ['NASE', '👃'], ['UHR', '⌚'], ['HUT', '🎩'], ['BUCH', '📕'], ['ZUG', '🚂'],
  ['IGEL', '🦔'], ['BÄR', '🐻'], ['ENTE', '🦆'], ['KÄSE', '🧀'], ['WAL', '🐳'], ['OHR', '👂'],
  ['LÖWE', '🦁'], ['PILZ', '🍄'], ['HAI', '🦈'], ['MUND', '👄'], ['TOR', '🥅'], ['FROSCH', '🐸'],
];

/** Wörter mit ihren Silben */
export const SYLLABLES: [string[], string][] = [
  [['Ba', 'na', 'ne'], '🍌'], [['Ap', 'fel'], '🍎'], [['To', 'ma', 'te'], '🍅'], [['Ra', 'ke', 'te'], '🚀'],
  [['Me', 'lo', 'ne'], '🍉'], [['Gi', 'raf', 'fe'], '🦒'], [['E', 'le', 'fant'], '🐘'], [['Kro', 'ko', 'dil'], '🐊'],
  [['Schne', 'cke'], '🐌'], [['Ka', 'rot', 'te'], '🥕'], [['Zi', 'tro', 'ne'], '🍋'], [['Pin', 'gu', 'in'], '🐧'],
  [['Dra', 'che'], '🐉'], [['Bie', 'ne'], '🐝'], [['Ku', 'chen'], '🍰'], [['Kat', 'ze'], '🐱'],
  [['Lö', 'we'], '🦁'], [['Ti', 'ger'], '🐯'], [['Ze', 'bra'], '🦓'], [['Son', 'ne'], '☀️'],
  [['Wol', 'ke'], '☁️'], [['Piz', 'za'], '🍕'], [['Gur', 'ke'], '🥒'], [['Ga', 'bel'], '🍴'],
  [['Löf', 'fel'], '🥄'], [['Lam', 'pe'], '💡'], [['A', 'na', 'nas'], '🍍'], [['Scho', 'ko', 'la', 'de'], '🍫'],
  [['Re', 'gen', 'bo', 'gen'], '🌈'], [['Schmet', 'ter', 'ling'], '🦋'], [['Kän', 'gu', 'ru'], '🦘'], [['Te', 'le', 'fon'], '☎️'],
  [['Com', 'pu', 'ter'], '💻'], [['Flug', 'zeug'], '✈️'], [['Ge', 'schenk'], '🎁'], [['Gi', 'tar', 're'], '🎸'],
  [['Pa', 'pa', 'gei'], '🦜'], [['Ka', 'mel'], '🐫'], [['Ham', 'bur', 'ger'], '🍔'], [['Erd', 'bee', 're'], '🍓'],
  [['Eich', 'hörn', 'chen'], '🐿️'], [['Schild', 'krö', 'te'], '🐢'], [['Kro', 'ne'], '👑'], [['Bril', 'le'], '👓'],
  [['Re', 'gen', 'schirm'], '☂️'], [['Ein', 'horn'], '🦄'],
];

/** Zusammengesetzte Wörter: erstes Wort, zweites Wort, Ergebnis, Bild, falsche Antworten, Tipp */
export const COMPOUNDS: { a: string; b: string; w: string; e: string; wrong: string[]; x?: string }[] = [
  { a: 'Haus', b: 'Tür', w: 'Haustür', e: '🚪', wrong: ['Türhaus', 'Hausetür', 'Hausstür'] },
  { a: 'Sonne', b: 'Blume', w: 'Sonnenblume', e: '🌻', wrong: ['Sonneblume', 'Blumensonne', 'Sonnsblume'], x: 'Hier kommt ein n dazwischen: Sonne-n-blume.' },
  { a: 'Schnee', b: 'Mann', w: 'Schneemann', e: '⛄', wrong: ['Schneeman', 'Mannschnee', 'Schnemann'] },
  { a: 'Regen', b: 'Bogen', w: 'Regenbogen', e: '🌈', wrong: ['Bogenregen', 'Regenbogn', 'Regensbogen'] },
  { a: 'Fuß', b: 'Ball', w: 'Fußball', e: '⚽', wrong: ['Ballfuß', 'Fußbal', 'Fußeball'] },
  { a: 'Apfel', b: 'Baum', w: 'Apfelbaum', e: '🌳', wrong: ['Baumapfel', 'Apfelsbaum', 'Apfelnbaum'] },
  { a: 'Feuer', b: 'Wehr', w: 'Feuerwehr', e: '🚒', wrong: ['Wehrfeuer', 'Feuerswehr', 'Feuerwer'] },
  { a: 'Hand', b: 'Schuh', w: 'Handschuh', e: '🧤', wrong: ['Schuhhand', 'Handeschuh', 'Handschu'] },
  { a: 'Kinder', b: 'Garten', w: 'Kindergarten', e: '🏫', wrong: ['Gartenkinder', 'Kindgarten', 'Kindersgarten'] },
  { a: 'Geburt', b: 'Tag', w: 'Geburtstag', e: '🎂', wrong: ['Geburttag', 'Taggeburt', 'Geburtentag'], x: 'Hier kommt ein s dazwischen: Geburt-s-tag.' },
  { a: 'Schule', b: 'Tasche', w: 'Schultasche', e: '🎒', wrong: ['Schuletasche', 'Taschenschule', 'Schulentasche'], x: 'Das e von Schule fällt weg: Schul-tasche.' },
  { a: 'Butter', b: 'Brot', w: 'Butterbrot', e: '🍞', wrong: ['Brotbutter', 'Buttersbrot', 'Butterbrod'] },
  { a: 'Eis', b: 'Bär', w: 'Eisbär', e: '🧊', wrong: ['Bäreis', 'Eisebär', 'Eisbähr'] },
  { a: 'Wasser', b: 'Fall', w: 'Wasserfall', e: '🏞️', wrong: ['Fallwasser', 'Wasserfal', 'Wassersfall'] },
  { a: 'Blume', b: 'Topf', w: 'Blumentopf', e: '🪴', wrong: ['Blumetopf', 'Topfblume', 'Blumtopf'], x: 'Hier kommt ein n dazwischen: Blume-n-topf.' },
  { a: 'Schlaf', b: 'Anzug', w: 'Schlafanzug', e: '🛌', wrong: ['Anzugschlaf', 'Schlafsanzug', 'Schlafeanzug'] },
  { a: 'Stern', b: 'Schnuppe', w: 'Sternschnuppe', e: '🌠', wrong: ['Schnuppenstern', 'Sternschnupe', 'Sterneschnuppe'] },
  { a: 'Sand', b: 'Burg', w: 'Sandburg', e: '🏰', wrong: ['Burgsand', 'Sandeburg', 'Santburg'] },
  { a: 'Spiel', b: 'Platz', w: 'Spielplatz', e: '🤸', wrong: ['Platzspiel', 'Spielsplatz', 'Spielplaz'] },
  { a: 'Regen', b: 'Schirm', w: 'Regenschirm', e: '☂️', wrong: ['Schirmregen', 'Regenschirn', 'Regensschirm'] },
  { a: 'Bahn', b: 'Hof', w: 'Bahnhof', e: '🚉', wrong: ['Hofbahn', 'Bahnof', 'Bahnshof'] },
  { a: 'Tanne', b: 'Baum', w: 'Tannenbaum', e: '🎄', wrong: ['Tannebaum', 'Baumtanne', 'Tanbaum'], x: 'Hier kommt ein n dazwischen: Tanne-n-baum.' },
  { a: 'Zahn', b: 'Bürste', w: 'Zahnbürste', e: '🦷', wrong: ['Bürstenzahn', 'Zahnbürschte', 'Zahnsbürste'] },
  { a: 'Hund', b: 'Hütte', w: 'Hundehütte', e: '🐶', wrong: ['Hundhütte', 'Hüttenhund', 'Hundshütte'], x: 'Hier kommt ein e dazwischen: Hund-e-hütte.' },
  { a: 'Erde', b: 'Beere', w: 'Erdbeere', e: '🍓', wrong: ['Erdebeere', 'Beerenerde', 'Erdbere'], x: 'Das e von Erde fällt weg: Erd-beere.' },
  { a: 'Puppe', b: 'Haus', w: 'Puppenhaus', e: '🏠', wrong: ['Puppehaus', 'Hauspuppe', 'Pupenhaus'], x: 'Hier kommt ein n dazwischen: Puppe-n-haus.' },
];

/** Richtig schreiben: Wort, Bild, typische Fehler */
export const SPELLING: [string, string, string[]][] = [
  ['Fahrrad', '🚲', ['Fahrad', 'Farrad', 'Fahrrat']],
  ['Schmetterling', '🦋', ['Schmeterling', 'Schmetterlink', 'Schmätterling']],
  ['Giraffe', '🦒', ['Girafe', 'Giraffee', 'Schiraffe']],
  ['Krokodil', '🐊', ['Krokodiel', 'Krockodil', 'Grokodil']],
  ['Schildkröte', '🐢', ['Schildkröhte', 'Schiltkröte', 'Schildgröte']],
  ['Eichhörnchen', '🐿️', ['Eichhörnschen', 'Aichhörnchen', 'Eichhörnchn']],
  ['Fernseher', '📺', ['Fernsehr', 'Fernsea', 'Färnseher']],
  ['Hubschrauber', '🚁', ['Hubschrauba', 'Hupschrauber', 'Hubschrauper']],
  ['Vogel', '🐦', ['Fogel', 'Vogl', 'Voggel']],
  ['Fisch', '🐟', ['Fiesch', 'Visch', 'Fischh']],
  ['Käse', '🧀', ['Kese', 'Käße', 'Kähse']],
  ['Uhr', '⌚', ['Uur', 'Uhrr', 'Ühr']],
  ['Spinne', '🕷️', ['Schpinne', 'Spine', 'Spinnee']],
  ['Stern', '⭐', ['Schtern', 'Sterm', 'Stärn']],
  ['Pferd', '🐴', ['Pfert', 'Ferd', 'Pfärd']],
  ['Zebra', '🦓', ['Tsebra', 'Zebbra', 'Zeebra']],
  ['Rakete', '🚀', ['Rackete', 'Raketh', 'Rakäte']],
  ['Banane', '🍌', ['Bananne', 'Banahne', 'Bahnane']],
  ['Elefant', '🐘', ['Elefannt', 'Ellefant', 'Elephant']],
  ['Ameise', '🐜', ['Ameiße', 'Ahmeise', 'Amaise']],
  ['Zitrone', '🍋', ['Zitrohne', 'Zittrone', 'Tsitrone']],
  ['Papagei', '🦜', ['Pappagei', 'Papagai', 'Babagei']],
  ['Flugzeug', '✈️', ['Flugzeuk', 'Fluckzeug', 'Flugzoig']],
  ['Kirsche', '🍒', ['Kirshe', 'Kirrsche', 'Kiersche']],
];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/** Andere Reihenfolgen der Teile (ohne die richtige) */
function scrambles(parts: string[], n: number, rnd: Rnd, join: (p: string[]) => string): string[] {
  const right = join(parts);
  const out = new Set<string>();
  for (let tries = 0; out.size < n && tries < 200; tries++) {
    const s = join(shuffle(parts, rnd));
    if (s !== right) out.add(s);
  }
  return [...out];
}

/** Teile so mischen, dass sie nicht schon richtig dastehen */
function mixed(parts: string[], rnd: Rnd): string[] {
  for (let tries = 0; tries < 20; tries++) {
    const s = shuffle(parts, rnd);
    if (s.join('') !== parts.join('')) return s;
  }
  return parts.slice().reverse();
}

const word = (syl: string[]) => syl.join('');

/** Buchstaben ordnen */
function letterBuild(rnd: Rnd): Task {
  const [w, e] = pick(SHORT_WORDS, rnd);
  const letters = [...w];
  return {
    prompt: 'Bau das Wort!',
    hint: 'Welches Wort ist richtig gebaut?',
    say: 'Bau das Wort! Welches Wort ist richtig gebaut?',
    ...withOptions(w, scrambles(letters, 3, rnd, (p) => p.join('')), rnd),
    visual: { k: 'tiles', parts: mixed(letters, rnd), e },
  };
}

/** Silben ordnen (Wörter mit mindestens drei verschiedenen Silben, sonst gibt es zu wenig Reihenfolgen) */
const BUILDABLE = SYLLABLES.filter(([s]) => new Set(s.map((x) => x.toLowerCase())).size >= 3);

function syllableBuild(rnd: Rnd): Task {
  const [syl, e] = pick(BUILDABLE, rnd);
  const lower = syl.map((s) => s.toLowerCase());
  return {
    prompt: 'Bau das Wort!',
    hint: 'Welches Wort ergeben die Silben?',
    say: 'Bau das Wort aus den Silben!',
    ...withOptions(word(syl), scrambles(lower, 3, rnd, (p) => cap(p.join(''))), rnd),
    visual: { k: 'tiles', parts: mixed(lower, rnd), e },
    explain: `${syl.join('-')}: so stehen die Silben richtig.`,
  };
}

/** Welche Silbe fehlt? */
function missingSyllable(rnd: Rnd): Task {
  const [syl, e] = pick(SYLLABLES, rnd);
  const pos = Math.floor(rnd() * syl.length);
  const missing = syl[pos];
  const fit = (s: string) => (pos === 0 ? cap(s) : s.toLowerCase());
  const others = shuffle(
    SYLLABLES.flatMap(([s]) => s).filter((s) => s.toLowerCase() !== missing.toLowerCase()),
    rnd,
  ).map(fit);
  return {
    prompt: syl.map((s, i) => (i === pos ? '?' : s)).join(' · '),
    hint: 'Welche Silbe fehlt?',
    say: 'Welche Silbe fehlt?',
    ...withOptions(missing, others, rnd),
    visual: { k: 'picture', e },
    explain: `Richtig heißt es ${syl.join('-')}.`,
  };
}

/** Silben zählen */
function countSyllables(rnd: Rnd): Task {
  const [syl, e] = pick(SYLLABLES, rnd);
  const n = String(syl.length);
  return {
    prompt: word(syl),
    hint: 'Wie viele Silben? Klatsch mit!',
    say: `Wie viele Silben hat ${word(syl)}? Klatsch mit!`,
    ...withOptions(n, ['1', '2', '3', '4', '5'], rnd),
    visual: { k: 'picture', e },
    explain: `${syl.join(' – ')}: ${n} Silben.`,
  };
}

/** Zwei Wörter zu einem neuen zusammensetzen */
function compound(rnd: Rnd): Task {
  const c = pick(COMPOUNDS, rnd);
  return {
    prompt: `${c.a} + ${c.b} = ?`,
    hint: 'Bau ein neues Wort!',
    say: `${c.a} und ${c.b}. Welches Wort entsteht?`,
    ...withOptions(c.w, shuffle(c.wrong, rnd), rnd),
    visual: { k: 'picture', e: c.e },
    explain: c.x,
  };
}

/** Welches Wort ist richtig geschrieben? */
function spelling(rnd: Rnd): Task {
  const [w, e, wrong] = pick(SPELLING, rnd);
  return {
    prompt: 'Wie schreibt man das?',
    hint: 'Nur ein Wort ist richtig geschrieben.',
    say: 'Wie schreibt man das richtig?',
    ...withOptions(w, shuffle(wrong, rnd), rnd),
    visual: { k: 'picture', e },
  };
}

export function wordTask(level: Level, rnd: Rnd = Math.random): Task {
  if (level === 0) return letterBuild(rnd);
  const r = rnd();
  if (level === 1) return r < 0.4 ? syllableBuild(rnd) : r < 0.75 ? missingSyllable(rnd) : countSyllables(rnd);
  return r < 0.4 ? compound(rnd) : r < 0.8 ? spelling(rnd) : syllableBuild(rnd);
}
