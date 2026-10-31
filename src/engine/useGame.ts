import { useEffect, useReducer, useRef, useState } from 'react';
import type { GameDef, Outcome, PlayProps } from './game';

export interface GameHandle<S, A> {
  s: S;
  /** Zählt bei jeder Änderung hoch (z. B. für Töne) */
  version: number;
  turn: number | 'all' | null;
  outcome: Outcome | null;
  /** Aus wessen Sicht gezeigt wird (eigene Karten unten) */
  view: number;
  humans: number;
  /** Darf dieses Gerät für diesen Platz spielen? */
  isHuman(seat: number): boolean;
  /** Zug für `by` (Standard: wer dran ist bzw. das eigene Kind) */
  act(a: A, by?: number): boolean;
  /** Ein Kind auf diesem Gerät darf gerade ziehen */
  myTurn: boolean;
  /** Robo (oder Robo als Vertretung) überlegt */
  thinking: boolean;
  /** Sichtschutz: für welchen Platz? */
  curtain: number | null;
  reveal(): void;
  /** Online: eigener Zug ist unterwegs zum Gastgeber */
  pending: boolean;
}

interface Snap<S> {
  s: S;
  v: number;
  seq: number;
  ack: Record<string, number>;
}

/**
 * Macht aus einer Spieldefinition ein lauffähiges Spiel: an einem Gerät (Kinder + Robo) oder –
 * mit `props.net` – im Online-Spielzimmer. Dort rechnet nur der Gastgeber; die anderen Geräte
 * schicken ihre Züge und zeigen den neuesten veröffentlichten Stand.
 */
