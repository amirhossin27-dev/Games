import { describe, expect, it } from 'vitest';
import type { GameDef, InitCtx } from '../engine/game';
import { c4Def, memoryDef, tttDef, tttResult, type MemoryState } from '../games/rules/classic';
import { dice, ludoAbs, ludoDef, ludoMoves, LUDO_START, type LudoState } from '../games/rules/ludo';
import { mauDef, mauPlayable, type Card, type MauState } from '../games/rules/maumau';
import { allSunk, battleDef, randomFleet, SEA_FOR, validFleet, type BattleState } from '../games/rules/schiffe';
import { catPoints, slfDef, type SlfRound } from '../games/rules/slf';
import { catScore, catsFor, total, wuerfelDef, wuerfelRobo, type WuerfelState } from '../games/rules/wuerfel';
import { GAME_BY_ID, GAMES } from '../games/registry';
import { quizDef, quizPoints, type QuizState } from '../learn/quiz';
import { clockTask, clockWords, letterTask, makeTask, mathTask } from '../learn/tasks';
import { generatedName, isGeneratedName, nameProblem } from '../lib/names';
import { addPlay, freshPlay, LOCK_MS, normalize, statusOf, unlocked, withBonus, withLimit } from '../lib/playtime';
import { applyResult, levelOf, starsForPlace, starsForRatio, starsForScore } from '../lib/progress';
import { newProfile, type Level } from '../lib/store';
import { arcadeAfter, ARCADE_AFTER_DEFAULT, isLearnGame, learnedToday, learnLeft } from '../lib/unlock';
import { dayKey, placesFromScores } from '../lib/util';

/** Reproduzierbarer Zufall */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ctx = (n: number, extra: Partial<InitCtx> = {}): InitCtx => ({ n, starter: 0, level: 1, humans: 1, shared: false, rnd: seeded(7), ...extra });

/** Lässt ein Spiel komplett von Robo spielen – endet es sauber? */
function playOut<S, A>(def: GameDef<S, A>, c: InitCtx, max = 5000): { s: S; steps: number } {
  const rnd = seeded(42);
  let s = def.init(c);
  for (let steps = 0; steps < max; steps++) {
    if (def.outcome(s)) return { s, steps };
    const au = def.auto?.(s);
    if (au) {
      const next = def.apply(s, au.action, au.by, rnd);
      if (next) {
        s = next;
        continue;
      }
    }
    const t = def.turn(s);
    const seats = t === 'all' ? Array.from({ length: c.n }, (_, i) => i) : t === null ? [] : [t];
    let moved = false;
    for (const seat of seats) {
      const a = def.robo!(s, seat, c.level, rnd);
      if (a === null) continue;
      const next = def.apply(s, a, seat, rnd);
      if (next) {
        s = next;
        moved = true;
      }
    }
    if (!moved) throw new Error('Spiel hängt fest');
  }
  throw new Error('Spiel endet nicht');
}

