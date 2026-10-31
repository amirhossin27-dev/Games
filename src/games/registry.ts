import type { TutorialStep } from '../engine/tutorial';
import type { Subject } from '../lib/progress';
import type { ArtKind } from '../ui/GameArt';

export type GameId =
  | 'rechnen'
  | 'buchstaben'
  | 'uhr'
  | 'welt'
  | 'woerter'
  | 'englisch'
  | 'paare'
  | 'vier'
  | 'ttt'
  | 'ludo'
  | 'maumau'
  | 'wuerfel'
  | 'schiffe'
  | 'muehle'
  | 'dame'
  | 'slf'
  | 'schlange'
  | 'kloetzchen'
  | 'g2048'
  | 'flappy'
  | 'huepfer'
  | 'mampfer'
  | 'breakout'
  | 'tempel'
  | 'weltraum'
  | 'ballblitz'
  | 'tonecho'
  | 'minen'
  | 'solitaer'
  | 'pong'
  | 'blitz';

export type Category = 'mathe' | 'sprache' | 'logik' | 'gedaechtnis' | 'wissen' | 'klassiker' | 'arcade';

export const CATEGORY: Record<Category, { label: string; bg: string; fg: string }> = {
  mathe: { label: 'Mathe', bg: '#DCE9F3', fg: '#2F5F86' },
  sprache: { label: 'Sprache', bg: '#F3DCE6', fg: '#8A2F5A' },
  logik: { label: 'Logik', bg: '#E9E1F0', fg: '#5E4277' },
  gedaechtnis: { label: 'Gedächtnis', bg: '#DDEBDD', fg: '#33673E' },
  wissen: { label: 'Wissen', bg: '#F7EDC8', fg: '#6B5410' },
  klassiker: { label: 'Klassiker', bg: '#F6E1D8', fg: '#8F3E1F' },
  arcade: { label: 'Arcade', bg: '#E3E7EE', fg: '#3D4A66' },
};

/**
 * - def: Regel-Funktionen mit useGame (allein, gegen Robo, zusammen an einem Gerät)
 * - arcade: Solo-Spiel mit Rekord (aus Arta übernommen)
 * - duel: zwei gegenüber an einem Gerät oder gegen Robo (aus Arta übernommen)
 */
export type GameKind = 'def' | 'arcade' | 'duel';

export interface GameMeta {
  id: GameId;
  name: string;
  tagline: string;
  /** „Das übst du“ */
  learn: string;
  category: Category;
  minAge: number;
  players: [number, number];
  minutes: string;
  art: ArtKind;
  kind: GameKind;
  /** Gibt es einen Computer-Gegner? */
  robo: boolean;
  /** Schwierigkeit wählbar */
  levels: boolean;
  scoreLabel?: string;
  lowerIsBetter?: boolean;
  /** Zählt für Abzeichen und Tagesaufgaben */
  subject?: Subject;
  /** Siege zählen für „Strategie-Stern“ */
  logic?: boolean;
  tutorial: TutorialStep[];
}

const R = '#D9774F';
const B = '#2F6E9E';
const W = '#DCE9F3';
const SH = '#5E6B60';
const DK = '#8A6A4A';

