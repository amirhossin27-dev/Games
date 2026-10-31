import { useEffect, useRef, useState } from 'react';
import { getNav, nav, useNav } from './lib/nav';
import { chatText } from './lib/chat';
import { onPlayWarning, startPlaytime, usePlaytime } from './lib/playtime';
import { speakIfAuto } from './lib/speech';
import { activeProfile, getData, useData } from './lib/store';
import { cls } from './lib/util';
import { redeemPass, startCloudSync } from './net/cloud';
import { isCode } from './net/codes';
import { onlineAllowed } from './net/consent';
import { onFriendOnline, presenceChanged, startPresence, usePresence } from './net/presence';
import { leaveRoom, resumeRoom, setSolo, useRoom } from './net/room';
import { autoAdmit, isMember, knocking } from './net/roomLogic';
import { chatSheetOpen } from './screens/Chat';
import { InvitePop } from './screens/Friends';
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

/** Spielerpass, der noch auf die Erlaubnis der Eltern wartet */
let pendingPass: string | null = null;

function redeem(pass: string) {
  if (!onlineAllowed()) {
    pendingPass = pass;
    toast('Für den Spielerpass müssen die Eltern erst Online erlauben.');
    nav.go({ name: 'parents' });
    return;
  }
  redeemPass(pass)
    .then((p) => {
      toast(`Willkommen zurück, ${p.name}! Dein Spielstand ist da.`);
      nav.go({ name: 'home' });
    })
    .catch(() => toast('Der Spielerpass hat nicht geklappt. Ist das Internet an?'));
}

/**
 * Hinweise aus dem Spielzimmer, wenn man gerade nicht hinschaut (anderer Reiter, Spiel für sich):
 * neue Chat-Nachrichten, wer klingelt und wer reingekommen ist.
 */
function useRoomNotes(watching: boolean, inGame: boolean) {
  const room = useRoom();
  const data = useData();
  const seenChat = useRef<string | null>(null);
  const seenKnock = useRef(new Set<string>());
  const seenIn = useRef<Set<string> | null>(null);
  const member = !!room.info && isMember(room.info, room.uid);

  useEffect(() => {
    if (!member) {
      seenChat.current = null;
      return;
    }
    const last = room.chat[room.chat.length - 1];
    const before = seenChat.current;
    seenChat.current = last?.id ?? '';
    // Beim Betreten nichts Altes zeigen
    if (before === null || watching || chatSheetOpen()) return;
    const idx = room.chat.findIndex((m) => m.id === before);
    for (const m of room.chat.slice(idx + 1)) {
      if (m.by === room.uid) continue;
      const text = chatText(m, room.uid, data.settings);
      if (text) toast(`${m.name}: ${text}`, <Avatar kind={m.avatar} size={30} bg={m.color} />, 3600);
    }
  }, [room.chat, member]);

  useEffect(() => {
    const { info, seats, uid, profileId } = room;
    if (!info || !uid || info.host !== uid || info.status === 'closed') {
      seenKnock.current.clear();
      seenIn.current = null;
      return;
    }
    const friends = data.profiles.find((p) => p.id === profileId)?.friends ?? {};
    const welcome = new Set(autoAdmit(info, seats, friends));
    const inside = new Set(Object.keys(info.allowed ?? {}));
    const before = seenIn.current;
    seenIn.current = inside;
    for (const k of knocking(info, seats)) {
      if (seenKnock.current.has(k.uid) || welcome.has(k.uid)) continue;
      seenKnock.current.add(k.uid);
      // Im laufenden Spiel zeigt die Leiste unten, wer klingelt (mit „Reinlassen“)
      if (!watching && !inGame) toast(`${k.doc.name} klingelt im Spielzimmer!`, <Avatar kind={k.doc.avatar} size={30} bg={k.doc.color} />, 5000);
    }
    if (before && !watching && !inGame)
      for (const u of inside) {
        const doc = seats[u];
        if (!before.has(u) && doc) toast(`${doc.name} ist im Spielzimmer!`, <Avatar kind={doc.avatar} size={30} bg={doc.color} />, 3600);
      }
  }, [room.info, room.seats]);
}