describe('Spielzeit-Limit', () => {
  const t0 = 1_800_000_000_000;

  it('sperrt nach Ablauf des Kontingents für 12 Stunden', () => {
    let s = withLimit(freshPlay(), 30, t0);
    s = addPlay(s, t0, 29 * 60);
    expect(statusOf(s, t0).locked).toBe(false);
    expect(statusOf(s, t0).remainingSec).toBe(60);
    s = addPlay(s, t0 + 1000, 61);
    expect(statusOf(s, t0 + 1000).locked).toBe(true);
    expect(s.lockedUntil).toBe(t0 + 1000 + LOCK_MS);
    // Während der Sperre zählt nichts mehr
    expect(addPlay(s, t0 + 5000, 100)).toEqual(s);
    expect(statusOf(s, t0 + LOCK_MS).locked).toBe(true);
    // Nach 12 Stunden gibt es ein neues Kontingent
    const after = normalize(s, t0 + 1000 + LOCK_MS);
    expect(after.lockedUntil).toBeNull();
    expect(after.usedSec).toBe(0);
    expect(after.limitMin).toBe(30);
  });

  it('beginnt ein neues Fenster, wenn 12 Stunden seit dem ersten Spielen vorbei sind', () => {
    let s = withLimit(freshPlay(), 30, t0);
    s = addPlay(s, t0, 20 * 60);
    expect(statusOf(s, t0 + LOCK_MS - 1).remainingSec).toBe(10 * 60);
    expect(statusOf(s, t0 + LOCK_MS).remainingSec).toBe(30 * 60);
  });

  it('Eltern können Minuten schenken, die Sperre aufheben und das Limit ausschalten', () => {
    let s = addPlay(withLimit(freshPlay(), 15, t0), t0, 15 * 60);
    expect(statusOf(s, t0).locked).toBe(true);
    s = withBonus(s, 15, t0 + 10);
    expect(statusOf(s, t0 + 10).locked).toBe(false);
    expect(statusOf(s, t0 + 10).remainingSec).toBe(15 * 60);
    s = addPlay(s, t0 + 20, 15 * 60);
    expect(statusOf(s, t0 + 20).locked).toBe(true);
    expect(statusOf(unlocked(s), t0 + 30).remainingSec).toBe(15 * 60);
    expect(statusOf(withLimit(s, null, t0 + 30), t0 + 30)).toMatchObject({ locked: false, remainingSec: null });
  });

  it('ein kleineres Limit greift sofort', () => {
    const s = addPlay(withLimit(freshPlay(), 60, t0), t0, 40 * 60);
    expect(statusOf(withLimit(s, 30, t0), t0).locked).toBe(true);
  });
});

describe('Aufgaben', () => {
  const rnd = seeded(3);

  it('Rechenaufgaben haben genau eine richtige Antwort', () => {
    for (const level of [0, 1, 2] as Level[])
      for (let k = 0; k < 300; k++) {
        const t = mathTask(level, rnd);
        const m = t.prompt.match(/^(\d+) ([+−·]) (\d+) = \?$/)!;
        expect(m, t.prompt).toBeTruthy();
        const [a, op, b] = [Number(m[1]), m[2], Number(m[3])];
        const x = op === '+' ? a + b : op === '−' ? a - b : a * b;
        expect(Number(t.options[t.correct])).toBe(x);
        expect(new Set(t.options).size).toBe(t.options.length);
        expect(t.options.length).toBeGreaterThanOrEqual(3);
        expect(x).toBeGreaterThanOrEqual(0);
        if (level === 0) expect(Math.max(a, x)).toBeLessThanOrEqual(10);
        if (level === 1) expect(Math.max(a, x)).toBeLessThanOrEqual(20);
      }
  });

  it('Buchstaben-Aufgaben passen zum Wort', () => {
    for (let k = 0; k < 200; k++) {
      const t = letterTask(0, rnd);
      expect(t.visual?.k).toBe('picture');
      const word = t.visual?.k === 'picture' ? t.visual.word! : '';
      expect(t.options[t.correct]).toBe(word[0].toUpperCase().replace('Ä', 'A').replace('Ö', 'O').replace('Ü', 'U'));
      const pic = letterTask(1, rnd);
      expect(pic.pictures).toBe(true);
      const gap = letterTask(2, rnd);
      expect(gap.prompt).toContain('_');
    }
  });

  it('Uhrzeiten werden so gesagt, wie Kinder sie lernen', () => {
    expect(clockWords(3, 0)).toBe('3 Uhr');
    expect(clockWords(3, 30)).toBe('halb 4');
    expect(clockWords(12, 30)).toBe('halb 1');
    expect(clockWords(3, 15)).toBe('Viertel nach 3');
    expect(clockWords(3, 45)).toBe('Viertel vor 4');
    for (const level of [0, 1, 2] as Level[])
      for (let k = 0; k < 200; k++) {
        const t = clockTask(level, rnd);
        expect(t.visual?.k).toBe('clock');
        expect(new Set(t.options).size).toBe(t.options.length);
        if (t.visual?.k === 'clock') {
          const { h, m } = t.visual;
          const expected = level === 2 ? `${h}:${String(m).padStart(2, '0')}` : clockWords(h, m);
          expect(t.options[t.correct]).toBe(expected);
        }
      }
  });
});

