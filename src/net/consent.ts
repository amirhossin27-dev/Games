import { getData, type Settings } from '../lib/store';
import { onlineConfigured } from './config';

/**
 * Online-Funktionen – Spielzimmer, Rangliste der Spielfreunde, Sicherung in der Cloud und
 * Spielerpass – gibt es erst, wenn die Eltern sie im Elternbereich erlaubt haben. Vorher bleibt
 * alles auf dem Gerät, und Joyboy legt auch kein Konto in der Cloud an.
 */
export const onlineAllowed = (s: Settings = getData().settings) => onlineConfigured() && s.online === true;
