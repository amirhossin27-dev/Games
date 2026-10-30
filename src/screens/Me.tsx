import { useEffect, useState } from 'react';
import { loadFriends, type PublicProfile } from '../net/cloud';
import type { AvatarKind } from '../lib/names';
import { GAMES } from '../games/registry';
import { nav } from '../lib/nav';
import { BADGES, levelOf } from '../lib/progress';
import { AGE_LABEL, actions, useData, type Profile } from '../lib/store';
import { weekKey } from '../lib/util';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';

interface InstallEvent extends Event {
  prompt(): Promise<void>;
}

let deferred: InstallEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
  });
}

const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function InstallCard() {
  const [canPrompt, setCanPrompt] = useState(!!deferred);
  useEffect(() => {
    const on = () => setCanPrompt(true);
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);
  if (standalone()) return null;
  return (
    <section className="card stitched col" aria-label="Als App installieren">
      <b className="display">Joyboy als App</b>
      {isIOS() ? (
        <p className="small">
          Tippe in Safari unten auf <b>Teilen</b> (Quadrat mit Pfeil) und dann auf <b>„Zum Home-Bildschirm“</b>. Danach startet Joyboy wie eine richtige App.
        </p>
      ) : canPrompt ? (
        <button
          type="button"
          className="btn primary small"
          onClick={async () => {
            await deferred?.prompt();
            deferred = null;
            setCanPrompt(false);
          }}
        >
          Auf den Startbildschirm legen
        </button>
      ) : (
        <p className="small">
          Im Browser-Menü (⋮) <b>„App installieren“</b> oder <b>„Zum Startbildschirm hinzufügen“</b> wählen.
        </p>
      )}
    </section>
  );
}

export function Me({ profile }: { profile: Profile }) {
  const data = useData();
  const lvl = levelOf(profile.stars);
  const played = Object.values(profile.games).reduce((a, g) => a + g.played, 0);
  const won = Object.values(profile.games).reduce((a, g) => a + g.won, 0);
  const week = weekKey();
  const [friends, setFriends] = useState<{ uid: string; info: PublicProfile }[]>([]);
  useEffect(() => {
    let alive = true;
    loadFriends(profile.id)
      .then((list) => alive && setFriends(list))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [profile.id]);
  const ranking: { key: string; name: string; avatar: AvatarKind; color: string; stars: number; me: boolean; friend: boolean }[] = [
    ...data.profiles.map((p) => ({ key: p.id, name: p.name, avatar: p.avatar, color: p.color, stars: p.week.id === week ? p.week.stars : 0, me: p.id === profile.id, friend: false })),
    ...friends.map((f) => ({ key: f.uid, name: f.info.name, avatar: f.info.avatar as AvatarKind, color: f.info.color, stars: f.info.week.stars, me: false, friend: true })),
  ].sort((a, b) => b.stars - a.stars);
  const favorite = Object.entries(profile.games).sort((a, b) => b[1].played - a[1].played)[0];

  return (
    <section className="screen">
      <div className="topbar">
        <h1>Ich</h1>
        <button type="button" className="btn secondary small" onClick={() => nav.go({ name: 'parents' })}>
          <Icon name="lock" size={18} /> Für Eltern
        </button>
      </div>

      <section className="card col" aria-label="Mein Profil" style={{ gap: 14 }}>
        <div className="row" style={{ gap: 14 }}>
          <Avatar kind={profile.avatar} size={84} bg={profile.color} />
          <div className="grow">
            <h2>{profile.name}</h2>
            <p className="small muted">
              Level {lvl.level} · {lvl.name} · {AGE_LABEL[profile.age]} Jahre
            </p>
          </div>
          <button type="button" className="icon-btn soft" aria-label="Profil ändern" onClick={() => nav.go({ name: 'welcome', edit: profile.id })}>
            <Icon name="pencil" />
          </button>
        </div>
        <div className="bar" aria-label={`noch ${lvl.toNext} Sterne bis zum nächsten Level`}>
          <i style={{ width: `${lvl.progress * 100}%` }} />
        </div>
        <div className="stats3">
          <div>
            <b>{profile.stars}</b>
            <span>Sterne</span>
          </div>
          <div>
            <b>{played}</b>
            <span>Spiele</span>
          </div>
          <div>
            <b>{won}</b>
            <span>Siege</span>
          </div>
        </div>
        {favorite && <p className="small muted">Lieblingsspiel: {GAMES.find((g) => g.id === favorite[0])?.name}</p>}
      </section>

      <section className="col" aria-label="Abzeichen" style={{ gap: 12 }}>
        <div className="row between">
          <h2>Abzeichen</h2>
          <span className="small muted">
            {profile.badges.length} von {BADGES.length}
          </span>
        </div>
        <div className="badge-grid">
          {BADGES.map((b) => {
            const got = profile.badges.includes(b.id);
            return (
              <div key={b.id} className={got ? 'badge' : 'badge locked'}>
                <span className="medal" style={{ background: b.color }}>
                  <Icon name={b.icon} size={26} />
                </span>
                <span>{b.name}</span>
                <span className="small muted" style={{ fontWeight: 400 }}>
                  {got ? b.text : `${Math.min(b.have(profile), b.need)} / ${b.need}`}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {ranking.length > 1 && (
        <section className="card col" aria-label="Rangliste der Woche">
          <div className="row between">
            <h2>Rangliste der Woche</h2>
            <span className="tag">{friends.length ? 'mit Spielfreunden' : 'dieses Gerät'}</span>
          </div>
          <div className="rank-list">
            {ranking.map((r, i) => (
              <div key={r.key} className={r.me ? 'rank-row me' : 'rank-row'}>
                <span className="place">{i + 1}</span>
                <Avatar kind={r.avatar} size={36} bg={r.color} />
                <span className="grow display">{r.me ? 'Du' : r.name}</span>
                {r.friend && <span className="small muted">online</span>}
                <span className="display">{r.stars} ★</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <button
        type="button"
        className="btn secondary block"
        onClick={() => {
          actions.setActive(null);
          nav.go({ name: 'who' });
        }}
      >
        <Icon name="users" /> Kind wechseln
      </button>

      <InstallCard />
    </section>
  );
}
