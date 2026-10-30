import { levelOf } from '../lib/progress';
import { getData, normalizeProfile, setData, subscribe, type Friend, type Profile } from '../lib/store';
import { weekKey } from '../lib/util';
import { accountOf, ensureAuth, refreshAccount, setAccount } from './auth';
import { onlineConfigured } from './config';
import { dbRequest, SERVER_TIME } from './db';

/**
 * Spielstände in der Cloud: Jedes Profil liegt unter profiles/<Konto>. „public“ (Name, Avatar,
 * Sterne der Woche) dürfen Spielfreunde für die Rangliste lesen, „private“ (der ganze Spielstand)
 * nur das Kind selbst. Abgeglichen wird nach Zeitstempel – der neuere Stand gewinnt.
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
    name: p.name.slice(0, 16),
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
let syncing = false;

async function pushProfile(p: Profile) {
  const acc = await ensureAuth(p.id);
  const token = acc.token!;
  // PATCH statt PUT: „on“/„room“ (Anwesenheit für Freunde) bleiben stehen
  await dbRequest('PATCH', `profiles/${acc.uid}/public`, token, publicOf(p));
  await dbRequest('PUT', `profiles/${acc.uid}/private`, token, JSON.stringify(p));
  pushed.set(p.id, p.updatedAt);
}

async function pushChanged() {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  try {
    for (const p of getData().profiles) {
      if (pushed.get(p.id) === p.updatedAt) continue;
      await pushProfile(p).catch(() => {
        // offline oder Fehler – beim nächsten Mal wieder versuchen
      });
    }
  } finally {
    syncing = false;
  }
}

function schedule(delay = 3000) {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void pushChanged(), delay);
}

/** Neuere Stände aus der Cloud holen (z. B. vom selben Kind auf einem anderen Gerät). */
async function pullNewer() {
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

/** Liegt das öffentliche Profil schon in der Cloud? (vorher kann sich das Kind nicht als „online“ melden) */
export const isPublished = (profileId: string) => (pushed.get(profileId) ?? -1) > 0;

let started = false;

/** Einmal beim App-Start */
export function startCloudSync() {
  if (started || !onlineConfigured()) return;
  started = true;
  window.setTimeout(() => {
    void pullNewer().then(() => schedule(500));
  }, 1500);
  subscribe(() => schedule());
  window.addEventListener('online', () => schedule(500));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void pushChanged();
  });
}

/** Profil auch in der Cloud löschen (wenn Eltern ein Kind entfernen). */
export async function deleteCloudProfile(profileId: string) {
  const acc = accountOf(profileId);
  if (!acc) return;
  try {
    const fresh = await ensureAuth(profileId);
    await dbRequest('DELETE', `profiles/${fresh.uid}/public`, fresh.token!);
    await dbRequest('DELETE', `profiles/${fresh.uid}/private`, fresh.token!);
  } catch {
    // offline – die Daten bleiben dann in der Cloud liegen
  }
  setAccount(profileId, undefined);
}

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
  if (!p || !Object.keys(p.friends).length) return [];
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
  const p = getData().profiles.find((x) => x.id === profileId);
  if (p) await pushProfile(p);
  const acc = accountOf(profileId);
  if (!acc) throw new Error('kein Konto');
  return `${location.origin}${location.pathname}#pass=${b64url(JSON.stringify({ r: acc.refresh }))}`;
}

/** Spielerpass einlösen: Profil aus der Cloud holen und auf diesem Gerät anlegen. */
export async function redeemPass(code: string): Promise<Profile> {
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
