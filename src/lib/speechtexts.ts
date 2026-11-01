import type { Task } from '../learn/tasks';
import { learnText } from './unlock';

/**
 * Texte, die Joy anders vorliest, als sie auf dem Bildschirm stehen.
 * Der Satz-Sammler (scripts/stimme/saetze.ts) nutzt dieselben Funktionen, damit es für jeden Satz eine Aufnahme gibt.
 */

/** Lern-Tipp nach einer falschen Antwort. Bei Bild-Antworten ohne „Richtig ist …“. */
export function tipSpeech(task: Pick<Task, 'options' | 'correct' | 'explain' | 'pictures'>): string {
  const explain = task.explain ?? '';
  return task.pictures ? explain : `Richtig ist ${task.options[task.correct]}. ${explain}`;
}

/** Gesperrtes Spiel („Erst lernen, dann spielen“) – ohne Spielnamen, damit es wenige Aufnahmen braucht. */
export const lockSpeech = (left: number) => `Erst lernen, dann spielen! Spiel vorher ${learnText(left)}.`;
