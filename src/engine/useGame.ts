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
  isHuman(seat: number): boolean;
  /** Zug für `by` (Standard: wer dran ist bzw. das einzige Kind) */
  act(a: A, by?: number): boolean;
  /** Ein Kind auf diesem Gerät darf gerade ziehen */
  myTurn: boolean;
  /** Robo überlegt */
  thinking: boolean;
  /** Sichtschutz: für welchen Platz? */
  curtain: number | null;
  reveal(): void;
}

/** Macht aus einer Spieldefinition ein lauffähiges Spiel an einem Gerät (Kinder + Robo). */
export function useGame<S, A>(def: GameDef<S, A>, props: PlayProps): GameHandle<S, A> {
  const { seats, level, starter } = props;
  const n = seats.length;
  const humans = seats.filter((x) => !x.robo).length;
  const firstHuman = Math.max(0, seats.findIndex((x) => !x.robo));
  const isHuman = (seat: number) => !!seats[seat] && !seats[seat].robo;

  const ref = useRef<{ s: S; v: number } | null>(null);
  if (!ref.current) ref.current = { s: def.init({ n, starter, level, humans, rnd: Math.random }), v: 0 };
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const commit = (s: S) => {
    ref.current = { s, v: ref.current!.v + 1 };
    bump();
  };
  const onEnd = useRef(props.onEnd);
  onEnd.current = props.onEnd;

  const { s, v: version } = ref.current;
  const turn = def.turn(s);
  const outcome = def.outcome(s);

  // Robo-Züge
  const timers = useRef(new Map<number, { key: string; t: number }>());
  useEffect(() => {
    const map = timers.current;
    const cur = ref.current!;
    const want = new Set<number>();
    if (def.robo && !def.outcome(cur.s)) {
      const t = def.turn(cur.s);
      if (t === 'all') seats.forEach((x, i) => x.robo && want.add(i));
      else if (typeof t === 'number' && seats[t]?.robo) want.add(t);
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
  }, [version]);

  useEffect(
    () => () => {
      timers.current.forEach((tm) => window.clearTimeout(tm.t));
      timers.current.clear();
    },
    [],
  );

  // Automatische Schritte
  useEffect(() => {
    const cur = ref.current!;
    const au = def.auto?.(cur.s);
    if (!au) return;
    const t = window.setTimeout(() => {
      if (ref.current !== cur) return;
      const next = def.apply(cur.s, au.action, au.by, Math.random);
      if (next) commit(next);
    }, au.delay);
    return () => window.clearTimeout(t);
  }, [version]);

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

  const act = (a: A, by?: number) => {
    const cur = ref.current!;
    if (def.outcome(cur.s)) return false;
    const t = def.turn(cur.s);
    const seat = by ?? (typeof t === 'number' ? t : firstHuman);
    if (!isHuman(seat)) return false;
    const next = def.apply(cur.s, a, seat, Math.random);
    if (!next) return false;
    commit(next);
    return true;
  };

  // Sichtschutz, wenn mehrere Kinder sich ein Gerät teilen
  const viewer = humans > 1 && def.viewer ? def.viewer(s) : null;
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
  const view = humans <= 1 || !def.viewer ? firstHuman : (revealed ?? viewerHuman ?? firstHuman);

  return {
    s,
    version,
    turn,
    outcome,
    view,
    humans,
    isHuman,
    act,
    myTurn: !outcome && handover === null && (turn === 'all' ? humans > 0 : typeof turn === 'number' && isHuman(turn)),
    thinking: !outcome && typeof turn === 'number' && !!seats[turn]?.robo,
    curtain,
    reveal: () => {
      setRevealed(viewerHuman);
      setShownFor(null);
    },
  };
}