describe('Lernspiele', () => {
  it('Punkte: 10 fürs Richtige, Bonus fürs Schnellsein', () => {
    expect(quizPoints(1000)).toBe(13);
    expect(quizPoints(4000)).toBe(12);
    expect(quizPoints(8000)).toBe(11);
    expect(quizPoints(20000)).toBe(10);
  });

  it('allein: 10 Aufgaben, Rekord sind die richtigen Antworten', () => {
    const def = quizDef('rechnen');
    let s: QuizState = def.init(ctx(1));
    expect(s.tasks).toHaveLength(10);
    expect(def.turn(s)).toBe('all');
    for (let q = 0; q < 10; q++) {
      const t = s.tasks[s.q];
      s = def.apply(s, { t: 'answer', i: q < 7 ? t.correct : (t.correct + 1) % t.options.length, ms: 2000 }, 0, Math.random)!;
      expect(s.phase).toBe('reveal');
      expect(def.apply(s, { t: 'answer', i: 0, ms: 1 }, 0, Math.random)).toBeNull();
      s = def.apply(s, { t: 'next' }, 0, Math.random)!;
    }
    const o = def.outcome(s)!;
    expect(o.solo?.score).toBe(7);
    expect(o.correct).toEqual([7]);
  });

  it('gegen Robo antworten alle gleichzeitig, an einem Gerät reihum', () => {
    const def = quizDef('uhr');
    const together = def.init(ctx(3, { humans: 1 }));
    expect(together.order).toBe('together');
    const a = def.apply(together, { t: 'answer', i: 0, ms: 3000 }, 1, Math.random)!;
    expect(a.phase).toBe('ask');
    const turns = def.init(ctx(3, { humans: 2, shared: true }));
    expect(turns.order).toBe('turns');
    expect(turns.tasks).toHaveLength(15);
    expect(def.turn(turns)).toBe(0);
    expect(def.apply(turns, { t: 'answer', i: 0, ms: 1 }, 1, Math.random)).toBeNull();
    const r = playOut(def, ctx(3, { humans: 1 }));
    expect(def.outcome(r.s)!.asked).toEqual([10, 10, 10]);
  });

  it('alle Fächer laufen mit Robo bis zum Ende', () => {
    for (const subject of ['rechnen', 'buchstaben', 'uhr', 'welt', 'woerter', 'englisch'] as const)
      for (const level of [0, 1, 2] as Level[]) {
        const t = makeTask(subject, level, Math.random);
        expect(t.correct).toBeGreaterThanOrEqual(0);
        playOut(quizDef(subject), ctx(4, { level }));
      }
  });
});

describe('Klassiker', () => {
  it('Tic-Tac-Toe erkennt Sieg und Unentschieden', () => {
    expect(tttResult([0, 0, 0, null, 1, 1, null, null, null])?.winner).toBe(0);
    expect(tttResult([0, 1, 0, 0, 1, 1, 1, 0, 0])?.winner).toBe('draw');
    for (const level of [0, 1, 2] as Level[]) playOut(tttDef, ctx(2, { level }));
  });

  it('Vier gewinnt endet mit Robo gegen Robo', () => {
    const { s } = playOut(c4Def, ctx(2, { level: 2 }));
    expect(c4Def.outcome(s)!.places.length).toBe(2);
  });

  it('Paare finden für vier: alle Paare werden verteilt', () => {
    const { s } = playOut(memoryDef, ctx(4, { level: 0 }));
    const m = s as MemoryState;
    expect(m.deck).toHaveLength(12);
    expect(m.owner.every((o) => o !== null)).toBe(true);
    const o = memoryDef.outcome(m)!;
    expect(o.scores!.reduce((a, b) => a + b, 0)).toBe(6);
  });
});

