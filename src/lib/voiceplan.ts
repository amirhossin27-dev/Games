/**
 * Joys Stimme: Welche Tondateien gehören zu einem Text?
 *
 * Jeder Satz, den Joy sagt, ist vorab als kleine Tondatei aufgenommen (siehe scripts/stimme).
 * Gesucht wird zuerst der ganze Satz. Fehlt er, wird er aus Bausteinen zusammengesetzt:
 * Textstücke und einzeln gesprochene Zahlen („Wie viel ist“ + „57“ + „plus“ + „23?“).
 * Sätze, für die es keine Aufnahme gibt (z. B. mit selbst getippten Namen), lässt Joy aus.
 *
 * Dieses Modul ist bewusst ohne Browser-Abhängigkeit: Es läuft auch im Satz-Sammler und in Tests.
 */

const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/gu;

/** Einheitliche Schreibweise eines Textes – so heißen auch die Einträge im Stimmen-Verzeichnis. */
export function voiceKey(text: string): string {
  return (
    text
      .normalize('NFC')
      .replace(EMOJI, '')
      .replace(/[„“”"«»‚‘’]/g, (q) => (q === '’' || q === '‘' || q === '‚' ? "'" : ''))
      .replace(/\s*[–—]\s*/g, ', ')
      .replace(/…/g, '')
      .replace(/\s+\+\s+/g, ' plus ')
      .replace(/\s+[−-]\s+/g, ' minus ')
      .replace(/\s+=\s+/g, ' gleich ')
      .replace(/\s+·\s+/g, ' mal ')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.!?:;])/g, '$1')
      .replace(/,(\s*[,.!?])/g, '$1')
      .replace(/^[\s,]+|[\s,]+$/g, '')
      .trim()
  );
}

/** Text in Sätze teilen (nach . ! ? und vor dem nächsten Wort). */
export function sentences(text: string): string[] {
  const key = voiceKey(text);
  if (!key) return [];
  return key
    .split(/(?<=[.!?])\s+(?=\S)/)
    .map((s) => s.trim())
    .filter((s) => /[\p{L}\d]/u.test(s));
}

const NUMBER = /(\d{1,2}:\d{2}|\d+)/;

/** Schlüssel einer Zahl. Am Satzende mit Satzzeichen, damit die Betonung passt. */
export const numberKey = (n: string, end: '' | '.' | '?' | '!' = '') => `#${n}${end === '!' ? '.' : end}`;

/**
 * Satz aus Bausteinen: Textstücke zwischen den Zahlen und die Zahlen selbst.
 * Gibt null zurück, wenn der Satz keine Zahl enthält.
 */
export function compose(sentence: string): string[] | null {
  const pieces = sentence.split(NUMBER);
  if (pieces.length < 3) return null;
  const out: string[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (i % 2 === 1) {
      const rest = pieces.slice(i + 1).join('');
      const end = /^\s*([.!?])\s*$/.exec(rest)?.[1] as '.' | '?' | '!' | undefined;
      out.push(numberKey(p, end ?? ''));
      if (end) break;
      continue;
    }
    const t = p
      .replace(/^[\s,:;-]+/, '')
      .replace(/[\s,:;-]+$/, '')
      .trim();
    if (/[\p{L}]/u.test(t)) out.push(t);
  }
  return out;
}

/**
 * Welche Aufnahmen spielen wir für diesen Text ab? `has` sagt, ob es eine Aufnahme gibt.
 * Ergebnis: je Satz die Aufnahmen, die nacheinander laufen. Sätze ohne Aufnahme fehlen.
 * Ein Array sind mehrere Teile, die einzeln gesucht werden (z. B. Tiernamen im Zimmer-Code).
 */
export function planVoice(text: string | string[], has: (key: string) => boolean): string[][] {
  const parts = Array.isArray(text) ? text : [text];
  const out: string[][] = [];
  for (const part of parts)
    for (const s of sentences(part)) {
      if (has(s)) {
        out.push([s]);
        continue;
      }
      const c = compose(s);
      if (c && c.length && c.every(has)) out.push(c);
    }
  return out;
}

/**
 * Für den Satz-Sammler: Welche Aufnahmen braucht dieser Text? Feste Sätze werden immer ganz
 * aufgenommen. Bei Rechenaufgaben und Uhrzeiten gibt es zu viele Möglichkeiten: Dort wird ein Satz
 * aus Bausteinen gebaut, sobald eine Zahl größer als `wholeUpTo` ist oder eine Uhrzeit wie 9:05 vorkommt.
 */
export function neededKeys(text: string | string[], wholeUpTo = Infinity): string[] {
  const parts = Array.isArray(text) ? text : [text];
  const out: string[] = [];
  for (const part of parts)
    for (const s of sentences(part)) {
      const nums = s.match(new RegExp(NUMBER, 'g')) ?? [];
      const whole = nums.every((n) => !n.includes(':') && Number(n) <= wholeUpTo);
      if (whole) out.push(s);
      else out.push(...(compose(s) ?? [s]));
    }
  return out;
}
