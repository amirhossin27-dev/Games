import { useEffect, useState, type CSSProperties } from 'react';
import { GAME_BY_ID } from '../games/registry';
import { nav } from '../lib/nav';
import type { Profile } from '../lib/store';
import { cls } from '../lib/util';
import { codeAnimals, codeWords } from '../net/codes';
import { canJoin, dropInvite, isOnline, presenceNow, refreshFriends, sendInvite, usePresence, type Invite, type Presence } from '../net/presence';
import { forgetRecent, recentRooms, type RecentRoom } from '../net/recent';
import { CLOSED, joinRoom, NO_ROOM, useRoom } from '../net/room';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import { toast } from '../ui/parts';

/**
 * Schneller zusammen spielen: zuletzt besuchte Zimmer (ein Tipp statt sechs Tiere),
 * Spielfreunde mit Online-Punkt und Einladungen.
 */

/** Alle paar Sekunden neu zeichnen, damit „online“ stimmt */
function useTick(ms = 10_000) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((x) => x + 1), ms);
    return () => window.clearInterval(t);
  }, [ms]);
}

function SmallCode({ code }: { code: string }) {
  return (
    <span className="code-mini" aria-label={`Code: ${codeWords(code)}`}>
      {codeAnimals(code).map((a, i) => (
        <span key={i} aria-hidden="true">
          {a.e}
        </span>
      ))}
    </span>
  );
}

