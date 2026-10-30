import { useEffect, useMemo, useState } from 'react';
import type { NetLink, SeatInfo } from '../engine/game';
import { rememberFriends } from '../net/cloud';
import { backToLobby, leaveRoom, publishState, pushAct, serverNow, startGame, useRoom } from '../net/room';
import { absentSeats, guestActs } from '../net/roomLogic';
import { GameScreen } from './GameScreen';

/** Das laufende Spiel im Online-Spielzimmer – auf jedem Gerät aus Sicht des eigenen Kindes. */
export function OnlineGame({ profileId }: { profileId: string }) {
  const room = useRoom();
  const { info, game, uid, seats } = room;
  const [, tick] = useState(0);

  // Alle paar Sekunden prüfen, wer gerade weg ist
  useEffect(() => {
    const t = window.setInterval(() => tick((x) => x + 1), 4000);
    return () => window.clearInterval(t);
  }, []);

  const me = game && uid ? game.seats.findIndex((s) => s.uid === uid) : -1;
  const host = !!info && info.host === uid;

  // Mitspieler als Spielfreunde merken
  useEffect(() => {
    if (!game || me < 0) return;
    const friends = Object.fromEntries(game.seats.filter((s, i) => i !== me && s.uid && !s.robo).map((s) => [s.uid!, { name: s.name, avatar: s.avatar, color: s.color }]));
    rememberFriends(profileId, friends);
  }, [game?.round, me]);

  const actsKey = game ? game.seats.map((s) => (s.uid ? (seats[s.uid]?.acts ?? '') : '')).join('|') : '';
  const acts = useMemo(() => (game && info ? guestActs(game.seats, seats, info.host, game.round) : []), [actsKey, info?.host, game?.round]);
  const shared = useMemo(() => (game ? { seq: game.seq, st: game.st, ack: game.ack } : null), [game]);

  if (!info || info.status !== 'playing' || !game || !shared || me < 0) return null;

  const absent = absentSeats(game.seats, seats, serverNow(), me);
  const net: NetLink = { me, host, shared, acts, absent, publish: publishState, push: pushAct };
  const playSeats: SeatInfo[] = game.seats.map((s, i) => ({ name: s.name, avatar: s.avatar, color: s.color, robo: s.robo, profileId: i === me ? profileId : undefined }));
  const hostName = game.seats.find((s) => s.uid === info.host)?.name ?? 'der Gastgeber';

  return (
    <GameScreen
      session={{ game: game.game, seats: playSeats, level: game.level, round: game.round }}
      net={net}
      online={{ host, hostName, again: () => void startGame(), lobby: () => void backToLobby(), leave: () => void leaveRoom() }}
    />
  );
}
