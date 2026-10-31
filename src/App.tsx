import { useEffect, useRef } from 'react';
import { getNav, nav, useNav } from './lib/nav';
import { onPlayWarning, startPlaytime, usePlaytime } from './lib/playtime';
import { speakIfAuto } from './lib/speech';
import { activeProfile, getData, useData } from './lib/store';
import { cls } from './lib/util';
import { redeemPass, startCloudSync } from './net/cloud';
import { isCode } from './net/codes';
import { leaveRoom, resumeRoom, useRoom } from './net/room';
import { GameDetail } from './screens/GameDetail';
import { GameScreen } from './screens/GameScreen';
import { Home, TabBar } from './screens/Home';
import { Me } from './screens/Me';
import { OnlineGame } from './screens/OnlineGame';
import { LockScreen, Parents } from './screens/Parents';
import { REACTIONS, RoomScreen } from './screens/Room';
import { Tutorial } from './screens/Tutorial';
import { Welcome } from './screens/Welcome';
import { Who } from './screens/Who';
import { Avatar } from './ui/Avatar';
import { Icon } from './ui/Icon';
import { toast, ToastHost } from './ui/parts';

/** Gezählt wird überall außer im Elternbereich – und nur, wenn schon ein Kind eingerichtet ist. */
const counting = () => getNav().route.name !== 'parents' && getData().profiles.length > 0;

/** Einladungslinks: …#zimmer=0a3f (Spielzimmer) oder …#pass=… (Spielerpass) */
function readHash(): { join?: string; pass?: string } {
  const h = new URLSearchParams(location.hash.slice(1));
  const join = h.get('zimmer') ?? undefined;
  const pass = h.get('pass') ?? undefined;
  if (join || pass) history.replaceState(null, '', location.pathname + location.search);
  return { join: join && isCode(join) ? join : undefined, pass };
}

/** Reaktionen der anderen Kinder im Spielzimmer als kleine Hinweise zeigen */
function useReactions() {
  const room = useRoom();
  const seen = useRef(new Map<string, number>());
  useEffect(() => {
    for (const [uid, doc] of Object.entries(room.seats)) {
      const at = doc.react?.at ?? 0;
      const before = seen.current.get(uid);
      seen.current.set(uid, at);
      // Alte Reaktionen beim Betreten des Zimmers nicht nochmal zeigen
      if (before === undefined || before === at || !at || uid === room.uid) continue;
      const r = REACTIONS.find((x) => x.id === doc.react!.e);
      if (!r) continue;
      toast(
        `${doc.name}: ${r.label}!`,
        <span className="row" style={{ gap: 4, color: r.color }}>
          <Avatar kind={doc.avatar} size={30} bg={doc.color} />
          <Icon name={r.icon} size={26} />
        </span>,
        2600,
      );
    }
  }, [room.seats]);
}

export function App() {
  const data = useData();
  const state = useNav();
  const room = useRoom();
  const { status } = usePlaytime();
  const route = state.route;
  const profile = activeProfile(data);
  const locked = status.locked && route.name !== 'parents';
  const hash = useRef<{ join?: string; pass?: string }>(null);
  if (hash.current === null) hash.current = typeof location === 'undefined' ? {} : readHash();

  useReactions();

  useEffect(() => {
    startPlaytime(counting);
    startCloudSync();
    const redeem = (pass: string) =>
      redeemPass(pass)
        .then((p) => {
          toast(`Willkommen zurück, ${p.name}! Dein Spielstand ist da.`);
          nav.go({ name: 'home' });
        })
        .catch(() => toast('Der Spielerpass hat nicht geklappt. Ist das Internet an?'));
    if (hash.current?.pass) void redeem(hash.current.pass);
    // Link geöffnet, während Joyboy schon offen ist
    const onHash = () => {
      const h = readHash();
      if (h.pass) void redeem(h.pass);
      if (h.join) {
        if (activeProfile(getData())) nav.go({ name: 'rooms', join: h.join });
        else hash.current = h;
      }
    };
    window.addEventListener('hashchange', onHash);
    const stopWarn = onPlayWarning((sec) => {
      const text = sec > 120 ? 'Noch 5 Minuten Spielzeit!' : 'Noch 1 Minute Spielzeit!';
      toast(text, <Icon name="hourglass" size={28} />, 5000);
      speakIfAuto(text);
    });
    return () => {
      window.removeEventListener('hashchange', onHash);
      stopWarn();
    };
  }, []);

  // Kind gewählt: Einladung annehmen oder ins letzte Spielzimmer zurück
  useEffect(() => {
    if (!profile) return;
    const join = hash.current?.join;
    if (join) {
      hash.current = {};
      nav.go({ name: 'rooms', join });
    } else void resumeRoom(profile);
  }, [profile?.id]);

  // Anderes Kind am Gerät → das Spielzimmer des vorigen verlassen
  useEffect(() => {
    if (room.code && room.profileId && room.profileId !== profile?.id) void leaveRoom();
  }, [profile?.id, room.code]);

  // Zeit um → laufendes Spiel beenden
  useEffect(() => {
    if (!status.locked) return;
    nav.closeGame();
    nav.closeTutorial();
    if (getData().profiles.length && room.code) void leaveRoom();
  }, [status.locked]);

  let screen;
  if (route.name === 'parents') screen = <Parents />;
  else if (!data.profiles.length || route.name === 'welcome') screen = <Welcome edit={route.name === 'welcome' ? route.edit : undefined} />;
  else if (!profile || route.name === 'who') screen = <Who />;
  else if (route.name === 'rooms') screen = <RoomScreen key={`room-${route.join ?? ''}-${route.preset ?? ''}`} profile={profile} joinCode={route.join} preset={route.preset} />;
  else if (route.name === 'me') screen = <Me profile={profile} />;
  else if (route.name === 'game') screen = <GameDetail key={`detail-${route.id}`} id={route.id} profile={profile} />;
  else screen = <Home profile={profile} tab={route.tab} />;

  const tabName = route.name === 'home' || route.name === 'rooms' || route.name === 'me' ? route.name : null;
  const tabs = !!profile && !!tabName && data.profiles.length > 0;
  const inRoom = !!profile && room.profileId === profile.id && !!room.code;

  return (
    <div className={cls('app', tabs && 'with-tabs')}>
      {screen}
      {tabs && <TabBar active={tabName!} />}
      {!locked && state.session && !inRoom && <GameScreen session={state.session} />}
      {!locked && inRoom && <OnlineGame profileId={profile!.id} />}
      {!locked && state.tutorial && <Tutorial key={`tut-${state.tutorial.game}`} game={state.tutorial.game} />}
      {locked && <LockScreen />}
      <ToastHost />
    </div>
  );
}
