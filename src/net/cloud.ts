import { onlineName } from '../lib/names';
import { levelOf } from '../lib/progress';
import { getData, normalizeProfile, setData, subscribe, type Friend, type Profile } from '../lib/store';
import { weekKey } from '../lib/util';
import { accountIds, accountOf, deleteAccount, ensureAuth, refreshAccount, setAccount } from './auth';
import { onlineConfigured } from './config';
import { onlineAllowed } from './consent';
import { dbRequest, SERVER_TIME } from './db';

/**
 * Spielstände in der Cloud: Jedes Profil liegt unter profiles/<Konto>. „public“ (Name, Avatar,
 * Sterne der Woche) dürfen Spielfreunde für die Rangliste lesen, „private“ (der ganze Spielstand)
 * nur das Kind selbst. Abgeglichen wird nach Zeitstempel – der neuere Stand gewinnt.
 * Das alles erst, wenn die Eltern Online erlaubt haben (consent.ts).
 */

export interface PublicProfile {
  name: string;
  avatar: string;
  color: string;
  stars: number;
  level: number;
  week: { id: string; stars: number };
}

function publicOf(p: Profile) {
  return {
    name: onlineName(p.name, p.avatar).slice(0, 16),
    avatar: p.avatar,
    color: p.color,
    stars: p.stars,
    level: levelOf(p.stars).level,
    week: p.week,
    at: SERVER_TIME,
  };
}

const pushed = new Map<string, number>();
let timer: number | undefined;
let syncing: Promise<void> | null = null;

async function pushProfile(p: Profile) {
  const acc = await ensureAuth(p.id);
  const token = acc.token!;
  await dbRequest('PUT', `profiles/${acc.uid}/public`, token, publicOf(p));
  await dbRequest('PUT', `profiles/${acc.uid}/private`, token, JSON.stringify(p));
  pushed.set(p.id, p.updatedAt);
}

async function pushChanged() {
  if (syncing || !navigator.onLine || !onlineAllowed()) return;
  syncing = (async () => {
    for (const p of getData().profiles) {
      // Eltern haben Online gerade ausgeschaltet
      if (!onlineAllowed()) break;
      if (pushed.get(p.id) === p.updatedAt) continue;
      await pushProfile(p).catch(() => {
        // offline oder Fehler – beim nächsten Mal wieder versuchen
      });
    }
  })().finally(() => {
    syncing = null;
  });
  await syncing;
}

function schedule(delay = 3000) {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void pushChanged(), delay);
}

/** Neuere Stände aus der Cloud holen (z. B. vom selben Kind auf einem anderen Gerät). */
async function pullNewer() {
  if (!onlineAllowed()) return;
  for (const p of getData().profiles) {
    if (!accountOf(p.id)) continue;
    try {
      const acc = await ensureAuth(p.id);
      const raw = await dbRequest<string | null>('GET', `profiles/${acc.uid}/private`, acc.token!);
      if (!raw) continue;
      const cloud = normalizeProfile(JSON.parse(raw) as Profile);
      const local = getData().profiles.find((x) => x.id === p.id);
      if (local && cloud.id === p.id && cloud.updatedAt > local.updatedAt) {
        const d = getData();
        setData({ ...d, profiles: d.profiles.map((x) => (x.id === p.id ? cloud : x)) }, true);
        pushed.set(p.id, cloud.updatedAt);
      } else if (local) pushed.set(p.id, local.updatedAt === cloud.updatedAt ? cloud.updatedAt : -1);
    } catch {
      // später nochmal
    }
  }
}

let started = false;

/** Einmal beim App-Start */
export function startCloudSync() {
  if (started || !onlineConfigured()) return;
  started = true;
  window.setTimeout(() => {
    void deleteLeftovers();
    void pullNewer().then(() => schedule(500));
  }, 1500);
  let allowed = onlineAllowed();
  subscribe(() => {
    // Eltern haben Online gerade erlaubt: erst neuere Stände holen, dann sichern
    if (onlineAllowed() && !allowed) void pullNewer().then(() => schedule(500));
    else schedule();
    allowed = onlineAllowed();
  });
  window.addEventListener('online', () => {
    void deleteLeftovers();
    schedule(500);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void pushChanged();
  });
}

/**
 * Spielstand und Konto eines Kindes in der Cloud löschen (Kind entfernt oder Online-Daten
 * gelöscht). Klappt es nicht (offline), bleibt das Konto gemerkt und wird später gelöscht.
 */
