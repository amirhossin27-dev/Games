/**
 * Firebase-Projekt für Online-Spielzimmer und Cloud-Spielstände (siehe docs/FIREBASE.md).
 * Der API-Key ist kein Geheimnis – geschützt wird alles durch database.rules.json.
 * Beim Bauen lassen sich beide Werte mit VITE_JOYBOY_API_KEY / VITE_JOYBOY_DB_URL überschreiben.
 */
const DEFAULT_API_KEY = 'AIzaSyDiYPOg-TL5kf4yHjGcir6-GKCvboB1jcc';
const DEFAULT_DB_URL = 'https://joyboy-916f0-default-rtdb.europe-west1.firebasedatabase.app';

export const API_KEY: string = (import.meta.env?.VITE_JOYBOY_API_KEY as string | undefined) ?? DEFAULT_API_KEY;
export const DB_URL: string = ((import.meta.env?.VITE_JOYBOY_DB_URL as string | undefined) ?? DEFAULT_DB_URL).replace(/\/+$/, '');

export const onlineConfigured = () => !!API_KEY && !!DB_URL && typeof fetch !== 'undefined';
