/**
 * Mut-mach-Sprüche für die Startseite (statt der früheren Tagesaufgabe).
 * Bei jedem Start der App kommt ein neuer Spruch. Die Reihenfolge ist ein gemischter Stapel:
 * Erst wenn alle 30 einmal dran waren, wird neu gemischt – so wiederholt sich lange nichts.
 */
export const SPRUECHE: readonly string[] = [
  'Du kannst mehr, als du denkst!',
  'Fehler sind deine Helfer. Sie zeigen dir, wie es besser geht.',
  'Jeder Profi hat mal ganz klein angefangen.',
  'Mit jedem Üben wirst du ein bisschen besser.',
  'Mutig ist, wer es einfach mal versucht.',
  'Du bist super – genau so, wie du bist.',
  'Gib nicht auf – du schaffst das!',
  'Auch kleine Schritte bringen dich ans Ziel.',
  'Wer Fragen stellt, lernt am meisten.',
  'Heute ist ein toller Tag, um etwas Neues zu lernen.',
  'Dein Kopf wird mit jeder Aufgabe stärker.',
  'Lachen macht vieles leichter.',
  'Zusammen macht es doppelt so viel Spaß.',
  'Sei stolz auf dich – du gibst dein Bestes!',
  '„Ich kann das noch nicht“ heißt: Bald kannst du es!',
  'Neugier ist deine Superkraft.',
  'Freundlich sein macht die Welt schöner.',
  'Jeder Tag ist ein neues Abenteuer.',
  'Langsam ist auch gut. Hauptsache, du bleibst dran.',
  'Verlieren gehört dazu. Beim nächsten Mal klappt es vielleicht!',
  'Joy glaubt an dich!',
  'Wenn es schwierig ist, lernst du gerade besonders viel.',
  'Ein Lächeln steckt an – probier es aus!',
  'Deine Ideen sind wichtig.',
  'Mit Geduld schaffst du fast alles.',
  'Wer anderen hilft, ist ein echter Held.',
  'Pausen sind wichtig. Auch Superhelden ruhen sich aus.',
  'Ausprobieren ist der beste Weg, etwas zu lernen.',
  'Jeder kann etwas besonders gut – auch du!',
  'Tief durchatmen, dann geht es leichter.',
];

/** Gemischte Reihenfolge der Sprüche und Stelle des zuletzt gezeigten Spruchs. */
export interface SpruchDeck {
  order: number[];
  pos: number;
}

const KEY = 'joyboy:spruch:v1';

function shuffled(n: number, rnd: () => number, notFirst?: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  // Der erste Spruch des neuen Stapels soll nicht der letzte des alten sein.
  if (n > 1 && a[0] === notFirst) [a[0], a[n - 1]] = [a[n - 1], a[0]];
  return a;
}

function isDeck(d: unknown, n: number): d is SpruchDeck {
  if (!d || typeof d !== 'object') return false;
  const { order, pos } = d as SpruchDeck;
  if (!Array.isArray(order) || order.length !== n || !Number.isInteger(pos) || pos < 0 || pos >= n) return false;
  const seen = new Set(order);
  return seen.size === n && order.every((i) => Number.isInteger(i) && i >= 0 && i < n);
}

/** Nächster Spruch aus dem Stapel. Ein fehlender oder kaputter Stapel wird neu gemischt. */
export function nextSpruch(saved: unknown, n = SPRUECHE.length, rnd: () => number = Math.random): { index: number; deck: SpruchDeck } {
  if (!isDeck(saved, n)) {
    const order = shuffled(n, rnd);
    return { index: order[0], deck: { order, pos: 0 } };
  }
  if (saved.pos + 1 < n) {
    const pos = saved.pos + 1;
    return { index: saved.order[pos], deck: { order: saved.order, pos } };
  }
  const order = shuffled(n, rnd, saved.order[saved.pos]);
  return { index: order[0], deck: { order, pos: 0 } };
}

let current: string | null = null;

/** Der Spruch für diesen Start der App. Er bleibt gleich, bis die App neu geöffnet wird. */
export function startSpruch(): string {
  if (current !== null) return current;
  let saved: unknown = null;
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {
    // Kein Speicher (z. B. privates Fenster): dann eben ein zufälliger Spruch.
  }
  const { index, deck } = nextSpruch(saved);
  try {
    localStorage.setItem(KEY, JSON.stringify(deck));
  } catch {
    // siehe oben
  }
  current = SPRUECHE[index];
  return current;
}