export const GAMES: GameMeta[] = [
  {
    id: 'rechnen',
    name: 'Rechen-Rallye',
    tagline: 'Plus, Minus und Mal – wer rechnet am schnellsten?',
    learn: 'Kopfrechnen: Plus und Minus bis 10, 20 und 100, dazu das Einmaleins. Zehnerfelder helfen beim Zählen.',
    category: 'mathe',
    minAge: 5,
    players: [1, 4],
    minutes: '3 Min',
    art: 'rechnen',
    kind: 'def',
    robo: true,
    levels: true,
    scoreLabel: 'richtig',
    subject: 'math',
    tutorial: [
      { say: 'Hier siehst du eine Rechenaufgabe. Die Punkte helfen dir beim Zählen.', art: { k: 'quiz', task: { prompt: '2 + 3 = ?', say: '', options: ['4', '5', '6', '7'], correct: 1, visual: { k: 'tenframe', a: 2, b: 3, minus: false } } } },
      { say: 'Tippe auf die richtige Zahl. Je schneller, desto mehr Punkte!', art: { k: 'quiz', task: { prompt: '2 + 3 = ?', say: '', options: ['4', '5', '6', '7'], correct: 1 }, point: 1 } },
      { say: 'Gegen Robo antwortet ihr gleichzeitig. Teilt ihr euch ein Gerät, ist jeder reihum dran.', art: { k: 'pics', items: ['🦊', '🦉', '🐼', '🤖'], caption: 'Wer richtig liegt, bekommt Punkte' } },
      { say: 'Jetzt du! Wie viel ist 2 plus 3?', art: { k: 'quiz', task: { prompt: '2 + 3 = ?', say: '', options: ['4', '5', '6', '7'], correct: 1, visual: { k: 'tenframe', a: 2, b: 3, minus: false } }, tryIt: true } },
    ],
  },
  {
    id: 'buchstaben',
    name: 'Buchstaben-Jagd',
    tagline: 'Womit fängt der Apfel an? Finde den richtigen Buchstaben!',
    learn: 'Anlaute hören, Buchstaben erkennen und Wörter richtig schreiben.',
    category: 'sprache',
    minAge: 4,
    players: [1, 4],
    minutes: '3 Min',
    art: 'buchstaben',
    kind: 'def',
    robo: true,
    levels: true,
    scoreLabel: 'richtig',
    subject: 'letters',
    tutorial: [
      { say: 'Du siehst ein Bild. Tippe auf den Lautsprecher, dann sage ich dir das Wort.', art: { k: 'pics', items: ['🍎'], caption: 'Apfel' } },
      { say: 'Hör genau hin: Mit welchem Buchstaben fängt das Wort an?', art: { k: 'quiz', task: { prompt: 'Womit fängt es an?', say: '', options: ['M', 'A', 'T', 'E'], correct: 1, visual: { k: 'picture', e: '🍎', word: 'Apfel' } }, point: 1 } },
      { say: 'Auf Mittel suchst du das passende Bild, auf Schwer den fehlenden Buchstaben.', art: { k: 'pics', items: ['🐟', '🦒', '🦊', '🐘'], caption: 'Welches Bild beginnt mit F?' } },
      { say: 'Jetzt du! Womit fängt Apfel an?', art: { k: 'quiz', task: { prompt: 'Womit fängt es an?', say: '', options: ['M', 'A', 'T', 'E'], correct: 1, visual: { k: 'picture', e: '🍎', word: 'Apfel' } }, tryIt: true } },
    ],
  },
  {
    id: 'uhr',
    name: 'Uhr-Profi',
    tagline: 'Wie spät ist es? Lies die Uhr wie ein Profi.',
    learn: 'Die Uhr lesen: volle Stunden, halb, Viertel nach, Viertel vor und Minuten.',
    category: 'wissen',
    minAge: 6,
    players: [1, 4],
    minutes: '3 Min',
    art: 'uhr',
    kind: 'def',
    robo: true,
    levels: true,
    scoreLabel: 'richtig',
    subject: 'clock',
    tutorial: [
      { say: 'Der kurze, dicke Zeiger zeigt die Stunde.', art: { k: 'clock', h: 3, m: 0, label: '3 Uhr' } },
      { say: 'Der lange Zeiger zeigt die Minuten. Steht er unten, ist es halb.', art: { k: 'clock', h: 3, m: 30, label: 'halb 4' } },
      { say: 'Schau dir die Uhr an und tippe auf die passende Uhrzeit.', art: { k: 'quiz', task: { prompt: 'Wie spät ist es?', say: '', options: ['5 Uhr', '3 Uhr', '12 Uhr', '9 Uhr'], correct: 1, visual: { k: 'clock', h: 3, m: 0 } }, point: 1 } },
      { say: 'Jetzt du! Wie spät ist es?', art: { k: 'quiz', task: { prompt: 'Wie spät ist es?', say: '', options: ['6 Uhr', '8 Uhr', '7 Uhr', '2 Uhr'], correct: 2, visual: { k: 'clock', h: 7, m: 0 } }, tryIt: true } },
    ],
  },
  {
    id: 'welt',
    name: 'Welt-Quiz',
    tagline: 'Tiere, Natur, Länder und Weltall – was weißt du über die Welt?',
    learn: 'Allgemeinwissen: Tiere und Natur, der eigene Körper, Länder, Hauptstädte, Flaggen und Planeten.',
    category: 'wissen',
    minAge: 5,
    players: [1, 4],
    minutes: '3 Min',
    art: 'welt',
    kind: 'def',
    robo: true,
    levels: true,
    scoreLabel: 'richtig',
    subject: 'world',
    tutorial: [
      { say: 'Joy stellt dir Fragen über Tiere, Natur, deinen Körper und die ganze Welt.', art: { k: 'pics', items: ['🦒', '🌍', '🪐', '🧠'] } },
      { say: 'Auf Leicht tippst du auf das passende Bild. Später antwortest du mit Wörtern.', art: { k: 'quiz', task: { prompt: 'Welches Tier macht Muh?', say: '', options: ['🐶', '🐮', '🐷', '🐑'], correct: 1, pictures: true }, point: 1 } },
      { say: 'Auf Schwer geht es um Länder, Flaggen und das Weltall.', art: { k: 'quiz', task: { prompt: 'Was ist die Hauptstadt von Frankreich?', say: '', options: ['Lyon', 'Paris', 'Nizza', 'Marseille'], correct: 1, visual: { k: 'picture', e: '🇫🇷' } } } },
      { say: 'Jetzt du! Welches Tier kann fliegen?', art: { k: 'quiz', task: { prompt: 'Welches Tier kann fliegen?', say: '', options: ['🐟', '🐢', '🐦', '🐘'], correct: 2, pictures: true }, tryIt: true } },
    ],
  },
  {
    id: 'woerter',
    name: 'Wort-Baumeister',
    tagline: 'Buchstaben und Silben ordnen – bau die richtigen Wörter!',
    learn: 'Lesen und Schreiben: Buchstaben und Silben zum Wort ordnen, Silben klatschen, Wörter zusammensetzen und richtig schreiben.',
    category: 'sprache',
    minAge: 6,
    players: [1, 4],
    minutes: '3 Min',
    art: 'woerter',
    kind: 'def',
    robo: true,
    levels: true,
    scoreLabel: 'richtig',
    subject: 'words',
    tutorial: [
      { say: 'Hier liegen Buchstaben durcheinander. Welches Wort kannst du daraus bauen?', art: { k: 'quiz', task: { prompt: 'Bau das Wort!', say: '', options: ['HNUD', 'HUND', 'DUNH', 'UHND'], correct: 1, visual: { k: 'tiles', parts: ['N', 'D', 'H', 'U'], e: '🐶' } }, point: 1 } },
      { say: 'Auf Mittel baust du Wörter aus Silben, findest fehlende Silben und klatschst Silben mit.', art: { k: 'quiz', task: { prompt: 'Ba · ? · ne', hint: 'Welche Silbe fehlt?', say: '', options: ['na', 'to', 'ke', 'lo'], correct: 0, visual: { k: 'picture', e: '🍌' } } } },
      { say: 'Auf Schwer setzt du zwei Wörter zusammen und findest die richtige Schreibweise.', art: { k: 'pics', items: ['☀️', '➕', '🌸', '➡️', '🌻'], caption: 'Sonne + Blume = Sonnenblume' } },
      { say: 'Jetzt du! Bau das Wort zum Bild.', art: { k: 'quiz', task: { prompt: 'Bau das Wort!', say: '', options: ['AUMS', 'MAUS', 'SMUA', 'UMAS'], correct: 1, visual: { k: 'tiles', parts: ['S', 'U', 'A', 'M'], e: '🐭' } }, tryIt: true } },
    ],
  },
  {
    id: 'englisch',
    name: 'English Words',
    tagline: 'Dog, cat, apple – deine ersten englischen Wörter!',
    learn: 'Erste englische Wörter (Tiere, Essen, Farben, Zahlen, Körper) und kurze Sätze. Zu jedem Wort steht, wie man es ungefähr ausspricht.',
    category: 'sprache',
    minAge: 5,
    players: [1, 4],
    minutes: '3 Min',
    art: 'englisch',
    kind: 'def',
    robo: true,
    levels: true,
    scoreLabel: 'richtig',
    subject: 'english',
    tutorial: [
      { say: 'Lerne deine ersten englischen Wörter: Tiere, Essen, Farben, Zahlen und mehr.', art: { k: 'pics', items: ['🐶', '🍎', '🟥', '3️⃣'], caption: 'dog · apple · red · three' } },
      { say: 'Schau dir das Bild an und tippe auf das englische Wort.', art: { k: 'quiz', task: { prompt: 'Wie heißt das auf Englisch?', say: '', options: ['dog', 'cat', 'bird', 'fish'], correct: 1, visual: { k: 'picture', e: '🐱' } }, point: 1 } },
      { say: 'Nach jeder Frage zeigt dir Joy, wie man das Wort ungefähr ausspricht.', art: { k: 'pics', items: ['🐱'], caption: 'cat – man sagt „kätt“' } },
      { say: 'Jetzt du! Wie heißt der Hund auf Englisch?', art: { k: 'quiz', task: { prompt: 'Wie heißt das auf Englisch?', say: '', options: ['cat', 'fish', 'dog', 'bird'], correct: 2, visual: { k: 'picture', e: '🐶' } }, tryIt: true } },
    ],
  },
  {
    id: 'paare',
    name: 'Paare finden',
    tagline: 'Merk dir, wo die Bilder liegen, und finde alle Paare.',
    learn: 'Gedächtnis und Konzentration.',
    category: 'gedaechtnis',
    minAge: 4,
    players: [1, 4],
    minutes: '3 Min',
    art: 'paare',
    kind: 'def',
    robo: true,
    levels: true,
    scoreLabel: 'Züge',
    lowerIsBetter: true,
    tutorial: [
      { say: 'Alle Karten liegen verdeckt. Tippe zwei Karten an, dann drehen sie sich um.', art: { k: 'cards', cards: [{ t: '' }, { t: '🐶' }, { t: '' }, { t: '' }], point: 1 } },
      { say: 'Sind beide Bilder gleich, hast du ein Paar gefunden und darfst nochmal.', art: { k: 'cards', cards: [{ t: '🐸' }, { t: '' }, { t: '🐸' }, { t: '' }] } },
      { say: 'Sonst drehen sie sich wieder um. Merk dir gut, wo sie liegen!', art: { k: 'cards', cards: [{ t: '🐱' }, { t: '' }, { t: '🦊' }, { t: '' }] } },
      { say: 'Wer am Ende die meisten Paare hat, gewinnt. Allein zählen die Züge.', art: { k: 'art', art: 'paare' } },
    ],
  },
  {
    id: 'vier',
    name: 'Vier gewinnt',
    tagline: 'Steine fallen lassen und vier in eine Reihe bringen.',
    learn: 'Vorausdenken und Muster erkennen.',
    category: 'logik',
    minAge: 5,
    players: [2, 2],
    minutes: '4 Min',
    art: 'vier',
    kind: 'def',
    robo: true,
    levels: true,
    logic: true,
    tutorial: [
      { say: 'Ihr seid zu zweit. Jeder hat eine eigene Farbe.', art: { k: 'grid', cols: 7, cells: [...Array(35).fill(null), null, null, R, B, null, null, null] } },
      { say: 'Tippe auf eine Spalte. Dein Stein fällt ganz nach unten.', art: { k: 'grid', cols: 7, cells: [...Array(35).fill(null), null, null, R, B, R, null, null], point: 39 } },
      { say: 'Vier in einer Reihe gewinnen – waagerecht, senkrecht oder schräg!', art: { k: 'grid', cols: 7, cells: [...Array(28).fill(null), null, B, null, null, B, null, null, R, R, R, R, B, B, null], mark: [35, 36, 37, 38] } },
      { say: 'Pass auf, dass der andere keine vier schafft. Versperr ihm den Weg!', art: { k: 'art', art: 'vier' } },
    ],
  },
  {
    id: 'ttt',
    name: 'Tic-Tac-Toe',
    tagline: 'Drei in einer Reihe – der Klassiker für zwischendurch.',
    learn: 'Logisch denken und den Gegner durchschauen.',
    category: 'logik',
    minAge: 4,
    players: [2, 2],
    minutes: '1 Min',
    art: 'ttt',
    kind: 'def',
    robo: true,
    levels: true,
    logic: true,
    tutorial: [
      { say: 'Abwechselnd tippt ihr auf ein freies Feld.', art: { k: 'grid', cols: 3, cells: ['✕', null, null, null, '◯', null, null, null, null], point: 8 } },
      { say: 'Wer zuerst drei in einer Reihe hat, gewinnt. Auch schräg zählt!', art: { k: 'grid', cols: 3, cells: ['✕', '◯', null, null, '✕', '◯', null, null, '✕'], mark: [0, 4, 8] } },
      { say: 'Ist das Brett voll und niemand hat drei, ist es unentschieden.', art: { k: 'art', art: 'ttt' } },
    ],
  },
  {
    id: 'ludo',
    name: 'Ludo',
    tagline: 'Würfeln, ziehen, rauswerfen – wer ist zuerst im Ziel?',
    learn: 'Zählen, Regeln einhalten und fair verlieren.',
    category: 'klassiker',
    minAge: 5,
    players: [2, 4],
    minutes: '12 Min',
    art: 'ludo',
    kind: 'def',
    robo: true,
    levels: true,
    tutorial: [
      { say: 'Tippe auf den Würfel. So viele Felder darf eine Figur laufen.', art: { k: 'dice', values: [4] } },
      { say: 'Mit einer 6 kommt eine neue Figur aus dem Haus. Und du darfst nochmal würfeln!', art: { k: 'dice', values: [6] } },
      { say: 'Landest du auf einer fremden Figur, muss sie zurück ins Haus.', art: { k: 'art', art: 'ludo' } },
      { say: 'Wer zuerst alle vier Figuren im Ziel hat, gewinnt. Ihr könnt zu zweit bis zu viert spielen.', art: { k: 'pics', items: ['🦊', '🐼', '🦉', '🤖'] } },
    ],
  },
  {
    id: 'maumau',
    name: 'Mau-Mau',
    tagline: 'Gleiche Farbe oder gleiche Zahl – wer ist zuerst alle Karten los?',
    learn: 'Farben und Zahlen vergleichen, Regeln merken.',
    category: 'klassiker',
    minAge: 6,
    players: [2, 4],
    minutes: '5 Min',
    art: 'maumau',
    kind: 'def',
    robo: true,
    levels: true,
    tutorial: [
      { say: 'Leg eine Karte, die zur obersten Karte passt: gleiche Farbe oder gleiche Zahl.', art: { k: 'cards', cards: [{ t: '♥ 9', red: true }, { t: '♥ K', red: true }, { t: '♠ 9' }, { t: '♣ 7', dim: true }], point: 1 } },
      { say: 'Passt nichts, ziehst du eine Karte vom Stapel.', art: { k: 'cards', cards: [{ t: '' }, { t: '♦ 10', red: true }] } },
      { say: 'Eine 7: der Nächste zieht zwei. Eine 8: der Nächste setzt aus. Mit dem Buben wünschst du dir eine Farbe.', art: { k: 'cards', cards: [{ t: '♣ 7' }, { t: '♦ 8', red: true }, { t: '♠ B' }] } },
      { say: 'Wer zuerst keine Karten mehr hat, gewinnt: Mau-Mau!', art: { k: 'art', art: 'maumau' } },
    ],
  },
  {
    id: 'wuerfel',
    name: 'Würfelglück',
    tagline: 'Würfeln, Würfel halten, nochmal würfeln – und Punkte sammeln.',
    learn: 'Addieren und clever entscheiden.',
    category: 'mathe',
    minAge: 7,
    players: [1, 4],
    minutes: '10 Min',
    art: 'wuerfel',
    kind: 'def',
    robo: true,
    levels: true,
    scoreLabel: 'Punkte',
    tutorial: [
      { say: 'Du hast fünf Würfel und darfst bis zu dreimal würfeln.', art: { k: 'dice', values: [3, 3, 5, 1, 3] } },
      { say: 'Tippe Würfel an, die du behalten willst. Nur die anderen werden neu gewürfelt.', art: { k: 'dice', values: [3, 3, 5, 1, 3], held: [true, true, false, false, true] } },
      { say: 'Dann trägst du dein Ergebnis in ein freies Feld ein, zum Beispiel bei den Dreiern.', art: { k: 'pics', items: ['3️⃣', '3️⃣', '3️⃣'], caption: 'Dreier: 3 + 3 + 3 = 9 Punkte' } },
      { say: 'Wenn alle Felder voll sind, gewinnt, wer die meisten Punkte hat.', art: { k: 'art', art: 'wuerfel' } },
    ],
  },
  {
    id: 'schiffe',
    name: 'Schiffe versenken',
    tagline: 'Treffer, versenkt! Finde alle Schiffe zuerst.',
    learn: 'Koordinaten lesen (zum Beispiel C5) und logisch suchen.',
    category: 'logik',
    minAge: 7,
    players: [2, 2],
    minutes: '8 Min',
    art: 'schiffe',
    kind: 'def',
    robo: true,
    levels: true,
    logic: true,
    tutorial: [
      { say: 'Zuerst stellst du deine Flotte auf. Würfeln stellt sie zufällig auf.', art: { k: 'grid', cols: 5, cells: [SH, SH, SH, null, null, null, null, null, null, SH, null, null, null, null, SH, null, SH, SH, null, null, null, null, null, null, null] } },
      { say: 'Dann tippst du abwechselnd auf das Meer des anderen.', art: { k: 'grid', cols: 5, cells: [W, null, null, W, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null], point: 12 } },
      { say: 'Triffst du ein Schiff, darfst du gleich nochmal!', art: { k: 'grid', cols: 5, cells: [W, null, null, W, null, null, null, null, null, null, null, R, R, null, null, null, null, null, null, null, null, null, null, null, null], mark: [11, 12] } },
      { say: 'Wer zuerst alle Schiffe versenkt, gewinnt.', art: { k: 'art', art: 'schiffe' } },
    ],
  },
  {
    id: 'muehle',
    name: 'Mühle',
    tagline: 'Steine setzen, ziehen und Mühlen bauen – der Brettspiel-Klassiker.',
    learn: 'Vorausdenken, Muster erkennen und den Gegner blockieren.',
    category: 'klassiker',
    minAge: 7,
    players: [2, 2],
    minutes: '10 Min',
    art: 'muehle',
    kind: 'def',
    robo: true,
    levels: true,
    logic: true,
    tutorial: [
      { say: 'Ihr habt jeder 9 Steine. Abwechselnd setzt ihr sie auf die Punkte.', art: { k: 'art', art: 'muehle' } },
      { say: 'Drei eigene Steine in einer Linie sind eine Mühle! Dann nimmst du einen Stein vom anderen weg.', art: { k: 'grid', cols: 3, cells: ['🔴', '🔴', '🔴', null, '🔵', null, '🔵', null, null], mark: [0, 1, 2] } },
      { say: 'Sind alle Steine gesetzt, schiebst du einen Stein zu einem freien Nachbarpunkt. Wer nur noch 3 Steine hat, darf springen.', art: { k: 'gesture', g: 'drag' } },
      { say: 'Wer nur noch 2 Steine hat oder nicht mehr ziehen kann, verliert.', art: { k: 'pics', items: ['🔵', '🔵'], caption: 'Nur noch 2 Steine – verloren' } },
    ],
  },
  {
    id: 'dame',
    name: 'Dame',
    tagline: 'Schräg ziehen, drüberspringen, Dame werden!',
    learn: 'Vorausdenken, Regeln einhalten und Fallen erkennen.',
    category: 'klassiker',
    minAge: 6,
    players: [2, 2],
    minutes: '10 Min',
    art: 'dame',
    kind: 'def',
    robo: true,
    levels: true,
    logic: true,
    tutorial: [
      { say: 'Jeder hat eine Farbe. Die Steine stehen nur auf den dunklen Feldern.', art: { k: 'art', art: 'dame' } },
      { say: 'Ein Stein zieht schräg ein Feld nach vorn. Tippe erst auf den Stein, dann auf das Ziel.', art: { k: 'grid', cols: 4, cells: [null, DK, null, DK, DK, null, DK, null, null, DK, null, DK, DK, null, '🔴', null], mark: [9, 11], point: 9 } },
      { say: 'Steht ein fremder Stein schräg vor dir und dahinter ist frei, springst du drüber und schlägst ihn. Schlagen ist Pflicht!', art: { k: 'grid', cols: 4, cells: [null, DK, null, DK, DK, null, DK, null, null, '🔵', null, DK, DK, null, '🔴', null], mark: [4], point: 4 } },
      { say: 'Kommst du auf der anderen Seite an, wird dein Stein eine Dame. Sie zieht schräg beliebig weit, auch rückwärts.', art: { k: 'pics', items: ['🔴', '➡️', '👑'], caption: 'Dame: schräg, so weit sie will' } },
      { say: 'Wer keinen Stein mehr hat oder nicht mehr ziehen kann, verliert.', art: { k: 'art', art: 'dame' } },
    ],
  },
  {
    id: 'slf',
    name: 'Stadt-Land-Fluss',
    tagline: 'Ein Buchstabe, viele Wörter – wem fällt am meisten ein?',
    learn: 'Wortschatz, Rechtschreibung und Allgemeinwissen.',
    category: 'sprache',
    minAge: 8,
    players: [2, 4],
    minutes: '8 Min',
    art: 'slf',
    kind: 'def',
    robo: true,
    levels: true,
    tutorial: [
      { say: 'Jede Runde gibt es einen Buchstaben, zum Beispiel B.', art: { k: 'pics', items: ['🅱️'] } },
      { say: 'Schreib zu jeder Spalte ein Wort mit diesem Buchstaben: eine Stadt, ein Tier, einen Namen …', art: { k: 'pics', items: ['🏙️', '🐻', '🙋'], caption: 'Berlin · Bär · Ben' } },
      { say: 'Hast du ein Wort ganz allein, gibt es 20 Punkte. Ein anderes als die anderen bringt 10, das gleiche 5.', art: { k: 'pics', items: ['2️⃣0️⃣', '1️⃣0️⃣', '5️⃣'] } },
      { say: 'Am Ende schauen alle die Antworten an. Quatsch-Wörter könnt ihr wegtippen.', art: { k: 'art', art: 'slf' } },
    ],
  },
  // ───── Arcade (aus Arta) ─────
  {
    id: 'schlange',
    name: 'Schlange',
    tagline: 'Sammle Herzen und werde immer länger.',
    learn: 'Reaktion und vorausschauend lenken.',
    category: 'arcade',
    minAge: 5,
    players: [1, 1],
    minutes: '2 Min',
    art: { emoji: '🐍', bg: '#DDEBDD' },
    kind: 'arcade',
    robo: false,
    levels: false,
    scoreLabel: 'Herzen',
    tutorial: [
      { say: 'Wische in eine Richtung oder tippe auf die Pfeile, dann biegt die Schlange ab.', art: { k: 'gesture', g: 'right' } },
      { say: 'Sammle Herzen, dann wird die Schlange länger.', art: { k: 'pics', items: ['🐍', '❤️'] } },
      { say: 'Nicht gegen die Wand fahren und dich nicht selbst beißen!', art: { k: 'art', art: { emoji: '🐍', bg: '#DDEBDD' } } },
    ],
  },
  {
    id: 'kloetzchen',
    name: 'Klötzchen',
    tagline: 'Steine drehen, Reihen voll machen, Reihen verschwinden lassen.',
    learn: 'Formen erkennen und räumlich denken.',
    category: 'arcade',
    minAge: 6,
    players: [1, 1],
    minutes: '4 Min',
    art: { emoji: '🧩', bg: '#E9E1F0' },
    kind: 'arcade',
    robo: false,
    levels: false,
    scoreLabel: 'Punkte',
    tutorial: [
      { say: 'Wische nach links oder rechts, um den Stein zu schieben.', art: { k: 'gesture', g: 'left' } },
      { say: 'Tippe, um ihn zu drehen. Wische nach unten, damit er schnell fällt.', art: { k: 'gesture', g: 'tap' } },
      { say: 'Ist eine Reihe voll, verschwindet sie. Der Stapel darf nicht oben anstoßen!', art: { k: 'art', art: { emoji: '🧩', bg: '#E9E1F0' } } },
    ],
  },
  {
    id: 'g2048',
    name: '2048',
    tagline: 'Gleiche Zahlen zusammenschieben bis zur 2048.',
    learn: 'Verdoppeln und vorausplanen.',
    category: 'arcade',
    minAge: 8,
    players: [1, 1],
    minutes: '5 Min',
    art: { emoji: '🔢', bg: '#F7EDC8' },
    kind: 'arcade',
    robo: false,
    levels: false,
    scoreLabel: 'Punkte',
    tutorial: [
      { say: 'Wische in eine Richtung. Alle Kacheln rutschen mit.', art: { k: 'gesture', g: 'up' } },
      { say: 'Zwei gleiche Zahlen werden zu einer doppelt so großen: 2 und 2 ergibt 4.', art: { k: 'pics', items: ['2️⃣', '➕', '2️⃣', '➡️', '4️⃣'] } },
      { say: 'Wie weit kommst du? Vorbei ist es, wenn nichts mehr geht.', art: { k: 'art', art: { emoji: '🔢', bg: '#F7EDC8' } } },
    ],
  },
  {
    id: 'flappy',
    name: 'Flatter-Vogel',
    tagline: 'Tippen, flattern, durch die Lücke!',
    learn: 'Rhythmus und Geschicklichkeit.',
    category: 'arcade',
    minAge: 5,
    players: [1, 1],
    minutes: '1 Min',
    art: { emoji: '🐦', bg: '#DCE9F3' },
    kind: 'arcade',
    robo: false,
    levels: false,
    scoreLabel: 'Säulen',
    tutorial: [
      { say: 'Tippe irgendwo hin, dann flattert das Herz nach oben.', art: { k: 'gesture', g: 'tap' } },
      { say: 'Flieg durch die Lücken. Jede Säule gibt einen Punkt. Nicht anstoßen!', art: { k: 'art', art: { emoji: '🐦', bg: '#DCE9F3' } } },
    ],
  },
  {
    id: 'huepfer',
    name: 'Hüpfer',
    tagline: 'Hüpf von Wolke zu Wolke immer höher.',
    learn: 'Reaktion und Koordination.',
    category: 'arcade',
    minAge: 5,
    players: [1, 1],
    minutes: '3 Min',
    art: { emoji: '🦘', bg: '#F6E1D8' },
    kind: 'arcade',
    robo: false,
    levels: false,
    scoreLabel: 'Meter',
    tutorial: [
      { say: 'Hüpfi springt von selbst. Halte links oder rechts gedrückt, um zu lenken.', art: { k: 'gesture', g: 'hold' } },
      { say: 'Federn und Ballons schießen dich nach oben. Fällst du unten raus, ist Schluss.', art: { k: 'art', art: { emoji: '🦘', bg: '#F6E1D8' } } },
    ],
  },
  {
    id: 'mampfer',
    name: 'Mampfer',
    tagline: 'Herzchen futtern und den Grummelgeistern ausweichen.',
    learn: 'Wege planen und schnell reagieren.',
    category: 'arcade',
    minAge: 6,
    players: [1, 1],
    minutes: '4 Min',
    art: { emoji: '👻', bg: '#E3E7EE' },
    kind: 'arcade',
    robo: false,
    levels: false,
    scoreLabel: 'Punkte',
    tutorial: [
      { say: 'Wische in eine Richtung, dann läuft Mampfi los.', art: { k: 'gesture', g: 'left' } },
      { say: 'Futtere alle Herzchen. Die Geister jagen dich – weich ihnen aus!', art: { k: 'pics', items: ['😋', '💗', '👻'] } },
      { say: 'Nach einem großen Herz werden die Geister blau. Dann kannst du sie fangen.', art: { k: 'art', art: { emoji: '👻', bg: '#E3E7EE' } } },
    ],
  },
  {
    id: 'breakout',
    name: 'Mauer-Brecher',
    tagline: 'Mauer abräumen, Ball nicht fallen lassen.',
    learn: 'Hand-Auge-Koordination.',
    category: 'arcade',
    minAge: 6,
    players: [1, 1],
    minutes: '3 Min',
    art: { emoji: '🧱', bg: '#F6E1D8' },
    kind: 'arcade',
    robo: false,
    levels: false,
    scoreLabel: 'Punkte',
    tutorial: [
      { say: 'Zieh den Finger hin und her, um den Schläger zu bewegen. Tippe für den Abschlag.', art: { k: 'gesture', g: 'drag' } },
      { say: 'Räum alle Steine ab. Du hast drei Leben.', art: { k: 'art', art: { emoji: '🧱', bg: '#F6E1D8' } } },
    ],
  },
  {
    id: 'tempel',
    name: 'Tempel-Lauf',
    tagline: 'Lauf, spring und rutsch durch den Dschungeltempel.',
    learn: 'Reaktion und schnelle Entscheidungen.',
    category: 'arcade',
    minAge: 7,
    players: [1, 1],
    minutes: '3 Min',
    art: { emoji: '🏃', bg: '#DDEBDD' },
    kind: 'arcade',
    robo: false,
    levels: false,
    scoreLabel: 'Punkte',
    tutorial: [
      { say: 'Wische nach links oder rechts, um die Spur zu wechseln.', art: { k: 'gesture', g: 'right' } },
      { say: 'Wische nach oben zum Springen und nach unten zum Rutschen.', art: { k: 'gesture', g: 'up' } },
      { say: 'An Kreuzungen wischst du in Pfeilrichtung. Sammle Herzen für Extrapunkte!', art: { k: 'art', art: { emoji: '🏃', bg: '#DDEBDD' } } },
    ],
  },
  {
    id: 'weltraum',
    name: 'Weltraum-Abwehr',
    tagline: 'Halte die Weltraum-Besucher auf, bevor sie landen.',
    learn: 'Zielen und ausweichen.',
    category: 'arcade',
    minAge: 6,
    players: [1, 1],
    minutes: '3 Min',
    art: { emoji: '👾', bg: '#E9E1F0' },
    kind: 'arcade',
    robo: false,
    levels: false,
    scoreLabel: 'Punkte',
    tutorial: [
      { say: 'Zieh den Finger, um dein Raumschiff zu steuern. Es schießt von selbst.', art: { k: 'gesture', g: 'drag' } },
      { say: 'Triff alle, bevor sie unten ankommen, und weich ihren Schüssen aus.', art: { k: 'art', art: { emoji: '👾', bg: '#E9E1F0' } } },
    ],
  },
  {
    id: 'ballblitz',
    name: 'Ball-Blitz',
    tagline: 'Zielen, abfeuern, Blöcke zerschmettern.',
    learn: 'Winkel einschätzen und abprallen lassen.',
    category: 'arcade',
    minAge: 7,
    players: [1, 1],
    minutes: '5 Min',
    art: { emoji: '☄️', bg: '#F7EDC8' },
    kind: 'arcade',
    robo: false,
    levels: false,
    scoreLabel: 'Runden',
    tutorial: [
      { say: 'Leg den Finger aufs Feld und ziel. Die Punkte zeigen den Weg.', art: { k: 'gesture', g: 'drag' } },
      { say: 'Lass los, dann fliegen die Bälle. Jeder Treffer macht einen Block kleiner.', art: { k: 'art', art: { emoji: '☄️', bg: '#F7EDC8' } } },
    ],
  },
  {
    id: 'tonecho',
    name: 'Ton-Echo',
    tagline: 'Hör gut zu und spiel die Melodie nach.',
    learn: 'Merkfähigkeit und Töne unterscheiden.',
    category: 'gedaechtnis',
    minAge: 4,
    players: [1, 1],
    minutes: '2 Min',
    art: { emoji: '🎵', bg: '#DDEBDD' },
    kind: 'arcade',
    robo: false,
    levels: false,
    scoreLabel: 'Runden',
    tutorial: [
      { say: 'Die Herzen leuchten nacheinander auf und spielen eine Melodie.', art: { k: 'pics', items: ['💚', '❤️', '💛', '💙'] } },
      { say: 'Tippe sie in der gleichen Reihenfolge nach. Jede Runde kommt eins dazu.', art: { k: 'gesture', g: 'tap' } },
    ],
  },
  {
    id: 'minen',
    name: 'Minen-Detektiv',
    tagline: 'Alle sicheren Felder finden – die Zahlen helfen dir.',
    learn: 'Logisches Schließen.',
    category: 'logik',
    minAge: 9,
    players: [1, 1],
    minutes: '3 Min',
    art: { emoji: '🔍', bg: '#E3E7EE' },
    kind: 'arcade',
    robo: false,
    levels: false,
    scoreLabel: 'Sek.',
    lowerIsBetter: true,
    tutorial: [
      { say: 'Tippe auf ein Feld, um es aufzudecken.', art: { k: 'gesture', g: 'tap' } },
      { say: 'Die Zahl verrät, wie viele Minen daneben liegen. Mit der Fahne markierst du sie.', art: { k: 'grid', cols: 3, cells: ['1', '1', '1', '1', '🚩', '1', '1', '1', '1'] } },
      { say: 'Deck alle sicheren Felder auf – je schneller, desto besser.', art: { k: 'art', art: { emoji: '🔍', bg: '#E3E7EE' } } },
    ],
  },
  {
    id: 'solitaer',
    name: 'Solitär',
    tagline: 'Die Karten-Geduld zum Entspannen.',
    learn: 'Reihenfolgen und Geduld.',
    category: 'arcade',
    minAge: 8,
    players: [1, 1],
    minutes: '6 Min',
    art: { emoji: '🃏', bg: '#DDEBDD' },
    kind: 'arcade',
    robo: false,
    levels: false,
    scoreLabel: 'Sek.',
    lowerIsBetter: true,
    tutorial: [
      { say: 'Leg Karten absteigend und abwechselnd rot und schwarz aufeinander.', art: { k: 'cards', cards: [{ t: '♠ 8' }, { t: '♥ 7', red: true }, { t: '♣ 6' }] } },
      { say: 'Oben sammelst du jede Farbe vom Ass bis zum König. Tippe eine Karte an, dann springt sie an den besten Platz.', art: { k: 'gesture', g: 'tap' } },
    ],
  },
  {
    id: 'pong',
    name: 'Pong-Duell',
    tagline: 'Setzt euch gegenüber – wer verpasst den Ball zuerst?',
    learn: 'Reaktion und Fairplay.',
    category: 'arcade',
    minAge: 5,
    players: [2, 2],
    minutes: '2 Min',
    art: { emoji: '🏓', bg: '#DCE9F3' },
    kind: 'duel',
    robo: true,
    levels: false,
    tutorial: [
      { say: 'Legt das Gerät flach zwischen euch. Jeder steuert den Schläger auf seiner Seite.', art: { k: 'gesture', g: 'drag' } },
      { say: 'Wer zuerst 5 Punkte hat, gewinnt.', art: { k: 'art', art: { emoji: '🏓', bg: '#DCE9F3' } } },
    ],
  },
  {
    id: 'blitz',
    name: 'Blitz-Duell',
    tagline: 'Wer tippt zuerst, wenn das Herz erscheint?',
    learn: 'Reaktion und Geduld.',
    category: 'arcade',
    minAge: 4,
    players: [2, 2],
    minutes: '1 Min',
    art: { emoji: '⚡', bg: '#F7EDC8' },
    kind: 'duel',
    robo: true,
    levels: false,
    tutorial: [
      { say: 'Jeder legt einen Finger auf seine Hälfte.', art: { k: 'gesture', g: 'hold' } },
      { say: 'Sobald das Herz erscheint: schnell tippen! Wer zu früh tippt, schenkt den Punkt her.', art: { k: 'pics', items: ['⏳', '💗', '👆'] } },
    ],
  },
];

export const GAME_BY_ID = Object.fromEntries(GAMES.map((g) => [g.id, g])) as Record<GameId, GameMeta>;

export const CATEGORY_ORDER: Category[] = ['mathe', 'sprache', 'logik', 'gedaechtnis', 'wissen', 'klassiker', 'arcade'];

export const playersText = (g: GameMeta) => (g.players[0] === g.players[1] ? `${g.players[0]}` : `${g.players[0]}–${g.players[1]}`);