export async function deleteCloudProfile(profileId: string): Promise<boolean> {
  if (!accountOf(profileId)) return true;
  // Erst eine laufende Sicherung abwarten – sonst legt sie die Daten gleich wieder an.
  await syncing;
  try {
    const fresh = await ensureAuth(profileId);
    await dbRequest('DELETE', `profiles/${fresh.uid}/public`, fresh.token!);
    await dbRequest('DELETE', `profiles/${fresh.uid}/private`, fresh.token!);
    // Danach auch das anonyme Konto – damit gilt auch ein alter Spielerpass nicht mehr.
    await deleteAccount(fresh).catch(() => undefined);
  } catch (e) {
    // Gibt es das Konto schon nicht mehr, ist nichts mehr zu löschen.
    if (!(e instanceof Error && /USER_NOT_FOUND|USER_DISABLED|INVALID_REFRESH_TOKEN|TOKEN_EXPIRED/.test(e.message))) return false;
  }
  setAccount(profileId, undefined);
  pushed.delete(profileId);
  return true;
}

/** Alle Online-Daten der Kinder auf diesem Gerät löschen. Ergebnis: hat alles geklappt? */
export async function deleteAllCloudData(): Promise<boolean> {
  const results = await Promise.all(accountIds().map((id) => deleteCloudProfile(id)));
  return results.every(Boolean);
}

/** Konten von Kindern, die es hier nicht mehr gibt, nachträglich löschen (z. B. offline entfernt). */
async function deleteLeftovers() {
  const ids = new Set(getData().profiles.map((p) => p.id));
  for (const id of accountIds()) if (!ids.has(id)) await deleteCloudProfile(id);
}

export const hasCloudData = () => accountIds().length > 0;

// ───── Spielfreunde ─────

/** Mitspieler aus dem Online-Zimmer als Spielfreunde merken. */
export function rememberFriends(profileId: string, friends: Record<string, Friend>) {
  const d = getData();
  const p = d.profiles.find((x) => x.id === profileId);
  if (!p) return;
  const me = accountOf(profileId)?.uid;
  const next = { ...p.friends };
  let changed = false;
  for (const [uid, f] of Object.entries(friends)) {
    if (uid === me) continue;
    const old = next[uid];
    if (!old || old.name !== f.name || old.avatar !== f.avatar || old.color !== f.color) {
      next[uid] = f;
      changed = true;
    }
  }
  if (changed) setData({ ...d, profiles: d.profiles.map((x) => (x.id === profileId ? { ...x, friends: next } : x)) });
}

/** Wochensterne der Spielfreunde (für die Rangliste) */
export async function loadFriends(profileId: string): Promise<{ uid: string; info: PublicProfile }[]> {
  const p = getData().profiles.find((x) => x.id === profileId);
  if (!p || !Object.keys(p.friends).length || !onlineAllowed()) return [];
  const acc = await ensureAuth(profileId);
  const out: { uid: string; info: PublicProfile }[] = [];
  await Promise.all(
    Object.keys(p.friends).map(async (uid) => {
      try {
        const info = await dbRequest<PublicProfile | null>('GET', `profiles/${uid}/public`, acc.token!);
        if (info) out.push({ uid, info: { ...info, week: info.week?.id === weekKey() ? info.week : { id: weekKey(), stars: 0 } } });
      } catch {
        // Freund hat sein Profil gelöscht
      }
    }),
  );
  return out;
}

// ───── Spielerpass ─────

const b64url = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

/** Link, mit dem ein Kind seinen Spielstand auf ein anderes Gerät mitnimmt. */
export async function makePass(profileId: string): Promise<string> {
  if (!onlineAllowed()) throw new Error('Online ist aus');
  const p = getData().profiles.find((x) => x.id === profileId);
  if (p) await pushProfile(p);
  const acc = accountOf(profileId);
  if (!acc) throw new Error('kein Konto');
  return `${location.origin}${location.pathname}#pass=${b64url(JSON.stringify({ r: acc.refresh }))}`;
}

/** Spielerpass einlösen: Profil aus der Cloud holen und auf diesem Gerät anlegen. */
export async function redeemPass(code: string): Promise<Profile> {
  if (!onlineAllowed()) throw new Error('Online ist aus');
  const { r } = JSON.parse(unb64url(code)) as { r: string };
  const acc = await refreshAccount(r);
  const raw = await dbRequest<string | null>('GET', `profiles/${acc.uid}/private`, acc.token!);
  if (!raw) throw new Error('Kein Spielstand gefunden');
  const profile = normalizeProfile(JSON.parse(raw) as Profile);
  setAccount(profile.id, acc);
  const d = getData();
  const exists = d.profiles.some((x) => x.id === profile.id);
  setData({ ...d, profiles: exists ? d.profiles.map((x) => (x.id === profile.id ? profile : x)) : [...d.profiles, profile], active: profile.id }, true);
  pushed.set(profile.id, profile.updatedAt);
  return profile;
}