describe('Ludo für 2–4', () => {
  it('sitzt zu zweit gegenüber, zu viert an allen Ecken', () => {
    expect(ludoDef.init(ctx(2)).corner).toEqual([0, 2]);
    expect(ludoDef.init(ctx(4)).corner).toEqual([0, 1, 2, 3]);
  });

  it('wirft fremde Figuren raus – auch die dritte Farbe', () => {
    let s: LudoState = ludoDef.init(ctx(3));
    // Platz 1 steht 3 Felder vor dem Startfeld von Platz 0
    const target = (LUDO_START[0] + 3) % 40;
    const rel1 = (target - LUDO_START[1] + 40) % 40;
    s = { ...s, pos: [[0, -1, -1, -1], [rel1, -1, -1, -1], [0, -1, -1, -1]], turn: 0 };
    s = ludoDef.apply(s, { t: 'roll' }, 0, dice(3))!;
    expect(ludoMoves(s, 0, 3)).toEqual([0]);
    s = ludoDef.apply(s, { t: 'move', i: 0 }, 0, Math.random)!;
    expect(s.pos[1][0]).toBe(-1);
    expect(ludoAbs(s, 0, s.pos[0][0])).toBe(target);
    expect(s.turn).toBe(1);
  });

  it('endet, wenn alle bis auf einen im Ziel sind', () => {
    for (const n of [2, 3, 4]) {
      const { s } = playOut(ludoDef, ctx(n), 20000);
      const o = ludoDef.outcome(s)!;
      expect([...o.places].sort()).toEqual(Array.from({ length: n }, (_, i) => i + 1));
    }
  });
});

describe('Mau-Mau für 2–4', () => {
  const c = (id: number, s: Card['s'], r: number): Card => ({ id, s, r });

  it('eine 8 lässt den Nächsten aussetzen, eine 7 lässt ihn ziehen', () => {
    const base: MauState = { ...mauDef.init(ctx(3)), pile: [c(100, 'H', 9)], turn: 0, wish: null, penalty: 0, drawn: null };
    const eight = { ...base, hands: [[c(1, 'H', 8), c(2, 'C', 9)], [c(3, 'S', 10)], [c(4, 'D', 12)]] };
    const after8 = mauDef.apply(eight, { t: 'play', id: 1 }, 0, Math.random)!;
    expect(after8.turn).toBe(2);
    expect(after8.last?.skipped).toBe(1);
    const seven = { ...base, hands: [[c(5, 'H', 7), c(6, 'C', 9)], [c(7, 'S', 10)], [c(8, 'D', 12)]] };
    const after7 = mauDef.apply(seven, { t: 'play', id: 5 }, 0, Math.random)!;
    expect(after7.penalty).toBe(2);
    expect(mauPlayable(after7, c(7, 'S', 10))).toBe(false);
    const drew = mauDef.apply(after7, { t: 'draw' }, 1, Math.random)!;
    expect(drew.hands[1]).toHaveLength(3);
    expect(drew.turn).toBe(2);
  });

  it('Robo-Runden enden mit einem Sieger', () => {
    for (const n of [2, 3, 4]) {
      const { s } = playOut(mauDef, ctx(n), 20000);
      expect((s as MauState).hands.some((h) => h.length === 0)).toBe(true);
    }
  });
});

describe('Würfelglück', () => {
  it('zählt wie Kniffel', () => {
    expect(catScore('full', [2, 2, 3, 3, 3])).toBe(25);
    expect(catScore('small', [1, 2, 3, 4, 6])).toBe(30);
    expect(catScore('large', [2, 3, 4, 5, 6])).toBe(40);
    expect(catScore('lucky', [4, 4, 4, 4, 4])).toBe(50);
    expect(catScore('threes', [3, 3, 1, 3, 5])).toBe(9);
    expect(catsFor(0)).toHaveLength(8);
    expect(catsFor(1)).toHaveLength(13);
  });

  it('Robo füllt den Block für drei Kinder', () => {
    const { s } = playOut(wuerfelDef, ctx(3, { level: 0 }), 20000);
    const w = s as WuerfelState;
    const o = wuerfelDef.outcome(w)!;
    expect(o.scores).toEqual(w.sheets.map((sh) => total(sh, w.cats)));
    expect(wuerfelRobo({ ...w, rolls: 0 }, 0, 1, Math.random).t).toBe('roll');
  });
});

