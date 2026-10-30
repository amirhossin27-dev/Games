import type { Level } from '../lib/store';
import { pick, shuffle, type Rnd } from '../lib/util';
import { withOptions, type BankItem } from './choice';
import type { Task } from './tasks';

/**
 * English Words: erste englische Wörter mit Bild. Weil Joy (noch) nicht vorliest, steht bei jedem Wort,
 * wie man es ungefähr ausspricht – in deutscher Schreibweise.
 * Leicht: Bild → englisches Wort · Mittel: englisches Wort → Bild und deutsches Wort → englisch ·
 * Schwer: kurze Sätze, Wochentage und Familie.
 */

export interface EnWord {
  en: string;
  de: string;
  e: string;
  /** Aussprache in deutscher Schreibweise */
  say: string;
  cat: 'tiere' | 'essen' | 'dinge' | 'koerper' | 'farben' | 'zahlen';
}

const W = (cat: EnWord['cat'], list: [string, string, string, string][]): EnWord[] => list.map(([en, de, e, say]) => ({ en, de, e, say, cat }));

export const EN_WORDS: EnWord[] = [
  ...W('tiere', [
    ['dog', 'Hund', '🐶', 'dogg'], ['cat', 'Katze', '🐱', 'kätt'], ['bird', 'Vogel', '🐦', 'börd'], ['fish', 'Fisch', '🐟', 'fisch'],
    ['horse', 'Pferd', '🐴', 'hohrs'], ['cow', 'Kuh', '🐮', 'kau'], ['pig', 'Schwein', '🐷', 'pigg'], ['mouse', 'Maus', '🐭', 'maus'],
    ['duck', 'Ente', '🦆', 'dack'], ['frog', 'Frosch', '🐸', 'frogg'], ['bear', 'Bär', '🐻', 'bähr'], ['lion', 'Löwe', '🦁', 'laien'],
    ['monkey', 'Affe', '🐵', 'manki'], ['rabbit', 'Hase', '🐰', 'räbbit'], ['sheep', 'Schaf', '🐑', 'schiep'], ['bee', 'Biene', '🐝', 'bie'],
  ]),
  ...W('essen', [
    ['apple', 'Apfel', '🍎', 'äppel'], ['banana', 'Banane', '🍌', 'benahna'], ['bread', 'Brot', '🍞', 'bredd'], ['milk', 'Milch', '🥛', 'milk'],
    ['egg', 'Ei', '🥚', 'egg'], ['cheese', 'Käse', '🧀', 'tschies'], ['cake', 'Kuchen', '🍰', 'keik'], ['pear', 'Birne', '🍐', 'pähr'],
    ['strawberry', 'Erdbeere', '🍓', 'strohberri'], ['carrot', 'Karotte', '🥕', 'kärrot'], ['pizza', 'Pizza', '🍕', 'pitsa'], ['ice cream', 'Eis', '🍦', 'eis kriem'],
  ]),
  ...W('dinge', [
    ['house', 'Haus', '🏠', 'haus'], ['car', 'Auto', '🚗', 'kahr'], ['ball', 'Ball', '⚽', 'bohl'], ['book', 'Buch', '📕', 'buck'],
    ['tree', 'Baum', '🌳', 'trie'], ['sun', 'Sonne', '☀️', 'sann'], ['moon', 'Mond', '🌙', 'muhn'], ['star', 'Stern', '⭐', 'stahr'],
    ['flower', 'Blume', '🌸', 'flauer'], ['bed', 'Bett', '🛏️', 'bedd'], ['train', 'Zug', '🚂', 'trein'], ['boat', 'Boot', '⛵', 'bout'],
    ['key', 'Schlüssel', '🔑', 'kie'], ['hat', 'Hut', '🎩', 'hätt'], ['shoe', 'Schuh', '👟', 'schuh'], ['clock', 'Uhr', '⏰', 'klock'],
  ]),
  ...W('koerper', [
    ['hand', 'Hand', '✋', 'händ'], ['nose', 'Nase', '👃', 'nous'], ['ear', 'Ohr', '👂', 'ier'], ['eye', 'Auge', '👁️', 'ei'],
    ['mouth', 'Mund', '👄', 'mauth'], ['foot', 'Fuß', '🦶', 'futt'],
  ]),
  ...W('farben', [
    ['red', 'rot', '🟥', 'redd'], ['blue', 'blau', '🟦', 'bluh'], ['green', 'grün', '🟩', 'grien'], ['yellow', 'gelb', '🟨', 'jellou'],
    ['orange', 'orange', '🟧', 'orrintsch'], ['purple', 'lila', '🟪', 'pörpel'], ['black', 'schwarz', '⬛', 'bläck'], ['white', 'weiß', '⬜', 'weit'],
    ['brown', 'braun', '🟫', 'braun'],
  ]),
  ...W('zahlen', [
    ['one', 'eins', '1', 'wann'], ['two', 'zwei', '2', 'tuh'], ['three', 'drei', '3', 'thrie'], ['four', 'vier', '4', 'fohr'],
    ['five', 'fünf', '5', 'feif'], ['six', 'sechs', '6', 'sicks'], ['seven', 'sieben', '7', 'sewwen'], ['eight', 'acht', '8', 'eit'],
    ['nine', 'neun', '9', 'nein'], ['ten', 'zehn', '10', 'tenn'],
  ]),
];

