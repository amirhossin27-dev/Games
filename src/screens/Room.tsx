import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ONLINE_GAMES } from '../games/defs';
import { GAME_BY_ID, playersText, type GameId } from '../games/registry';
import { CODE_ANIMALS, CODE_LEN, codeAnimals, codeFromIndexes, codeWords, roomLink } from '../net/codes';
import { onlineConfigured } from '../net/config';
import { onlineAllowed } from '../net/consent';
import { endCall, lastCallGames, rememberCallGame, ringAgain, RING_MS, startCall, useCall, type Call, type CallFriend } from '../net/call';
import { admit, backToLobby, createRoom, deny, forgetRoom, joinRoom, leaveRoom, ONLINE_OFF, react, serverNow, setGame, setLearning, setRobos, startGame, useRoom } from '../net/room';
import { isAway, knocking, maxPlayers, members, ROBO_NAMES, roomForKid, taken, type ReactionId } from '../net/roomLogic';
import { nav, useNav } from '../lib/nav';
import { speak, speakIfAuto, VOICE_ENABLED } from '../lib/speech';
import { LEVEL_LABEL, levelForAge, useData, type Level, type Profile } from '../lib/store';
import { cls } from '../lib/util';
import { Avatar } from '../ui/Avatar';
import { GameArt } from '../ui/GameArt';
import { Icon, type IconName } from '../ui/Icon';
import { JoySays, Sheet, toast } from '../ui/parts';
import { ChatPanel } from './Chat';
import { CallFriends, InviteFriends, RecentRooms } from './Friends';

export const REACTIONS: { id: ReactionId; icon: IconName; label: string; color: string }[] = [
  { id: 'thumb', icon: 'thumb', label: 'Daumen hoch', color: '#2F5F86' },
  { id: 'smile', icon: 'smile', label: 'Lachen', color: '#6B5410' },
  { id: 'wow', icon: 'wow', label: 'Staunen', color: '#5E4277' },
  { id: 'party', icon: 'party', label: 'Juhu', color: '#8F3E1F' },
  { id: 'star', icon: 'sparkle', label: 'Super', color: '#33673E' },
];

function CodeAnimals({ code, size = 46 }: { code: string; size?: number }) {
  return (
    <div className="code-row" aria-label={`Spielzimmer-Code: ${codeWords(code)}`}>
      {codeAnimals(code).map((a, i) => (
        <span key={i} className="code-stamp" style={{ transform: `rotate(${[-3, 2, -2, 3, -2, 2][i] ?? 0}deg)` }}>
          <span style={{ fontSize: size }} aria-hidden="true">
            {a.e}
          </span>
          <small>{a.name}</small>
        </span>
      ))}
    </div>
  );
}

/** Spiel und Schwierigkeit fürs Zimmer wählen. `kids`: so viele Kinder sind schon im Zimmer. */
function GamePicker({ profile, title, initial, kids = 1, onPick, onClose }: { profile: Profile; title: string; initial?: GameId; kids?: number; onPick: (game: GameId, level: Level) => Promise<void>; onClose: () => void }) {
  const [game, setGameId] = useState<GameId>(initial ?? 'rechnen');
  const [level, setLevel] = useState<Level>(levelForAge(profile.age));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Spiele, für die schon zu viele Kinder im Zimmer sind, lassen sich nicht wählen.
  const fits = (id: GameId) => GAME_BY_ID[id].players[1] >= kids;
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="pick-games">
        {ONLINE_GAMES.map((g) => (
          <button key={g.id} type="button" className="pick-game" aria-pressed={g.id === game} disabled={!fits(g.id)} onClick={() => setGameId(g.id)}>
            <GameArt kind={g.art} height={54} />
            <b>{g.name}</b>
            <span className="small muted">{fits(g.id) ? `${playersText(g)} Spieler` : `nur bis ${g.players[1]} – ihr seid ${kids}`}</span>
          </button>
        ))}
      </div>
      <div className="seg">
        {([0, 1, 2] as Level[]).map((l) => (
          <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)}>
            {LEVEL_LABEL[l]}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <button
        type="button"
        className="btn primary big block"
        disabled={busy || !fits(game)}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await onPick(game, level);
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Einen Moment …' : 'Weiter'}
      </button>
    </Sheet>
  );
}