export function useGame<S, A>(def: GameDef<S, A>, props: PlayProps): GameHandle<S, A> {
  const { seats, level, starter, net } = props;
  const online = !!net;
  const n = seats.length;
  const humansHere = online ? 1 : seats.filter((x) => !x.robo).length;
  const firstHuman = online ? net!.me : Math.max(0, seats.findIndex((x) => !x.robo));
  const isHuman = (seat: number) => (online ? seat === net!.me : !!seats[seat] && !seats[seat].robo);
  /** Rechnet dieses Gerät? (an einem Gerät immer, online nur der Gastgeber) */
  const authority = !online || net!.host;

  const ref = useRef<Snap<S> | null>(null);
  if (!ref.current) {
    ref.current = online
      ? { s: net!.shared.st as S, v: 0, seq: net!.shared.seq, ack: { ...net!.shared.ack } }
      : { s: def.init({ n, starter, level, humans: humansHere, shared: humansHere > 1, rnd: Math.random }), v: 0, seq: 0, ack: {} };
  }
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const netRef = useRef(net);
  netRef.current = net;
  const onEnd = useRef(props.onEnd);
  onEnd.current = props.onEnd;
  const [pendingAt, setPendingAt] = useState<number | null>(null);

  const commit = (s: S, ack = ref.current!.ack) => {
    const cur = ref.current!;
    ref.current = { s, v: cur.v + 1, seq: cur.seq + 1, ack };
    bump();
    const link = netRef.current;
    if (link?.host) link.publish(ref.current.seq, s, ack);
  };

  const { s, v: version } = ref.current;
  const turn = def.turn(s);
  const outcome = def.outcome(s);

  // Online (Gast): neuere Stände vom Gastgeber übernehmen
  const shared = net?.shared;
  useEffect(() => {
    if (!shared || shared.seq <= ref.current!.seq) return;
    ref.current = { s: shared.st as S, v: ref.current!.v + 1, seq: shared.seq, ack: { ...shared.ack } };
    setPendingAt(null);
    bump();
  }, [shared]);

  // Online (Gastgeber): Züge der Gäste übernehmen
  const acts = net?.acts;
  const isHost = !!net?.host;
  useEffect(() => {
    if (!acts || !isHost) return;
    const cur = ref.current!;
    let s2 = cur.s;
    const ack = { ...cur.ack };
    let changed = false;
    for (const { seat, n: k, a } of acts) {
      if (k <= (ack[seat] ?? 0)) continue;
      ack[seat] = k;
      changed = true;
      if (def.outcome(s2)) continue;
      const next = def.apply(s2, a as A, seat, Math.random);
      if (next) s2 = next;
    }
    if (changed) commit(s2, ack);
  }, [acts, isHost, version]);

  // Robo-Züge (auch als Vertretung für Kinder, deren Gerät gerade weg ist)
  const absent = net?.absent ?? [];
  const absentKey = absent.join(',');
  // Online kann ein neues Kind mitten in der Runde einen Robo-Platz übernehmen – dann neu planen.
  const roboKey = seats.map((x) => (x.robo ? 1 : 0)).join('');
  const timers = useRef(new Map<number, { key: string; t: number }>());
  useEffect(() => {
    const map = timers.current;
    const cur = ref.current!;
    const want = new Set<number>();
    if (authority && def.robo && !def.outcome(cur.s)) {
      const t = def.turn(cur.s);
      const plays = (i: number) => !!seats[i]?.robo || (online && absent.includes(i));
      if (t === 'all') seats.forEach((_, i) => plays(i) && want.add(i));
      else if (typeof t === 'number' && plays(t)) want.add(t);
    }
    const key = def.phaseKey ? def.phaseKey(cur.s) : `v${cur.v}`;
    for (const [seat, tm] of map) {
      if (!want.has(seat) || tm.key !== key) {
        window.clearTimeout(tm.t);
        map.delete(seat);
      }
    }
    for (const seat of want) {
      if (map.has(seat)) continue;
      const delay = def.roboDelay?.(cur.s, seat) ?? 800;
      const t = window.setTimeout(() => {
        map.delete(seat);
        const now = ref.current!;
        if (def.outcome(now.s)) return;
        const a = def.robo!(now.s, seat, level, Math.random);
        if (a === null) return;
        const next = def.apply(now.s, a, seat, Math.random);
        if (next) commit(next);
      }, delay);
      map.set(seat, { key, t });
    }
  }, [version, authority, absentKey, roboKey]);

  useEffect(
    () => () => {
      timers.current.forEach((tm) => window.clearTimeout(tm.t));
      timers.current.clear();
    },
    [],
  );

  // Automatische Schritte (nur wer rechnet)
  useEffect(() => {
    if (!authority) return;
    const cur = ref.current!;
    const au = def.auto?.(cur.s);
    if (!au) return;
    const t = window.setTimeout(() => {
      if (ref.current !== cur) return;
      const next = def.apply(cur.s, au.action, au.by, Math.random);
      if (next) commit(next);
    }, au.delay);
    return () => window.clearTimeout(t);
  }, [version, authority]);

  // Spiel vorbei
  const ended = useRef(false);
  useEffect(() => {
    const o = def.outcome(ref.current!.s);
    if (!o || ended.current) return;
    const t = window.setTimeout(() => {
      ended.current = true;
      onEnd.current(o);
    }, def.endDelay ?? 1200);
    return () => window.clearTimeout(t);
  }, [version]);

  // Online: Ist ein Zug zu lange unterwegs (Verbindung weg), Knöpfe wieder freigeben.
  useEffect(() => {
    if (pendingAt === null) return;
    const t = window.setTimeout(() => setPendingAt(null), 8000);
    return () => window.clearTimeout(t);
  }, [pendingAt]);

  const act = (a: A, by?: number) => {
    const cur = ref.current!;
    if (def.outcome(cur.s)) return false;
    const t = def.turn(cur.s);
    const seat = by ?? (online ? net!.me : typeof t === 'number' ? t : firstHuman);
    if (!isHuman(seat)) return false;
    if (online && !net!.host) {
      // Gast: nur prüfen, ob der Zug gerade erlaubt wäre – rechnen tut der Gastgeber.
      if (pendingAt !== null || !def.apply(cur.s, a, seat, Math.random)) return false;
      net!.push(a);
      setPendingAt(Date.now());
      return true;
    }
    const next = def.apply(cur.s, a, seat, Math.random);
    if (!next) return false;
    commit(next);
    return true;
  };

  // Sichtschutz, wenn mehrere Kinder sich ein Gerät teilen
  const viewer = humansHere > 1 && def.viewer ? def.viewer(s) : null;
  const viewerHuman = viewer !== null && isHuman(viewer) ? viewer : null;
  const [revealed, setRevealed] = useState<number | null>(null);
  const handover = viewerHuman !== null && viewerHuman !== revealed && !outcome ? viewerHuman : null;
  const [shownFor, setShownFor] = useState<number | null>(null);
  useEffect(() => {
    if (handover === null) return;
    if (revealed === null) {
      setShownFor(handover);
      return;
    }
    // Kurz warten, damit man das Ergebnis des eigenen Zugs noch sieht.
    const t = window.setTimeout(() => setShownFor(handover), 1300);
    return () => window.clearTimeout(t);
  }, [handover, revealed]);
  const curtain = handover !== null && shownFor === handover ? handover : null;
  const view = online ? net!.me : humansHere <= 1 || !def.viewer ? firstHuman : (revealed ?? viewerHuman ?? firstHuman);
  const pending = pendingAt !== null;

  return {
    s,
    version,
    turn,
    outcome,
    view,
    humans: humansHere,
    isHuman,
    act,
    myTurn: !outcome && !pending && handover === null && (turn === 'all' ? humansHere > 0 : typeof turn === 'number' && isHuman(turn)),
    thinking: !outcome && typeof turn === 'number' && (!!seats[turn]?.robo || (online && absent.includes(turn))),
    curtain,
    reveal: () => {
      setRevealed(viewerHuman);
      setShownFor(null);
    },
    pending,
  };
}