/** Schwer: Sätze und Wörter von Deutsch nach Englisch */
export const EN_PHRASES: BankItem[] = [
  { q: 'Guten Morgen', e: '🌅', a: 'Good morning', w: ['Good night', 'Goodbye', 'Good evening'] },
  { q: 'Gute Nacht', e: '🌙', a: 'Good night', w: ['Good morning', 'Good day', 'Hello'] },
  { q: 'Danke', e: '🙏', a: 'Thank you', w: ['Please', 'Sorry', 'Hello'] },
  { q: 'Bitte (wenn du etwas möchtest)', e: '🙋', a: 'Please', w: ['Thank you', 'Sorry', 'Yes'] },
  { q: 'Entschuldigung', e: '😳', a: 'Sorry', w: ['Please', 'Hello', 'Goodbye'] },
  { q: 'Tschüss', e: '👋', a: 'Goodbye', w: ['Hello', 'Thank you', 'Good morning'] },
  { q: 'Wie heißt du?', e: '🙂', a: 'What is your name?', w: ['How old are you?', 'Where are you?', 'How are you?'] },
  { q: 'Wie alt bist du?', e: '🎂', a: 'How old are you?', w: ['What is your name?', 'How are you?', 'Where do you live?'] },
  { q: 'Wie geht es dir?', e: '😊', a: 'How are you?', w: ['Who are you?', 'Where are you?', 'How old are you?'] },
  { q: 'Ich bin acht Jahre alt.', e: '8️⃣', a: 'I am eight years old.', w: ['I have eight years.', 'I am eight years big.', 'I am old eight years.'], x: 'Im Englischen sagt man „I am“ – ich bin –, nicht „I have“.' },
  { q: 'Ich habe Hunger.', e: '🍽️', a: 'I am hungry.', w: ['I have hungry.', 'I am angry.', 'I am thirsty.'], x: 'Auf Englisch ist man hungrig: „I am hungry“.' },
  { q: 'Ich mag Pizza.', e: '🍕', a: 'I like pizza.', w: ['I am pizza.', 'I make pizza.', 'I have pizza.'] },
  { q: 'Ich wohne in Berlin.', e: '🏙️', a: 'I live in Berlin.', w: ['I love in Berlin.', 'I life in Berlin.', 'I am in Berlin live.'] },
  { q: 'Es regnet.', e: '🌧️', a: 'It is raining.', w: ['It is snowing.', 'It is sunny.', 'It rains in.'] },
  { q: 'Montag', e: '📅', a: 'Monday', w: ['Sunday', 'Friday', 'Tuesday'] },
  { q: 'Sonntag', e: '📅', a: 'Sunday', w: ['Monday', 'Saturday', 'Sun'] },
  { q: 'Freitag', e: '📅', a: 'Friday', w: ['Thursday', 'Saturday', 'Tuesday'] },
  { q: 'klein', e: '🐭', a: 'small', w: ['big', 'tall', 'slow'] },
  { q: 'schnell', e: '🐆', a: 'fast', w: ['slow', 'first', 'fat'] },
  { q: 'glücklich', e: '😄', a: 'happy', w: ['sad', 'angry', 'hungry'] },
  { q: 'Schule', e: '🏫', a: 'school', w: ['shoe', 'cool', 'scale'] },
  { q: 'Freund', e: '🤝', a: 'friend', w: ['free', 'fried', 'family'] },
  { q: 'Familie', e: '👨‍👩‍👧', a: 'family', w: ['famous', 'friend', 'father'] },
  { q: 'Mutter', e: '👩', a: 'mother', w: ['father', 'brother', 'butter'] },
  { q: 'Bruder', e: '👦', a: 'brother', w: ['mother', 'sister', 'bread'] },
  { q: 'Schwester', e: '👧', a: 'sister', w: ['brother', 'mother', 'sweater'] },
  { q: 'heute', e: '📆', a: 'today', w: ['tomorrow', 'yesterday', 'toy'] },
  { q: 'Wetter', e: '🌦️', a: 'weather', w: ['water', 'winter', 'wetter'] },
];