/** Zuletzt besuchte Zimmer: mit einem Tipp wieder rein (eigene Zimmer: wieder öffnen) */
export function RecentRooms({ profile }: { profile: Profile }) {
  const [list, setList] = useState<RecentRoom[]>(() => recentRooms(profile.id));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ code: string; text: string } | null>(null);
  if (!list.length) return null;

  const enter = async (r: RecentRoom) => {
    setBusy(r.code);
    setError(null);
    try {
      await joinRoom(profile, r.code);
    } catch (e) {
      const text = (e as Error).message;
      if (text === NO_ROOM) {
        // Das Zimmer gibt es nicht mehr → aus der Liste nehmen
        forgetRecent(profile.id, r.code);
        setList(recentRooms(profile.id));
        toast('Dieses Zimmer gibt es nicht mehr.');
      } else setError({ code: r.code, text: text === CLOSED ? `${r.host.name} hat das Zimmer gerade zugemacht.` : text });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="card col" aria-label="Zuletzt im Zimmer" style={{ gap: 10 }}>
      <h2>Zuletzt im Zimmer</h2>
      <div className="seat-list">
        {list.map((r) => {
          const meta = GAME_BY_ID[r.game];
          return (
            <div key={r.code} className="col" style={{ gap: 4 }}>
              <div className="seat-row">
                <Avatar kind={r.host.avatar} size={42} bg={r.host.color} />
                <span className="grow">
                  <b className="display">{r.mine ? 'Dein Zimmer' : `Bei ${r.host.name}`}</b>
                  <br />
                  <span className="small muted">{meta?.name ?? 'Spielzimmer'}</span> <SmallCode code={r.code} />
                </span>
                <button type="button" className="btn small primary" disabled={busy !== null} onClick={() => void enter(r)}>
                  {busy === r.code ? '…' : r.mine ? 'Wieder öffnen' : 'Wieder rein'}
                </button>
              </div>
              {error?.code === r.code && <p className="error small">{error.text}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

type Row = { uid: string; name: string; avatar: Profile['avatar']; color: string; p?: Presence; online: boolean; join: boolean };

function friendRows(profile: Profile, presence: Record<string, Presence>, skip: string[] = []): Row[] {
  const now = presenceNow();
  return Object.entries(profile.friends)
    .filter(([uid]) => !skip.includes(uid))
    .map(([uid, f]) => ({ uid, ...f, p: presence[uid], online: isOnline(presence[uid], now), join: canJoin(presence[uid], now) }))
    .sort((a, b) => Number(b.join) - Number(a.join) || Number(b.online) - Number(a.online) || a.name.localeCompare(b.name, 'de'));
}

function statusText(r: Row) {
  if (r.join) return `wartet im Zimmer · ${GAME_BY_ID[r.p!.game!]?.name ?? 'Spiel'}`;
  if (r.online && r.p?.room) return 'spielt gerade im Zimmer';
  if (r.online) return 'ist online';
  return 'offline';
}

function FriendAvatar({ r }: { r: Row }) {
  return (
    <span className="friend-ava">
      <Avatar kind={r.avatar} size={42} bg={r.color} />
      <span className={cls('online-dot', r.online && 'on')} aria-hidden="true" />
    </span>
  );
}

const onlineTag = { '--tag-bg': '#DDEBDD', '--tag-fg': '#33673E' } as CSSProperties;

/**
 * Spielfreunde ohne eigenes Zimmer: dazukommen, wo gerade ein Zimmer offen ist, oder einladen –
 * dann wird erst ein Zimmer geöffnet (`onInvite`).
 */
export function FriendsCard({ profile, onInvite }: { profile: Profile; onInvite: (uid: string, name: string) => void }) {
  const { friends } = usePresence();
  const [busy, setBusy] = useState<string | null>(null);
  useTick();
  useEffect(() => refreshFriends(), [profile.id]);
  const rows = friendRows(profile, friends);
  if (!rows.length) return null;
  const onlineCount = rows.filter((r) => r.online).length;

  const join = async (r: Row) => {
    setBusy(r.uid);
    try {
      await joinRoom(profile, r.p!.room!);
    } catch (e) {
      toast((e as Error).message);
      refreshFriends();
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="card col" aria-label="Spielfreunde" style={{ gap: 10 }}>
      <div className="row between">
        <h2>Spielfreunde</h2>
        <span className="tag" style={onlineCount ? onlineTag : undefined}>
          {onlineCount ? `${onlineCount} online` : 'gerade keiner online'}
        </span>
      </div>
      <div className="seat-list">
        {rows.map((r) => (
          <div key={r.uid} className="seat-row">
            <FriendAvatar r={r} />
            <span className="grow">
              <b className="display">{r.name}</b>
              <br />
              <span className="small muted">{statusText(r)}</span>
            </span>
            {r.join ? (
              <button type="button" className="btn small primary" disabled={busy !== null} onClick={() => void join(r)}>
                {busy === r.uid ? '…' : 'Mitspielen'}
              </button>
            ) : r.online && !r.p?.room ? (
              <button type="button" className="btn small secondary" onClick={() => onInvite(r.uid, r.name)}>
                Einladen
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <p className="small muted">Spielfreunde kommen ohne Klingeln in dein Zimmer.</p>
    </section>
  );
}

/** Im Zimmer: Spielfreunde, die online sind, mit einem Tipp einladen */
export function InviteFriends({ profile, code, game, members }: { profile: Profile; code: string; game: Parameters<typeof sendInvite>[3]; members: string[] }) {
  const { friends } = usePresence();
  const [sent, setSent] = useState<Record<string, boolean>>({});
  useTick();
  useEffect(() => refreshFriends(), [profile.id]);
  const rows = friendRows(profile, friends, members).filter((r) => r.online);
  if (!rows.length) return null;
  const invite = async (r: Row) => {
    setSent((s) => ({ ...s, [r.uid]: true }));
    try {
      await sendInvite(profile, r.uid, code, game);
      toast(`${r.name} ist eingeladen!`);
    } catch {
      setSent((s) => ({ ...s, [r.uid]: false }));
      toast('Die Einladung ging nicht raus. Ist das Internet an?');
    }
  };
  return (
    <section className="col" aria-label="Spielfreunde einladen" style={{ gap: 10 }}>
      <h2>Spielfreunde einladen</h2>
      <div className="seat-list">
        {rows.map((r) => (
          <div key={r.uid} className="seat-row">
            <FriendAvatar r={r} />
            <span className="grow">
              <b className="display">{r.name}</b>
              <br />
              <span className="small muted">{statusText(r)}</span>
            </span>
            <button type="button" className="btn small secondary" disabled={!!sent[r.uid]} onClick={() => void invite(r)}>
              {sent[r.uid] ? 'Eingeladen' : 'Einladen'}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Einladung eines Spielfreunds – erscheint oben, egal wo man gerade ist. */
export function InvitePop({ profile, invite, onDone }: { profile: Profile; invite: Invite; onDone: () => void }) {
  const room = useRoom();
  const [busy, setBusy] = useState(false);
  const meta = GAME_BY_ID[invite.game];
  const inOther = !!room.code && room.code !== invite.code;
  const accept = async () => {
    setBusy(true);
    void dropInvite(invite.from);
    try {
      nav.closeGame();
      nav.closeTutorial();
      await joinRoom(profile, invite.code);
      nav.go({ name: 'rooms' });
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
      onDone();
    }
  };
  return (
    <div className="invite-pop" role="alertdialog" aria-label="Einladung">
      <div className="row">
        <Avatar kind={invite.avatar} size={48} bg={invite.color} />
        <div className="grow">
          <b className="display">{invite.name} lädt dich ein!</b>
          <p className="small">
            {meta?.name ?? 'Spielzimmer'} <SmallCode code={invite.code} />
          </p>
        </div>
      </div>
      {inOther && <p className="small muted">Dein jetziges Spielzimmer verlässt du dann.</p>}
      <div className="row">
        <button type="button" className="btn small primary grow" disabled={busy} onClick={() => void accept()}>
          <Icon name="users" size={18} /> Mitspielen
        </button>
        <button
          type="button"
          className="btn small secondary"
          disabled={busy}
          onClick={() => {
            void dropInvite(invite.from);
            onDone();
          }}
        >
          Nein danke
        </button>
      </div>
    </div>
  );
}