describe('Schiffe versenken', () => {
  it('stellt gültige Flotten für beide Meeresgrößen auf', () => {
    for (const level of [0, 1] as Level[]) {
      const { size, fleet } = SEA_FOR[level];
      for (let k = 0; k < 30; k++) expect(validFleet(randomFleet(size, fleet, Math.random), size, fleet)).toBe(true);
    }
  });

  it('Robo gegen Robo versenkt am Ende alles', () => {
    const { s } = playOut(battleDef, ctx(2, { level: 0 }), 5000);
    const b = s as BattleState;
    expect(allSunk(b.fleets[1 - b.winner!]!, b.shots[b.winner!])).toBe(true);
  });
});

describe('Stadt-Land-Fluss für mehrere', () => {
  it('Punkte: allein 20, anders 10, gleich 5', () => {
    const cats = ['stadt'] as const;
    const r: SlfRound = { letter: 'B', answers: [['Berlin'], ['Bonn'], ['berlin'], ['']], veto: [[false], [false], [false], [false]] };
    expect(catPoints(r, [...cats], 0)).toEqual([5, 10, 5, 0]);
    const alone: SlfRound = { ...r, answers: [['Bremen'], [''], ['Xanten'], ['']] };
    expect(catPoints(alone, [...cats], 0)).toEqual([20, 0, 0, 0]);
    const vetoed: SlfRound = { ...r, veto: [[false], [true], [false], [false]] };
    expect(catPoints(vetoed, [...cats], 0)).toEqual([5, 0, 5, 0]);
  });

  it('an einem Gerät schreibt einer nach dem anderen', () => {
    const def = slfDef([false, true, false]);
    let s = def.init(ctx(3, { humans: 2, shared: true }));
    expect(def.turn(s)).toBe(0);
    s = def.apply(s, { t: 'submit', answers: ['Bär', 'Ben', 'Berlin', 'Bonn'] }, 0, Math.random)!;
    expect(def.turn(s)).toBe(1);
    s = def.apply(s, def.robo!(s, 1, 1, Math.random)!, 1, Math.random)!;
    expect(def.turn(s)).toBe(2);
    s = def.apply(s, { t: 'submit', answers: [] }, 2, Math.random)!;
    expect(s.phase).toBe('review');
    expect(def.turn(s)).toBe('all');
  });
});

describe('Fortschritt', () => {
  it('Sterne nach Treffern, Platz und Rekord', () => {
    expect(starsForRatio(1)).toBe(3);
    expect(starsForRatio(0.7)).toBe(2);
    expect(starsForRatio(0)).toBe(1);
    expect(starsForPlace(1, false)).toBe(3);
    expect(starsForPlace(4, false)).toBe(1);
    expect(starsForPlace(1, true)).toBe(2);
    expect(starsForScore(30, 20, false)).toBe(3);
    expect(starsForScore(10, 20, true)).toBe(3);
    expect(starsForScore(5, undefined, false)).toBe(2);
    expect(starsForScore(5, 20, false, true)).toBe(1);
  });

  it('trägt Ergebnisse ein, zählt Rekorde und vergibt Abzeichen', () => {
    let p = newProfile({ name: 'Flinker Fuchs', avatar: 'fuchs', color: '#F6D3B8', age: 1 });
    let res = applyResult(p, { profileId: p.id, game: 'rechnen', stars: 3, won: false, together: false, logic: false, score: 9, correct: 9, subject: 'math' });
    p = res.profile;
    expect(p.counters.math).toBe(9);
    expect(p.games.rechnen.best).toBe(9);
    expect(res.out.newRecord).toBe(false);
    res = applyResult(p, { profileId: p.id, game: 'rechnen', stars: 3, won: false, together: false, logic: false, score: 10, correct: 10, subject: 'math' });
    expect(res.out.newRecord).toBe(true);
    expect(res.profile.games.rechnen.best).toBe(10);
    p = { ...res.profile, counters: { ...res.profile.counters, math: 45 } };
    res = applyResult(p, { profileId: p.id, game: 'rechnen', stars: 2, won: false, together: false, logic: false, correct: 6, subject: 'math' });
    expect(res.out.earned.map((b) => b.id)).toContain('rechen-profi');
    expect(levelOf(0).level).toBe(1);
    expect(levelOf(10).level).toBe(2);
    expect(levelOf(24).toNext).toBe(1);
  });

  it('Platzierungen teilen sich bei Gleichstand', () => {
    expect(placesFromScores([10, 20, 20, 5])).toEqual([3, 1, 1, 4]);
  });
});