/** Tier-Tastatur für den Zimmer-Code */
function JoinSheet({ profile, initial, onClose }: { profile: Profile; initial?: string; onClose: () => void }) {
  const [picked, setPicked] = useState<number[]>(() => (initial ? [...initial].map((c) => parseInt(c, 16)) : []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = picked.length === CODE_LEN;
  const join = async (code = picked) => {
    setBusy(true);
    setError(null);
    try {
      await joinRoom(profile, codeFromIndexes(code));
      onClose();
    } catch (e) {
      setError((e as Error).message);
      speakIfAuto((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet title="Spielzimmer-Code eingeben" onClose={onClose}>
      <p className="muted">Tippe die sechs Tiere in der richtigen Reihenfolge. Beim sechsten Tier klingelt es von selbst.</p>
      <div className="code-slots">
        {Array.from({ length: CODE_LEN }, (_, i) => (
          <span key={i} className={cls('code-slot', picked[i] !== undefined && 'on')}>
            {picked[i] !== undefined ? CODE_ANIMALS[picked[i]].e : i + 1}
          </span>
        ))}
        <button
          type="button"
          className="icon-btn"
          aria-label="Letztes Tier löschen"
          disabled={!picked.length || busy}
          onClick={() => {
            setPicked((p) => p.slice(0, -1));
            setError(null);
          }}
        >
          <Icon name="backspace" />
        </button>
      </div>
      <div className="animal-pad">
        {CODE_ANIMALS.map((a, i) => (
          <button
            key={a.name}
            type="button"
            disabled={full || busy}
            onClick={() => {
              if (picked.length >= CODE_LEN) return;
              const next = [...picked, i];
              setPicked(next);
              setError(null);
              speakIfAuto(a.name);
              // Alle sechs Tiere da → gleich klingeln
              if (next.length === CODE_LEN) void join(next);
            }}
          >
            <span aria-hidden="true">{a.e}</span>
            <small>{a.name}</small>
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <button type="button" className="btn primary big block" disabled={!full || busy} onClick={() => void join()}>
        {busy ? 'Ding-dong … ich klingle' : error ? 'Nochmal klingeln' : 'Klingeln und mitspielen'}
      </button>
    </Sheet>
  );
}

/** Spielfreund anrufen: nur noch das Spiel antippen – die Stufe passt Joyboy dem Alter an. */
function CallPicker({ profile, friend, onClose }: { profile: Profile; friend: CallFriend; onClose: () => void }) {
  const [busy, setBusy] = useState<GameId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const last = lastCallGames(profile.id);
  const rank = (id: GameId) => (last.includes(id) ? last.indexOf(id) : last.length + ONLINE_GAMES.findIndex((g) => g.id === id));
  const games = [...ONLINE_GAMES].sort((a, b) => rank(a.id) - rank(b.id));
  const call = async (game: GameId) => {
    setBusy(game);
    setError(null);
    try {
      rememberCallGame(profile.id, game);
      await startCall(profile, friend, game);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };
  return (
    <Sheet title={`Was spielst du mit ${friend.name}?`} onClose={onClose}>
      <div className="pick-games">
        {games.map((g) => (
          <button key={g.id} type="button" className="pick-game" aria-pressed={busy === g.id} disabled={busy !== null} onClick={() => void call(g.id)}>
            <GameArt kind={g.art} height={54} />
            <b>{g.name}</b>
            <span className="small muted">{busy === g.id ? 'Ich rufe an …' : `${playersText(g)} Spieler`}</span>
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <p className="small muted center">Die Stufe passt Joyboy deinem Alter an.</p>
    </Sheet>
  );
}

/** Gastgeber nach dem Anrufen: Es klingelt beim Freund. Sagt er Ja, startet das Spiel von selbst. */
function Calling({ profile, call, game }: { profile: Profile; call: Call; game: GameId }) {
  const meta = GAME_BY_ID[game];
  const [, tick] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const t = window.setInterval(() => tick((x) => x + 1), 1000);
    return () => window.clearInterval(t);
  }, []);
  const missed = Date.now() - call.at > RING_MS;
  const name = call.friend.name;
  return (
    <section className="screen">
      <div className="topbar">
        <h1>Spielzimmer</h1>
      </div>
      <section className="card call-card" aria-live="polite">
        <span className={cls('call-ring', !missed && 'on')}>
          <Avatar kind={call.friend.avatar} size={96} bg={call.friend.color} />
        </span>
        <b className="display call-title">{missed ? `${name} geht gerade nicht ran` : `Ich rufe ${name} an …`}</b>
        <span className="call-game">
          <GameArt kind={meta.art} height={56} />
        </span>
        <p className="muted">{missed ? `Vielleicht ist Joyboy bei ${name} gerade zu. Du kannst es nochmal versuchen.` : `Sagt ${name} Ja, geht ${meta.name} sofort los.`}</p>
      </section>
      {missed && (
        <button
          type="button"
          className="btn primary big block"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await ringAgain(profile);
            } catch {
              toast('Der Anruf ging nicht raus. Ist das Internet an?');
            } finally {
              setBusy(false);
            }
          }}
        >
          Nochmal anrufen
        </button>
      )}
      <button
        type="button"
        className="btn secondary block"
        onClick={() => {
          endCall();
          void leaveRoom();
        }}
      >
        Auflegen
      </button>
      <button type="button" className="btn ghost block" onClick={endCall}>
        Spielzimmer mit Code zeigen
      </button>
    </section>
  );
}

function Lobby({ profile, preset }: { profile: Profile; preset?: GameId }) {
  const room = useRoom();
  const navState = useNav();
  const { info, seats, uid, conn, error } = room;
  const [picker, setPicker] = useState(false);
  const learning = useRef(false);
  const call = useCall();

  // Spielregeln schauen → die anderen sehen „lernt die Regeln“
  useEffect(() => {
    if (learning.current && !navState.tutorial) {
      learning.current = false;
      void setLearning(false);
    }
  }, [navState.tutorial]);

  if (error || !info) {
    return (
      <section className="screen">
        <div className="topbar">
          <h1>Spielzimmer</h1>
        </div>
        {error ? <JoySays text={error} mood="happy" /> : <JoySays text="Ich verbinde mich mit dem Spielzimmer …" mood="talk" />}
        {error && (
          <button type="button" className="btn primary block" onClick={forgetRoom}>
            Okay
          </button>
        )}
        {!error && (
          <button type="button" className="btn secondary block" onClick={() => void leaveRoom()}>
            Abbrechen
          </button>
        )}
      </section>
    );
  }

  const meta = GAME_BY_ID[info.game];
  const isHost = info.host === uid;
  const now = serverNow();
  const list = members(info, seats);
  const hostName = seats[info.host]?.name ?? 'der Gastgeber';
  const admitted = isHost || (uid ? info.allowed?.[uid] !== undefined : false);
  const denied = uid ? !!info.denied?.[uid] : false;
  const robos = info.robos ?? 0;
  const count = taken(info, seats);
  const max = maxPlayers(info);
  const min = Math.max(2, meta.players[0]);
  const enough = count >= min && count <= max;
  const code = room.code!;
  // Platz für ein weiteres Kind? Robos machen dafür Platz.
  const space = roomForKid(info, seats);
  // Vor der Tür: Wie viele Kinder sind schon drin? (Mehr als die Tür verrät das Zimmer nicht.)
  const inside = 1 + Object.keys(info.allowed ?? {}).length;
  const doorFull = !admitted && inside >= max;
  const playing = info.status === 'playing';
  // Drin, aber in der laufenden Runde (noch) ohne Platz
  const waitingForRound = admitted && playing && !room.game?.seats.some((p) => p.uid === uid);
  const doorText = denied
    ? `${hostName} hat gerade keinen Platz frei.`
    : doorFull
      ? `Bei ${meta.name} können nur ${max} mitspielen, und das Spielzimmer ist schon voll. Frag ${hostName}, ob ihr danach etwas zusammen spielt.`
      : playing
        ? `Ding-dong! Die anderen spielen gerade ${meta.name}. Wenn ${hostName} dich reinlässt, spielst du mit.`
        : `Ding-dong! Du hast bei ${hostName} geklingelt. Gleich lässt ${hostName} dich rein.`;

  const share = async () => {
    const url = roomLink(code);
    const text = `Komm in mein Joyboy-Spielzimmer! Code: ${codeWords(code)}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Joyboy-Spielzimmer', text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast('Link kopiert!');
      }
    } catch {
      // Teilen abgebrochen
    }
  };

  // Gerade angerufen und der Freund ist noch nicht da → nur das Klingeln zeigen
  if (call && call.code === code && isHost && info.status === 'lobby' && !list.some((m) => m.uid === call.friend.uid)) return <Calling profile={profile} call={call} game={info.game} />;

  const badge = conn === 'online' ? 'Live' : conn === 'connecting' ? 'Verbinde …' : 'Offline';

  return (
    <section className="screen">
      <div className="topbar">
        <h1>Spielzimmer</h1>
        <span className={cls('live-badge', conn !== 'online' && 'off')}>
          <span className="dot" />
          {badge}
        </span>
      </div>

      {!admitted ? (
        <>
          <JoySays text={doorText} mood={denied || doorFull ? 'happy' : 'talk'} />
          <section className="card row" aria-label="Spielzimmer">
            {seats[info.host] ? <Avatar kind={seats[info.host].avatar} size={52} bg={seats[info.host].color} /> : <Avatar kind="robo" size={52} bg="#E6E6DF" />}
            <div className="grow">
              <b className="display">Spielzimmer von {hostName}</b>
              <p className="small muted">
                {meta.name} · {inside === 1 ? 'noch allein' : `schon ${inside} Kinder drin`}
                {playing ? ' · spielen gerade' : ''}
              </p>
            </div>
            <span style={{ width: 64, flexShrink: 0 }}>
              <GameArt kind={meta.art} height={48} />
            </span>
          </section>
          {!denied && !doorFull && (
            <p className="knock-wait center" aria-hidden="true">
              <span>🔔</span>
            </p>
          )}
          <CodeAnimals code={code} size={38} />
          <button type="button" className="btn secondary block" onClick={() => void leaveRoom()}>
            {denied || doorFull ? 'Okay' : 'Doch nicht'}
          </button>
        </>
      ) : (
        <>
          {waitingForRound && <JoySays text={`Du bist drin! Die anderen spielen gerade noch ${meta.name}. In der nächsten Runde bist du dabei – ich hole dich, sobald es losgeht.`} mood="happy" />}
          <section className="card row" aria-label="Spiel">
            <span style={{ width: 84, flexShrink: 0 }}>
              <GameArt kind={meta.art} height={62} />
            </span>
            <div className="grow">
              <b className="display">{meta.name}</b>
              <p className="small muted">
                {LEVEL_LABEL[info.level]} · {playersText(meta)} Spieler
              </p>
            </div>
            {isHost && info.status === 'lobby' && (
              <button type="button" className="btn small secondary" onClick={() => setPicker(true)}>
                Ändern
              </button>
            )}
          </section>

          {/* Von einer Spielseite hierher gekommen: dieses Spiel fürs Zimmer übernehmen */}
          {isHost && info.status === 'lobby' && preset && preset !== info.game && GAME_BY_ID[preset] && GAME_BY_ID[preset].players[1] >= list.length && (
            <section className="card stitched row" aria-label="Spiel wechseln">
              <span className="grow">
                Lieber <b>{GAME_BY_ID[preset].name}</b> spielen?
              </span>
              <button type="button" className="btn small primary" onClick={() => void setGame(preset, info.level)}>
                Wechseln
              </button>
            </section>
          )}

          <section className="card col" aria-label="Spielzimmer-Code">
            <div className="row between">
              <b className="display">Spielzimmer-Code</b>
              <div className="row" style={{ gap: 8 }}>
                {VOICE_ENABLED && (
                  <button type="button" className="icon-btn soft" aria-label="Code vorlesen" onClick={() => speak(`Der Spielzimmer-Code ist: ${codeWords(code)}`)}>
                    <Icon name="speaker" />
                  </button>
                )}
                <button type="button" className="icon-btn soft" aria-label="Link teilen" onClick={share}>
                  <Icon name="share" />
                </button>
              </div>
            </div>
            <CodeAnimals code={code} />
            <p className="small muted center">Laut sagen oder teilen – die anderen tippen die Tiere unter „Code eingeben“.</p>
          </section>

          {isHost &&
            knocking(info, seats).map(({ uid: other, doc }) => (
              <section key={other} className="sticky col" aria-label="Klingel" style={{ gap: 10 }}>
                <div className="row">
                  <Avatar kind={doc.avatar} size={44} bg={doc.color} />
                  <span className="grow display">{doc.name} möchte mitspielen</span>
                </div>
                {space && count >= max && robos > 0 && <span className="small">Ein Robo macht dafür Platz.</span>}
                <div className="row">
                  <button type="button" className="btn small primary grow" disabled={!space} onClick={() => void admit(other)}>
                    {space ? 'Reinlassen' : `Voll – bei ${meta.name} höchstens ${max}`}
                  </button>
                  <button type="button" className="btn small secondary" onClick={() => void deny(other)}>
                    Nein
                  </button>
                </div>
              </section>
            ))}

          <section className="col" aria-label="Mitspieler">
            <div className="row between">
              <h2>Mitspieler</h2>
              <span className="small muted">
                {count} von {max}
              </span>
            </div>
            <div className="seat-list">
              {list.map(({ uid: u, doc, host }) => (
                <div key={u} className="seat-row">
                  {doc ? <Avatar kind={doc.avatar} size={42} bg={doc.color} /> : <Avatar kind="robo" size={42} bg="#E6E6DF" />}
                  <span className="grow">
                    <b className="display">{doc?.name ?? '…'}</b>
                    <br />
                    <span className="small muted">
                      {[u === uid ? 'Du' : null, host ? 'Gastgeber' : null].filter(Boolean).join(' · ') || 'Mitspieler'}
                    </span>
                  </span>
                  {doc?.tut ? (
                    <span className="tag" style={{ '--tag-bg': '#F7EDC8', '--tag-fg': '#6B5410' } as CSSProperties}>
                      lernt die Regeln
                    </span>
                  ) : doc?.solo && !isAway(doc, now) ? (
                    <span className="tag" style={{ '--tag-bg': '#DCE9F3', '--tag-fg': '#2F5F86' } as CSSProperties}>
                      spielt kurz allein
                    </span>
                  ) : isAway(doc, now) ? (
                    <span className="tag">ist kurz weg</span>
                  ) : (
                    <span className="tag" style={{ '--tag-bg': '#DDEBDD', '--tag-fg': '#33673E' } as CSSProperties}>
                      da
                    </span>
                  )}
                </div>
              ))}
              {Array.from({ length: robos }, (_, k) => (
                <div key={`robo${k}`} className="seat-row">
                  <Avatar kind="robo" size={42} bg="#E6E6DF" />
                  <span className="grow">
                    <b className="display">{ROBO_NAMES[k % 3]}</b>
                    <br />
                    <span className="small muted">Computer</span>
                  </span>
                  {isHost && info.status === 'lobby' && (
                    <button type="button" className="icon-btn soft" aria-label="Robo entfernen" onClick={() => void setRobos(robos - 1)}>
                      <Icon name="close" size={18} />
                    </button>
                  )}
                </div>
              ))}
              {isHost && info.status === 'lobby' && count < max && meta.robo && (
                <button type="button" className="seat-row empty" onClick={() => void setRobos(robos + 1)}>
                  <Avatar kind="robo" size={42} bg="#E6E6DF" />
                  <span className="grow display">Robo dazuholen</span>
                  <Icon name="plus" />
                </button>
              )}
            </div>
          </section>

          <div className="row between" aria-label="Sag was">
            <span className="label">Sag was:</span>
            {REACTIONS.map((r) => (
              <button key={r.id} type="button" className="icon-btn" style={{ color: r.color }} aria-label={r.label} onClick={() => void react(r.id)}>
                <Icon name={r.icon} />
              </button>
            ))}
          </div>

          <button
            type="button"
            className="btn secondary block"
            onClick={() => {
              learning.current = true;
              void setLearning(true);
              nav.tutorial(info.game);
            }}
          >
            <Icon name="book" /> Spielregeln ansehen
          </button>

          {info.status === 'playing' ? (
            <p className="card center display">Die Runde läuft gerade …</p>
          ) : isHost ? (
            <button type="button" className="btn primary big block" disabled={!enough} onClick={() => void startGame()}>
              {enough ? 'Spiel starten' : count > max ? `Zu viele für ${meta.name} – höchstens ${max}` : `Noch ${min - count} Mitspieler`}
            </button>
          ) : (
            <p className="card center display">Warte, bis {hostName} das Spiel startet …</p>
          )}
          {isHost && info.status === 'playing' && (
            <button type="button" className="btn secondary block" onClick={() => void backToLobby()}>
              Runde beenden
            </button>
          )}

          <ChatPanel profile={profile} />

          {info.status === 'lobby' && count < max && <InviteFriends profile={profile} code={code} game={info.game} members={list.map((m) => m.uid)} />}

          <button type="button" className="btn ghost block" onClick={() => void leaveRoom()}>
            <Icon name="door" /> Spielzimmer {isHost ? 'zumachen' : 'verlassen'}
          </button>
        </>
      )}

      {picker && <GamePicker profile={profile} title="Anderes Spiel" initial={info.game} kids={list.length} onPick={(g, l) => setGame(g, l)} onClose={() => setPicker(false)} />}
    </section>
  );
}

export function RoomScreen({ profile, joinCode, preset }: { profile: Profile; joinCode?: string; preset?: GameId }) {
  const room = useRoom();
  const data = useData();
  const allowed = onlineAllowed(data.settings);
  const [sheet, setSheet] = useState<'create' | 'join' | null>(joinCode ? 'join' : preset ? 'create' : null);
  // Spielfreund anrufen: erst das Spiel aussuchen, dann öffnet Joyboy ein Spielzimmer und klingelt
  const [calling, setCalling] = useState<CallFriend | null>(null);

  if (room.code && room.profileId === profile.id) return <Lobby profile={profile} preset={preset} />;

  return (
    <section className="screen">
      <div className="topbar">
        <h1>Spielzimmer</h1>
      </div>
      <JoySays text={Object.keys(profile.friends).length ? 'Tipp auf einen Spielfreund, dann rufe ich ihn an!' : 'Spielt zusammen, jedes Kind an seinem eigenen Gerät – bis zu vier!'} mood="happy" size={72} />
      {!onlineConfigured() ? (
        <p className="card">Online-Spielen ist noch nicht eingerichtet.</p>
      ) : !allowed ? (
        <section className="card stitched col" style={{ gap: 12 }} role="status">
          <h2>Erst die Eltern fragen</h2>
          <p>{ONLINE_OFF}</p>
          <button type="button" className="btn secondary block" onClick={() => nav.go({ name: 'parents' })}>
            <Icon name="lock" /> Für Eltern
          </button>
        </section>
      ) : (
        <>
          <CallFriends profile={profile} onCall={setCalling} />
          <RecentRooms profile={profile} />
          <section className="card tape col" style={{ gap: 12 }}>
            <h2>Spielzimmer öffnen</h2>
            <p className="muted">Du suchst ein Spiel aus und bekommst einen Code aus sechs Tieren. Den sagst du den anderen.</p>
            <button type="button" className="btn primary big block" onClick={() => setSheet('create')}>
              <Icon name="plus" /> Spielzimmer öffnen
            </button>
          </section>
          <section className="card tape butter-tape col" style={{ gap: 12 }}>
            <h2>Mitspielen</h2>
            <p className="muted">Jemand hat schon ein Spielzimmer? Tippe die sechs Tiere ein und klingle.</p>
            <button type="button" className="btn secondary big block" onClick={() => setSheet('join')}>
              <Icon name="grid" /> Code eingeben
            </button>
          </section>
          <p className="small muted center">Wer klingelt, kommt erst rein, wenn der Gastgeber es erlaubt. Spielfreunde und Kinder, die schon einmal im Spielzimmer waren, kommen gleich rein. Im Chat gibt es fertige Sätze und einen Wortfilter.</p>
        </>
      )}
      {allowed && sheet === 'create' && (
        <GamePicker
          profile={profile}
          title="Welches Spiel?"
          initial={preset}
          onPick={async (g, l) => {
            await createRoom(profile, g, l);
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {allowed && sheet === 'join' && <JoinSheet profile={profile} initial={joinCode} onClose={() => setSheet(null)} />}
      {allowed && calling && <CallPicker profile={profile} friend={calling} onClose={() => setCalling(null)} />}
    </section>
  );
}
