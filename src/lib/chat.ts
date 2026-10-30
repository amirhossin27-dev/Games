import { isRude } from './names';

/** Chat im Spielzimmer: kurze Nachrichten, ein Filter für Schimpfwörter und persönliche Daten. */

export const CHAT_MAX = 80;

/** Fertige Sätze – zum schnellen Antippen (und als einzige Möglichkeit, wenn Eltern das so wollen) */
export const QUICK_PHRASES = ['Hallo! 👋', 'Gut gemacht! 👍', 'Du bist dran!', 'Nochmal? 🔁', 'Warte kurz!', 'Hihi 😄', 'Viel Glück! 🍀', 'Tschüss! 👋'];

export function chatProblem(raw: string): string | null {
  const t = raw.trim();
  if (!t) return 'Schreib erst etwas.';
  if (t.length > CHAT_MAX) return `Höchstens ${CHAT_MAX} Zeichen.`;
  if (isRude(t)) return 'Das schreiben wir hier nicht. Versuch es netter!';
  // Keine Telefonnummern, E-Mails, Links oder Adressen
  if (/\d[\d\s\-/]{4,}\d|@|https?:|www\.|\.(de|com|net|org|at|ch)\b/i.test(t)) return 'Bitte keine Telefonnummern, E-Mails oder Links.';
  if (/(straße|strasse|str\.|whatsapp|insta|snapchat|tiktok|telefon|handynummer|adresse|wohnst du|wo wohnst)/i.test(t)) return 'Persönliches bleibt geheim – das schreiben wir nicht im Chat.';
  return null;
}
