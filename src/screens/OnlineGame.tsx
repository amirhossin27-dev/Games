import { useEffect, useMemo, useRef, useState } from 'react';
import type { NetLink, SeatInfo } from '../engine/game';
import { GAME_BY_ID } from '../games/registry';
import { rememberFriends } from '../net/cloud';
import { admit, backToLobby, deny, leaveRoom, publishState, pushAct, serverNow, startGame, useRoom } from '../net/room';
import { absentSeats, guestActs, knocking, roomForKid, waitingKids, type NetSeat } from '../net/roomLogic';
import { learnLeft } from '../lib/unlock';
import { getData } from '../lib/store';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import { toast } from '../ui/parts';
import { ChatSheet } from './Chat';
import { GameScreen } from './GameScreen';

/** Namen hübsch aufzählen: „Mia“, „Mia und Tom“, „Mia, Tom und Ben“ */
export const namesText = (names: string[]) => (names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} und ${names[names.length - 1]}`);

/**
 * Während der Runde sieht der Gastgeber, wer klingelt, und kann gleich reinlassen – ohne das Spiel
 * zu verlassen. Wer reinkommt, übernimmt einen Robo-Platz oder wartet auf die nächste Runde.
 */
function HostBar({ players, atEnd }: { players: NetSeat[]; atEnd: boolean }) {
  const { info, seats } = useRoom();
  if (!info) return null;
  const knocks = knocking(info, seats);
  // Am Ende der Runde steht „spielt in der nächsten Runde mit“ schon im Ergebnis – dort nur die Klingel.
  const waiting = atEnd ? [] : waitingKids(info, seats, players);
  const space = roomForKid(info, seats);
  const game = GAME_BY_ID[info.game]?.name ?? 'das Spiel';
  if (!knocks.length && !waiting.length) return null;
  return (
    <div className={atEnd ? 'host-bar at-end' : 'host-bar'} role="status">
      {knocks.slice(0, 2).map(({ uid, doc }) => (
        <div key={uid} className="host-bar-card">
          <Avatar kind={doc.avatar} size={40} bg={doc.color} />
          <div className="grow col" style={{ gap: 6 }}>
            <b className="display">{doc.name} möchte mitspielen!</b>
            {space ? (
              <div className="row" style={{ gap: 8 }}>
                <button type="button" className="btn small primary grow" onClick={() => void admit(uid)}>
                  Reinlassen
                </button>
                <button type="button" className="btn small secondary" onClick={() => void deny(uid)}>
                  Nein
                </button>
              </div>
            ) : (
              <span className="small">
                Bei {game} können nur {GAME_BY_ID[info.game]?.players[1]} mitspielen.{' '}
                <button type="button" className="btn small ghost" onClick={() => void deny(uid)}>
                  Okay
                </button>
              </span>
            )}
          </div>
        </div>
      ))}
      {waiting.length > 0 && (
        <div className="host-bar-card">
          <span className="row" style={{ gap: 2 }}>
            {waiting.slice(0, 3).map(({ uid, doc }) => (
              <Avatar key={uid} kind={doc.avatar} size={34} bg={doc.color} />
            ))}
          </span>
          <div className="grow col" style={{ gap: 6 }}>
            <span className="small">
              <b>{namesText(waiting.map((w) => w.doc.name))}</b> {waiting.length > 1 ? 'spielen' : 'spielt'} in der nächsten Runde mit.
            </span>
            <button type="button" className="btn small secondary" onClick={() => void startGame()}>
              <Icon name="refresh" size={18} /> Neu starten mit allen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Das laufende Spiel im Online-Spielzimmer – auf jedem Gerät aus Sicht des eigenen Kindes. */
export function OnlineGame({ profileId }: { profileId: string }) {
  const room = useRoom();
  const { info, game, uid, seats } = room;
  const [, tick] = useState(0);
  const [chat, setChat] = useState(false);

  // Alle paar Sekunden prüfen, wer gerade weg ist
  useEffect(() => {
    const t = window.setInterval(() => tick((x) => x + 1), 4000);
    return () => window.clearInterval(t);
  }, []);

  const me = game && uid ? game.seats.findIndex((s) => s.uid === uid) : -1;
  const host = !!info && info.host === uid;

  // Mitspieler als Spielfreunde merken
  const seatKey = game ? game.seats.map((s) => s.uid ?? '').join('|') : '';
  useEffect(() => {
    if (!game || me < 0) return;
    const friends = Object.fromEntries(game.seats.filter((s, i) => i !== me && s.uid && !s.robo).map((s) => [s.uid!, { name: s.name, avatar: s.avatar, color: s.color }]));
    rememberFriends(profileId, friends);
  }, [game?.round, me, seatKey]);

  // Ein Kind übernimmt mitten in der Runde einen Platz → allen Bescheid sagen
  const before = useRef<{ round: number; seats: NetSeat[] } | null>(null);
  useEffect(() => {
    if (!game) return;
    const prev = before.current;
    before.current = { round: game.round, seats: game.seats };
    const say = (s: NetSeat, was: string) =>
      toast(s.uid === uid ? `Du spielst jetzt für ${was} weiter!` : `${s.name} spielt jetzt für ${was} weiter!`, <Avatar kind={s.avatar} size={30} bg={s.color} />, 4500);
    if (!prev || prev.round !== game.round) {
      // Gerade erst reingekommen und gleich auf einen freien Platz gesetzt
      const mine = game.seats.find((s) => s.uid === uid);
      if (!prev && mine?.was) say(mine, mine.was);
      return;
    }
    game.seats.forEach((s, i) => {
      if (s.uid && s.uid !== prev.seats[i]?.uid) say(s, s.was ?? prev.seats[i]?.name ?? 'Robo');
    });
  }, [seatKey, game?.round]);

  const actsKey = game ? game.seats.map((s) => (s.uid ? (seats[s.uid]?.acts ?? '') : '')).join('|') : '';
  const acts = useMemo(() => (game && info ? guestActs(game.seats, seats, info.host, game.round) : []), [actsKey, info?.host, game?.round]);
  const shared = useMemo(() => (game ? { seq: game.seq, st: game.st, ack: game.ack } : null), [game]);

  if (!info || info.status !== 'playing' || !game || !shared || me < 0) return null;

  const absent = absentSeats(game.seats, seats, serverNow(), me);
  const net: NetLink = { me, host, shared, acts, absent, publish: publishState, push: pushAct };
  const playSeats: SeatInfo[] = game.seats.map((s, i) => ({ name: s.name, avatar: s.avatar, color: s.color, robo: s.robo, profileId: i === me ? profileId : undefined }));
  const hostName = game.seats.find((s) => s.uid === info.host)?.name ?? 'der Gastgeber';
  const next = waitingKids(info, seats, game.seats).map((w) => w.doc.name);

  const profile = getData().profiles.find((p) => p.id === profileId);

  const left = profile ? learnLeft(GAME_BY_ID[game.game], profile, getData().settings) : 0;
  if (left) return <section className="game-screen card"><h2>Erst lernen, dann spielen</h2><p>Noch {left} Lernspiele bis zum Rennen.</p><button className="btn primary" onClick={() => void leaveRoom()}>Spielzimmer verlassen</button></section>;

  return (
    <>
      <GameScreen
        session={{ game: game.game, seats: playSeats, level: game.level, round: game.round }}
        net={net}
        online={{
          host,
          hostName,
          next,
          again: () => void startGame(),
          lobby: () => void backToLobby(),
          leave: () => void leaveRoom(),
          chat: () => setChat(true),
          bar: host ? (atEnd) => <HostBar players={game.seats} atEnd={atEnd} /> : undefined,
        }}
      />
      {chat && profile && <ChatSheet profile={profile} onClose={() => setChat(false)} />}
    </>
  );
}
