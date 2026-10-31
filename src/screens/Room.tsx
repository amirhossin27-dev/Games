import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ONLINE_GAMES } from '../games/defs';
import { GAME_BY_ID, playersText, type GameId } from '../games/registry';
import { CODE_ANIMALS, CODE_LEN, codeAnimals, codeFromIndexes, codeWords, roomLink } from '../net/codes';
import { onlineConfigured } from '../net/config';
import { onlineAllowed } from '../net/consent';
import { sendInvite } from '../net/presence';
import { admit, backToLobby, createRoom, deny, forgetRoom, joinRoom, leaveRoom, ONLINE_OFF, react, serverNow, setGame, setLearning, setRobos, startGame, useRoom } from '../net/room';
import { isAway, knocking, maxPlayers, members, ROBO_NAMES, taken, type ReactionId } from '../net/roomLogic';
import { nav, useNav } from '../lib/nav';
import { speak, speakIfAuto, VOICE_ENABLED } from '../lib/speech';
import { LEVEL_LABEL, levelForAge, useData, type Level, type Profile } from '../lib/store';
import { cls } from '../lib/util';
import { Avatar } from '../ui/Avatar';
import { GameArt } from '../ui/GameArt';
import { Icon, type IconName } from '../ui/Icon';
import { JoySays, Sheet, toast } from '../ui/parts';
import { ChatPanel } from './Chat';
import { FriendsCard, InviteFriends, RecentRooms } from './Friends';

export const REACTIONS: { id: ReactionId; icon: IconName; label: string; color: string }[] = [
  { id: 'thumb', icon: 'thumb', label: 'Daumen hoch', color: '#2F5F86' },
  { id: 'smile', icon: 'smile', label: 'Lachen', color: '#6B5410' },
  { id: 'wow', icon: 'wow', label: 'Staunen', color: '#5E4277' },
  { id: 'heart', icon: 'heart', label: 'Herz', color: '#8F3E1F' },
  { id: 'star', icon: 'sparkle', label: 'Super', color: '#33673E' },
];

function CodeAnimals({ code, size = 46 }: { code: string; size?: number }) {
  return (
    <div className="code-row" aria-label={`Zimmer-Code: ${codeWords(code)}`}>
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
  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      await joinRoom(profile, codeFromIndexes(picked));
      onClose();
    } catch (e) {
      setError((e as Error).message);
      speakIfAuto((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet title="Zimmer-Code eingeben" onClose={onClose}>
      <p className="muted">Tippe die sechs Tiere in der richtigen Reihenfolge.</p>
      <div className="code-slots">
        {Array.from({ length: CODE_LEN }, (_, i) => (
          <span key={i} className={cls('code-slot', picked[i] !== undefined && 'on')}>
            {picked[i] !== undefined ? CODE_ANIMALS[picked[i]].e : i + 1}
          </span>
        ))}
        <button type="button" className="icon-btn" aria-label="Letztes Tier löschen" disabled={!picked.length} onClick={() => setPicked((p) => p.slice(0, -1))}>
          <Icon name="backspace" />
        </button>
      </div>
      <div className="animal-pad">
        {CODE_ANIMALS.map((a, i) => (
          <button
            key={a.name}
            type="button"
            disabled={full}
            onClick={() => {
              setPicked((p) => (p.length < CODE_LEN ? [...p, i] : p));
              speakIfAuto(a.name);
            }}
          >
            <span aria-hidden="true">{a.e}</span>
            <small>{a.name}</small>
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <button type="button" className="btn primary big block" disabled={!full || busy} onClick={join}>
        {busy ? 'Ich klingle …' : 'Klingeln und mitspielen'}
      </button>
    </Sheet>
  );
}

function Lobby({ profile, preset }: { profile: Profile; preset?: GameId }) {
  const room = useRoom();
  const navState = useNav();
  const { info, seats, uid, conn, error } = room;
  const [picker, setPicker] = useState(false);
  const learning = useRef(false);

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
          <JoySays text={denied ? `${hostName} hat gerade keinen Platz frei.` : `Du hast geklingelt! Warte, bis ${hostName} dich reinlässt.`} mood={denied ? 'happy' : 'talk'} />
          <CodeAnimals code={code} size={38} />
          <button type="button" className="btn secondary block" onClick={() => void leaveRoom()}>
            {denied ? 'Okay' : 'Doch nicht'}
          </button>
        </>
      ) : (
        <>
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

          <section className="card col" aria-label="Zimmer-Code">
            <div className="row between">
              <b className="display">Zimmer-Code</b>
              <div className="row" style={{ gap: 8 }}>
                {VOICE_ENABLED && (
                  <button type="button" className="icon-btn soft" aria-label="Code vorlesen" onClick={() => speak(`Der Zimmer-Code ist: ${codeWords(code)}`)}>
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
                <div className="row">
                  <button type="button" className="btn small primary grow" disabled={count >= max} onClick={() => void admit(other)}>
                    {count >= max ? 'Zimmer ist voll' : 'Reinlassen'}
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
            <Icon name="door" /> Zimmer {isHost ? 'schließen' : 'verlassen'}
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
  // Spielfreund einladen: erst ein Zimmer öffnen, dann die Einladung schicken
  const [inviting, setInviting] = useState<{ uid: string; name: string } | null>(null);

  if (room.code && room.profileId === profile.id) return <Lobby profile={profile} preset={preset} />;

  return (
    <section className="screen">
      <div className="topbar">
        <h1>Spielzimmer</h1>
      </div>
      <JoySays text="Spielt zusammen, jedes Kind an seinem eigenen Gerät – bis zu vier!" mood="happy" size={72} />
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
          <RecentRooms profile={profile} />
          <FriendsCard profile={profile} onInvite={(uid, name) => setInviting({ uid, name })} />
          <section className="card tape col" style={{ gap: 12 }}>
            <h2>Zimmer öffnen</h2>
            <p className="muted">Du suchst ein Spiel aus und bekommst einen Code aus sechs Tieren. Den sagst du den anderen.</p>
            <button type="button" className="btn primary big block" onClick={() => setSheet('create')}>
              <Icon name="plus" /> Zimmer öffnen
            </button>
          </section>
          <section className="card tape butter-tape col" style={{ gap: 12 }}>
            <h2>Mitspielen</h2>
            <p className="muted">Jemand hat schon ein Zimmer? Tippe die sechs Tiere ein und klingle.</p>
            <button type="button" className="btn secondary big block" onClick={() => setSheet('join')}>
              <Icon name="grid" /> Code eingeben
            </button>
          </section>
          <p className="small muted center">Wer klingelt, kommt erst rein, wenn der Gastgeber es erlaubt. Spielfreunde und Kinder, die schon einmal im Zimmer waren, kommen gleich rein. Im Chat gibt es fertige Sätze und einen Wortfilter.</p>
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
      {allowed && inviting && (
        <GamePicker
          profile={profile}
          title={`Was spielst du mit ${inviting.name}?`}
          onPick={async (g, l) => {
            const code = await createRoom(profile, g, l);
            try {
              await sendInvite(profile, inviting.uid, code, g);
              toast(`${inviting.name} ist eingeladen!`);
            } catch {
              toast('Die Einladung ging nicht raus. Ist das Internet an?');
            }
          }}
          onClose={() => setInviting(null)}
        />
      )}
    </section>
  );
}
