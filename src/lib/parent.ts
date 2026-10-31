import { actions, getData, type ParentLock } from './store';

/**
 * Eltern-Passwort: gespeichert wird nur ein Hash (PBKDF2, 120 000 Runden) mit zufälligem Salz.
 * Dazu gibt es einmalig einen Notfall-Code, falls das Passwort vergessen wird.
 */

const enc = new TextEncoder();
const ITERATIONS = 120_000;

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(secret: string, salt: Uint8Array): Promise<string> {
  const normalized = secret.normalize('NFC');
  if (globalThis.crypto?.subtle) {
    const key = await crypto.subtle.importKey('raw', enc.encode(normalized), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: ITERATIONS }, key, 256);
    return b64(new Uint8Array(bits));
  }
  // Ohne sichere Verbindung (z. B. im lokalen Netz über http) gibt es kein WebCrypto – dann ein einfacher Hash.
  let h = 2166136261;
  for (const c of b64(salt) + normalized) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return `fnv:${(h >>> 0).toString(16)}`;
}

const newSalt = () => crypto.getRandomValues(new Uint8Array(16));

/** Notfall-Code: 8 Zeichen ohne Verwechslungsgefahr (kein 0/O, 1/I/L). */
export function makeRecoveryCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const raw = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

const cleanCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');

export const PASSWORD_MIN = 4;

export async function setParentPassword(password: string): Promise<string> {
  const code = makeRecoveryCode();
  const salt = newSalt();
  const rsalt = newSalt();
  const lock: ParentLock = { salt: b64(salt), hash: await derive(password, salt), rsalt: b64(rsalt), rhash: await derive(cleanCode(code), rsalt) };
  actions.setParent(lock);
  return code;
}

export async function checkParentPassword(password: string): Promise<boolean> {
  const lock = getData().parent;
  if (!lock) return false;
  return (await derive(password, unb64(lock.salt))) === lock.hash;
}

export async function checkRecoveryCode(code: string): Promise<boolean> {
  const lock = getData().parent;
  if (!lock) return false;
  return (await derive(cleanCode(code), unb64(lock.rsalt))) === lock.rhash;
}

export const hasParentPassword = () => !!getData().parent;
