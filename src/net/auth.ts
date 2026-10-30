import { API_KEY } from './config';

/**
 * Jedes Kind (Profil) bekommt im Hintergrund ein eigenes, anonymes Firebase-Konto – ohne E-Mail
 * und ohne Passwort. Nur über REST (kein SDK): ein Aufruf zum Anlegen, einer zum Erneuern des
 * Schlüssels, der eine Stunde gilt. Damit kann nur dieses Gerät den Spielstand dieses Kindes ändern.
 */

export interface Account {
  uid: string;
  refresh: string;
  token?: string;
  /** Ablauf des Tokens (ms) */
  exp?: number;
}

const KEY = 'joyboy:auth:v1';

function load(): Record<string, Account> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Account>;
  } catch {
    return {};
  }
}

let accounts: Record<string, Account> = typeof localStorage === 'undefined' ? {} : load();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(accounts));
  } catch {
    // ignorieren
  }
}

export const accountOf = (profileId: string): Account | undefined => accounts[profileId];

export function setAccount(profileId: string, acc: Account | undefined) {
  if (acc) accounts = { ...accounts, [profileId]: acc };
  else {
    const { [profileId]: _gone, ...rest } = accounts;
    accounts = rest;
  }
  save();
}

async function post(url: string, body: Record<string, string | boolean>, form = false) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' },
    body: form ? new URLSearchParams(body as Record<string, string>).toString() : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`);
  return data as Record<string, string>;
}

/** Neues anonymes Konto */
async function signUp(): Promise<Account> {
  const d = await post(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, { returnSecureToken: true });
  return { uid: d.localId, refresh: d.refreshToken, token: d.idToken, exp: Date.now() + Number(d.expiresIn) * 1000 };
}

/** Frischen Schlüssel holen (auch für den Spielerpass auf einem neuen Gerät) */
export async function refreshAccount(refresh: string): Promise<Account> {
  const d = await post(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, { grant_type: 'refresh_token', refresh_token: refresh }, true);
  return { uid: d.user_id, refresh: d.refresh_token, token: d.id_token, exp: Date.now() + Number(d.expires_in) * 1000 };
}

const pending = new Map<string, Promise<Account>>();

/** Gültiger Schlüssel für dieses Kind – legt das Konto beim ersten Mal an. */
export function ensureAuth(profileId: string, force = false): Promise<Account> {
  const acc = accounts[profileId];
  if (acc?.token && acc.exp && acc.exp - 120_000 > Date.now() && !force) return Promise.resolve(acc);
  const running = pending.get(profileId);
  if (running) return running;
  const p = (acc ? refreshAccount(acc.refresh) : signUp())
    .then((fresh) => {
      setAccount(profileId, fresh);
      return fresh;
    })
    .finally(() => pending.delete(profileId));
  pending.set(profileId, p);
  return p;
}