/** Reaktionen der anderen Kinder im Spielzimmer als kleine Hinweise zeigen */
function useReactions() {
  const room = useRoom();
  const seen = useRef(new Map<string, number>());
  useEffect(() => {
    // Wer nur geklingelt hat, bekommt die Reaktionen im Zimmer nicht mit
    if (!room.info || !isMember(room.info, room.uid)) return;
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
    startPresence();
    if (hash.current?.pass) redeem(hash.current.pass);
    // Link geöffnet, während Joyboy schon offen ist
    const onHash = () => {
      const h = readHash();
      if (h.pass) redeem(h.pass);
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
    // Ein Spielfreund ist gerade online gekommen
    const stopFriends = onFriendOnline((uid) => {
      const f = activeProfile(getData())?.friends[uid];
      if (f) toast(`${f.name} ist jetzt online!`, <Avatar kind={f.avatar} size={30} bg={f.color} />, 4000);
    });
    return () => {
      window.removeEventListener('hashchange', onHash);
      stopWarn();
      stopFriends();
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

  // Eltern haben Online erlaubt → den wartenden Spielerpass einlösen, sobald sie fertig sind
  const online = onlineAllowed(data.settings);
  useEffect(() => {
    if (!online) return;
    if (pendingPass && route.name !== 'parents') {
      const pass = pendingPass;
      pendingPass = null;
      redeem(pass);
    }
  }, [online, route.name]);

  // Eltern haben Online ausgeschaltet → raus aus dem Spielzimmer
  useEffect(() => {
    if (!online && room.code) void leaveRoom();
  }, [online, room.code]);

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
  const member = inRoom && !!room.info && isMember(room.info, room.uid);
  // Läuft gerade eine Runde im Spielzimmer, in der dieses Kind mitspielt?
  const onlineActive = inRoom && room.info?.status === 'playing' && !!room.game?.seats.some((s) => s.uid === room.uid);
  // Schaut das Kind gerade ins Spielzimmer?
  const watching = route.name === 'rooms' && !state.session && !state.tutorial && !onlineActive;
  useRoomNotes(watching, onlineActive);

  // Freunde sehen, in welchem Zimmer man ist
  useEffect(() => presenceChanged(), [room.code, room.info?.status, room.info?.game, member]);

  // Die Runde im Spielzimmer beginnt → ein Spiel für sich allein schließen.
  // Läuft die Runde schon, startet kein Spiel daneben – mit Hinweis statt still.
  const wasActive = useRef(false);
  useEffect(() => {
    const began = onlineActive && !wasActive.current;
    wasActive.current = onlineActive;
    // Nach der Runde geht es im Spielzimmer weiter, nicht auf der Seite, auf der man vorher war
    if (began && getNav().route.name !== 'rooms' && getNav().route.name !== 'parents') nav.go({ name: 'rooms' });
    if (!onlineActive || !state.session) return;
    nav.closeGame();
    toast(began ? 'Im Spielzimmer geht es los!' : 'Im Spielzimmer läuft gerade eine Runde. Spiel sie erst zu Ende.', <Icon name="users" size={28} />, 4500);
  }, [onlineActive, state.session]);

  // Ein Spiel für sich allein, während man im Spielzimmer ist: geht, mit Hinweis – und die anderen sehen „spielt kurz allein“.
  const solo = member && !!state.session && !onlineActive;
  const wasSolo = useRef(false);
  useEffect(() => {
    if (!inRoom) {
      wasSolo.current = false;
      return;
    }
    // Auch nach dem Wiederkommen (App war zu) den Platz richtigstellen
    void setSolo(solo);
    const started = solo && !wasSolo.current;
    wasSolo.current = solo;
    if (!started) return;
    const host = room.info?.host === room.uid;
    toast(
      host ? 'Du bleibst Gastgeber im Spielzimmer. Die anderen sehen: spielt kurz allein.' : 'Du bleibst im Spielzimmer. Geht es dort los, holen wir dich zurück.',
      <Icon name="users" size={28} />,
      5000,
    );
  }, [solo, inRoom]);

  // Einladungen von Spielfreunden
  const { invites } = usePresence();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const invite = invites.find((i) => !dismissed.includes(`${i.from}|${i.at}`) && !(member && i.code === room.code));
  const showInvite = !!profile && !!invite && !locked && !onlineActive && route.name !== 'parents' && route.name !== 'welcome' && route.name !== 'who';

  return (
    <div className={cls('app', tabs && 'with-tabs')}>
      {screen}
      {tabs && <TabBar active={tabName!} />}
      {!locked && state.session && !onlineActive && <GameScreen session={state.session} />}
      {!locked && inRoom && <OnlineGame profileId={profile!.id} />}
      {!locked && state.tutorial && <Tutorial key={`tut-${state.tutorial.game}`} game={state.tutorial.game} />}
      {locked && <LockScreen />}
      {showInvite && <InvitePop key={`${invite.from}|${invite.at}`} profile={profile} invite={invite} onDone={() => setDismissed((d) => [...d, `${invite.from}|${invite.at}`])} />}
      <ToastHost />
    </div>
  );
}
