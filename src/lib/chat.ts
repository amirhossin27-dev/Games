import type { ChatMsg } from '../net/roomLogic';
import { BAD_WORDS } from './names';
import type { Settings } from './store';

/**
 * Chat im Spielzimmer: fertige Sätze zum Antippen und – wenn die Eltern es nicht abgeschaltet
 * haben – eigene kurze Nachrichten. Der Wortfilter hier prüft dasselbe wie die Datenbank
 * (database.rules.json, gebaut mit `npm run rules`), damit nichts Unpassendes ankommt:
 * Schimpfwörter, Telefonnummern, E-Mails, Links und Fragen nach Adresse oder Nummer.
 */

export const CHAT_MAX = 60;

/** Fertige Sätze. Die Nummer wird mitgeschickt – Kinder, die nur fertige Sätze sehen dürfen, sehen nur diese. */
export const QUICK_SENTENCES = [
  'Hallo! 👋',
  'Lass uns spielen!',
  'Ich bin bereit! 🙌',
  'Warte kurz, bitte!',
  'Viel Glück! 🍀',
  'Gut gemacht! 👍',
  'Super Zug! ⭐',
  'Das war knapp! 😅',
  'Noch eine Runde?',
  'Du bist dran!',
  'Hihi 😄',
  'Danke fürs Spielen! 😊',
  'Tschüss! 👋',
] as const;

/** Wörter, die zusätzlich zu den Schimpfwörtern im Chat nicht gehen – damit niemand nach Kontaktdaten fragt. */
export const CHAT_WORDS = ['adresse', 'wohnst', 'telefon', 'handy', 'nummer', 'passwort'];

/** Diese Zeichen fallen weg, bevor nach langen Zahlen gesucht wird (wie in den Regeln) – auch „0176 12 34“ ist eine Nummer. */
const FOLD = /[\s.\-_/]/g;

const LINKS = ['@', 'http', 'www', '.com', '.net', '.org'];

export function chatProblem(raw: string): string | null {
  const text = raw.trim();
  if (!text) return 'Schreib erst etwas.';
  if (text.length > CHAT_MAX) return `Höchstens ${CHAT_MAX} Zeichen.`;
  const low = text.toLowerCase();
  if (/\d{4,}/.test(low.replace(FOLD, '')) || LINKS.some((w) => low.includes(w))) return 'Bitte keine Telefonnummern, E-Mails oder Links.';
  // Wörter: Satzzeichen fallen weg („a.r.s.c.h“), Leerzeichen bleiben – sonst wäre „das extra“ ein Schimpfwort.
  const letters = low.replace(/[^a-zäöüß\s]/g, '');
  if (BAD_WORDS.some((w) => letters.includes(w))) return 'Das schreiben wir hier nicht. Probier es netter!';
  if (CHAT_WORDS.some((w) => letters.includes(w))) return 'Persönliche Sachen wie Adresse oder Nummer bleiben geheim.';
  return null;
}

/** Dürfen die Kinder auf diesem Gerät selbst schreiben? (fehlt = ja, die Eltern können es abschalten) */
export const freeChat = (s: Settings) => s.chatFree !== false;

/** Text, den dieses Gerät zeigt – oder `null`, wenn die Nachricht hier nicht gezeigt wird. */
export function chatText(m: ChatMsg, myUid: string | null, settings: Settings): string | null {
  if (m.q !== undefined && QUICK_SENTENCES[m.q]) return QUICK_SENTENCES[m.q];
  // Nur fertige Sätze erlaubt: Selbstgeschriebenes der anderen bleibt verborgen
  if (!freeChat(settings) && m.by !== myUid) return null;
  // Was durch den Filter dieses Geräts nicht kommt, wird auch nicht gezeigt
  return chatProblem(m.t) ? null : m.t;
}