describe('Namen und Katalog', () => {
  it('Namens-Würfel passt das Adjektiv an', () => {
    expect(generatedName('Flink', 'eule')).toBe('Flinke Eule');
    expect(generatedName('Mutig', 'loewe')).toBe('Mutiger Löwe');
    expect(isGeneratedName('Schlaue Katze')).toBe(true);
    expect(nameProblem('A')).toBeTruthy();
    expect(nameProblem('Kacke123')).toBeTruthy();
    expect(nameProblem('Kleiner Panda')).toBeNull();
  });

  it('jedes Spiel hat ein Tutorial mit mindestens zwei Schritten', () => {
    expect(GAMES).toHaveLength(29);
    for (const g of GAMES) {
      expect(g.tutorial.length, g.id).toBeGreaterThanOrEqual(2);
      for (const step of g.tutorial) expect(step.say.length, g.id).toBeGreaterThan(10);
      expect(g.players[0]).toBeLessThanOrEqual(g.players[1]);
    }
  });
});

describe('Erst lernen, dann spielen', () => {
  const settings = (arcadeAfter?: number) => ({ sound: true, speech: 'auto' as const, onlyGeneratedNames: false, arcadeAfter });
  const play = (p: ReturnType<typeof newProfile>, game: keyof typeof GAME_BY_ID) =>
    applyResult(p, { profileId: p.id, game, stars: 2, won: false, together: false, logic: false, learn: isLearnGame(GAME_BY_ID[game]) }).profile;

  it('trennt Lern- und Brettspiele von Arcade- und Duell-Spielen', () => {
    expect(GAMES.filter(isLearnGame)).toHaveLength(14);
    expect(isLearnGame(GAME_BY_ID.rechnen)).toBe(true);
    expect(isLearnGame(GAME_BY_ID.ludo)).toBe(true);
    expect(isLearnGame(GAME_BY_ID.schlange)).toBe(false);
    expect(isLearnGame(GAME_BY_ID.pong)).toBe(false);
  });

  it('schaltet Arcade-Spiele nach der eingestellten Zahl Lernspiele frei', () => {
    let p = newProfile({ name: 'Flinker Fuchs', avatar: 'fuchs', color: '#F6D3B8', age: 1 });
    const s = settings(2);
    expect(learnLeft(GAME_BY_ID.schlange, p, s)).toBe(2);
    expect(learnLeft(GAME_BY_ID.rechnen, p, s)).toBe(0);
    p = play(p, 'schlange');
    expect(learnedToday(p)).toBe(0);
    p = play(p, 'rechnen');
    expect(learnLeft(GAME_BY_ID.schlange, p, s)).toBe(1);
    p = play(p, 'vier');
    expect(learnLeft(GAME_BY_ID.schlange, p, s)).toBe(0);
    expect(learnLeft(GAME_BY_ID.pong, p, s)).toBe(0);
  });

  it('zählt jeden Tag neu und lässt sich ausschalten', () => {
    let p = newProfile({ name: 'Kluge Eule', avatar: 'eule', color: '#DCE9F3', age: 2 });
    p = { ...p, learnDay: { date: '2020-01-01', count: 5 } };
    expect(learnedToday(p)).toBe(0);
    expect(learnLeft(GAME_BY_ID.g2048, p, settings(3))).toBe(3);
    p = play(p, 'uhr');
    expect(p.learnDay).toEqual({ date: dayKey(), count: 1 });
    expect(learnLeft(GAME_BY_ID.g2048, p, settings(0))).toBe(0);
    expect(arcadeAfter(settings())).toBe(ARCADE_AFTER_DEFAULT);
  });
});