const sayHint = (w: EnWord) => `„${w.en}“ heißt „${w.de}“. Man sagt ungefähr: „${w.say}“.`;

function sameKind(w: EnWord, rnd: Rnd): EnWord[] {
  return shuffle(
    EN_WORDS.filter((o) => o.cat === w.cat && o.en !== w.en),
    rnd,
  );
}

/** Bild → englisches Wort */
function pictureToWord(rnd: Rnd): Task {
  const w = pick(EN_WORDS, rnd);
  return {
    prompt: 'Wie heißt das auf Englisch?',
    say: 'Wie heißt das auf Englisch?',
    ...withOptions(w.en, sameKind(w, rnd).map((o) => o.en), rnd),
    visual: { k: 'picture', e: w.e },
    explain: sayHint(w),
  };
}

/** Englisches Wort → Bild */
function wordToPicture(rnd: Rnd): Task {
  const w = pick(EN_WORDS, rnd);
  return {
    prompt: w.en,
    hint: 'Welches Bild passt?',
    say: 'Welches Bild passt zu dem englischen Wort?',
    ...withOptions(w.e, sameKind(w, rnd).map((o) => o.e), rnd),
    pictures: true,
    explain: sayHint(w),
  };
}

/** Deutsches Wort → englisches Wort */
function germanToEnglish(rnd: Rnd): Task {
  const w = pick(EN_WORDS, rnd);
  return {
    prompt: `„${w.de}“`,
    hint: 'Was heißt das auf Englisch?',
    say: `Was heißt ${w.de} auf Englisch?`,
    ...withOptions(w.en, sameKind(w, rnd).map((o) => o.en), rnd),
    visual: { k: 'picture', e: w.e },
    explain: sayHint(w),
  };
}

function phrase(rnd: Rnd): Task {
  const it = pick(EN_PHRASES, rnd);
  return {
    prompt: `„${it.q}“`,
    hint: 'Wie sagt man das auf Englisch?',
    say: `Wie sagt man ${it.q} auf Englisch?`,
    ...withOptions(it.a, shuffle(it.w, rnd), rnd),
    visual: it.e ? { k: 'picture', e: it.e } : undefined,
    explain: it.x,
  };
}

export function englishTask(level: Level, rnd: Rnd = Math.random): Task {
  if (level === 0) return pictureToWord(rnd);
  if (level === 1) return rnd() < 0.5 ? wordToPicture(rnd) : germanToEnglish(rnd);
  return rnd() < 0.7 ? phrase(rnd) : germanToEnglish(rnd);
}
