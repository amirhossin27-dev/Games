import { useEffect, useState, type CSSProperties } from 'react';
import { GAME_BY_ID } from '../games/registry';
import { nav } from '../lib/nav';
import type { Profile } from '../lib/store';
import { cls } from '../lib/util';
import { codeAnimals, codeWords } from '../net/codes';
import { canJoin, dropInvite, isOnline, presenceNow, refreshFriends, sendInvite, usePresence, type Invite, type Presence } from '../net/presence';
import type { CallFriend } from '../net/call';
import { forgetRecent, recentRooms, type RecentRoom } from '../net/recent';
import { CLOSED, joinRoom, NO_ROOM, useRoom } from '../net/room';
import { Avatar } from '../ui/Avatar';
import { GameArt } from '../ui/GameArt';
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
        toast('Dieses Spielzimmer gibt es nicht mehr.');
      } else setError({ code: r.code, text: text === CLOSED ? `${r.host.name} hat das Spielzimmer gerade zugemacht.` : text });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="card col" aria-label="Zuletzt im Spielzimmer" style={{ gap: 10 }}>
      <h2>Zuletzt im Spielzimmer</h2>
      <div className="seat-list">
        {list.map((r) => {
          const meta = GAME_BY_ID[r.game];
          return (
            <div key={r.code} className="col" style={{ gap: 4 }}>
              <div className="seat-row">
                <Avatar kind={r.host.avatar} size={42} bg={r.host.color} />
                <span className="grow">
                  <b className="display">{r.mine ? 'Dein Spielzimmer' : `Bei ${r.host.name}`}</b>
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
  if (r.join) return `wartet im Spielzimmer · ${GAME_BY_ID[r.p!.game!]?.name ?? 'Spiel'}`;
  if (r.online && r.p?.room) return 'spielt gerade im Spielzimmer';
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

/** Was unter dem Freund steht: kurz, damit es unter das große Bild passt */
function tileText(r: Row) {
  if (r.join) return `wartet · ${GAME_BY_ID[r.p!.game!]?.name ?? 'Spiel'}`;
  if (r.online && r.p?.room) return 'spielt gerade';
  if (r.online) return 'online';
  return 'offline';
}

/**
 * Ganz oben im Spielzimmer: die Spielfreunde groß zum Antippen.
 * Online → anrufen (`onCall`, erst wird das Spiel ausgesucht). Wartet der Freund schon in seinem
 * Spielzimmer → gleich hin. Offline oder mitten in einer Runde → ausgegraut.
 */
export function CallFriends({ profile, onCall }: { profile: Profile; onCall: (friend: CallFriend) => void }) {
  const { friends } = usePresence();
  const [busy, setBusy] = useState<string | null>(null);
  useTick();
  useEffect(() => refreshFriends(), [profile.id]);
  const rows = friendRows(profile, friends);
  if (!rows.length) {
    return (
      <section className="card stitched col" aria-label="Wer spielt mit?" style={{ gap: 8 }}>
        <h2>Wer spielt mit?</h2>
        <p className="muted">Hier stehen bald deine Spielfreunde. Spielt einmal mit dem Tier-Code zusammen, dann reicht beim nächsten Mal ein Tipp auf den Freund.</p>
      </section>
    );
  }
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
    <section className="card col" aria-label="Wer spielt mit?" style={{ gap: 12 }}>
      <div className="row between">
        <h2>Wer spielt mit?</h2>
        <span className="tag" style={onlineCount ? onlineTag : undefined}>
          {onlineCount ? `${onlineCount} online` : 'gerade keiner online'}
        </span>
      </div>
      <div className="call-friends">
        {rows.map((r) => {
          const canCall = r.online && !r.p?.room;
          const playing = r.online && !!r.p?.room && !r.join;
          return (
            <button
              key={r.uid}
              type="button"
              className={cls('call-friend', r.join && 'waiting')}
              disabled={busy !== null || (!r.join && !canCall)}
              aria-label={r.join ? `Zu ${r.name} ins Spielzimmer` : canCall ? `${r.name} anrufen` : `${r.name} ist ${playing ? 'gerade in einem Spiel' : 'offline'}`}
              onClick={() => (r.join ? void join(r) : onCall({ uid: r.uid, name: r.name, avatar: r.avatar, color: r.color }))}
            >
              <span className="friend-ava">
                <Avatar kind={r.avatar} size={64} bg={r.color} />
                <span className={cls('online-dot', r.online && 'on')} aria-hidden="true" />
              </span>
              <b className="display">{r.name}</b>
              <span className="small">{busy === r.uid ? '…' : tileText(r)}</span>
            </button>
          );
        })}
      </div>
      <p className="small muted">Tipp auf einen Freund, der online ist, und such ein Spiel aus. Joyboy ruft ihn an. Sagt er Ja, geht es sofort los.</p>
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

/** Anruf (Einladung) eines Spielfreunds – erscheint groß in der Mitte, egal wo man gerade ist. */
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
    <div className="call-backdrop">
      <div className="call-pop" role="alertdialog" aria-label={`Anruf von ${invite.name}`}>
        <span className="call-ring on">
          <Avatar kind={invite.avatar} size={84} bg={invite.color} />
        </span>
        <b className="display call-title">
          {invite.name} möchte mit dir {meta?.name ?? 'etwas'} spielen!
        </b>
        {meta && (
          <span className="call-game">
            <GameArt kind={meta.art} height={56} />
          </span>
        )}
        {inOther && <p className="small muted">Dein jetziges Spielzimmer verlässt du dann.</p>}
        <button type="button" className="btn primary big block" disabled={busy} onClick={() => void accept()}>
          {busy ? 'Einen Moment …' : 'Ja, los!'}
        </button>
        <button
          type="button"
          className="btn ghost block"
          disabled={busy}
          onClick={() => {
            void dropInvite(invite.from);
            onDone();
          }}
        >
          Nicht jetzt
        </button>
      </div>
    </div>
  );
}
