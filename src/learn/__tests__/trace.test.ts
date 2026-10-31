import { describe, expect, it } from 'vitest';
import { checkFree, checkStroke, starsFor, TOLERANCE } from '../trace/check';
import { pathPoints, resample, type Pt } from '../trace/path';
import { numberTask, TRACE_EACH, TRACE_SOLO, traceDef, tracePoints } from '../trace/game';
import { DIGITS, digitLayout, SCHWUNGE, schwungLayout } from '../trace/shapes';

/** Fester Zufall, damit die Tests immer gleich laufen */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/** Wie ein Kinderfinger: leicht zittrig, etwas versetzt, ungleichmäßig schnell */
function wobble(line: Pt[], amount: number, seed = 1, shift: Pt = [0, 0]): Pt[] {
  const r = seeded(seed);
  let ox = 0;
  let oy = 0;
  return resample(line, Math.round(line.length * 0.7)).map(([x, y]) => {
    ox = ox * 0.8 + (r() - 0.5) * amount;
    oy = oy * 0.8 + (r() - 0.5) * amount;
    return [x + ox + shift[0], y + oy + shift[1]] as Pt;
  });
}

const ALL = [...Object.keys(DIGITS).map((d) => digitLayout(d)), ...SCHWUNGE.map((s) => schwungLayout(s.id))];

describe('Pfade', () => {
  it('liest Linien, Kurven und Bögen', () => {
    const pts = pathPoints('M 0 0 L 10 0 C 10 10 20 10 20 0 Q 30 -10 40 0 A 10 10 0 0 1 60 0 Z');
    expect(pts[0]).toEqual([0, 0]);
    expect(pts.at(-1)).toEqual([0, 0]);
    // Der Halbkreis von 40,0 nach 60,0 mit Uhrzeigersinn geht über y = -10 (nach oben)
    const arc = pts.filter((p) => p[0] > 45 && p[0] < 55);
    expect(Math.min(...arc.map((p) => p[1]))).toBeCloseTo(-10, 0);
  });

  it('macht Punktfolgen gleichmäßig', () => {
    const r = resample([[0, 0], [100, 0]], 11);
    expect(r).toHaveLength(11);
    expect(r[5][0]).toBeCloseTo(50);
  });
});

describe('Strichprüfung', () => {
  it('nimmt sauber nachgespurte Striche auf jeder Stufe an', () => {
    for (const l of ALL)
      for (const t of TOLERANCE)
        for (const s of l.strokes) {
          const r = checkStroke(s, s, t);
          expect(r.ok).toBe(true);
          expect(r.quality).toBeGreaterThan(0.95);
        }
  });

  it('nimmt zittrige Kinderstriche auf Leicht und Mittel an', () => {
    let seed = 1;
    for (const l of ALL)
      for (const s of l.strokes) {
        expect(checkStroke(wobble(s, 6, seed++, [3, -2]), s, TOLERANCE[0]).ok).toBe(true);
        expect(checkStroke(wobble(s, 3, seed++, [2, 1]), s, TOLERANCE[1]).ok).toBe(true);
      }
  });

  it('lehnt die falsche Richtung ab', () => {
    for (const l of ALL)
      for (const s of l.strokes) {
        const closed = Math.hypot(s[0][0] - s.at(-1)![0], s[0][1] - s.at(-1)![1]) < 5;
        const r = checkStroke([...s].reverse(), s, TOLERANCE[0]);
        expect(r.ok).toBe(false);
        // Bei geschlossenen Formen (0, Kreis) stimmt der Start, nur die Richtung nicht
        if (!closed) expect(r.why).toBe('start');
        else expect(r.why).toBe('direction');
      }
  });

  it('lehnt Striche ab, die woanders anfangen', () => {
    const s = digitLayout('7').strokes[0];
    const r = checkStroke(s.map(([x, y]) => [x + 30, y + 30] as Pt), s, TOLERANCE[0]);
    expect(r).toMatchObject({ ok: false, why: 'start' });
  });

  it('lehnt halbe Striche und Gekritzel ab', () => {
    const s = digitLayout('2').strokes[0];
    expect(checkStroke(s.slice(0, Math.round(s.length / 2)), s, TOLERANCE[0]).ok).toBe(false);
    const r = seeded(7);
    const scribble: Pt[] = [s[0]];
    for (let i = 0; i < 80; i++) scribble.push([20 + r() * 60, 10 + r() * 80]);
    expect(checkStroke(scribble, s, TOLERANCE[0]).ok).toBe(false);
    expect(checkStroke([s[0], s[1]], s, TOLERANCE[0])).toMatchObject({ ok: false, why: 'short' });
  });

  it('Schwer ist strenger als Leicht', () => {
    const s = digitLayout('3').strokes[0];
    const sloppy = wobble(s, 4, 3, [11, 0]);
    expect(checkStroke(sloppy, s, TOLERANCE[0]).ok).toBe(true);
    expect(checkStroke(sloppy, s, TOLERANCE[2]).ok).toBe(false);
  });

  it('gibt Sterne nach Sauberkeit und Versuchen', () => {
    expect(starsFor([0.95, 0.9], 0, false)).toBe(3);
    expect(starsFor([0.95], 1, false)).toBe(2);
    expect(starsFor([0.5], 0, false)).toBe(1);
    expect(starsFor([1], 0, true)).toBe(1);
  });
});

describe('Freies Schreiben', () => {
  /** Ziffer klein und versetzt ins Kästchen schreiben */
  const write = (text: string, scale = 0.7, seed = 1) => {
    const l = digitLayout(text);
    return l.strokes.map((s, k) => {
      const cell = l.cells[l.cellOf[k]];
      const cx = cell.x + cell.w / 2;
      return wobble(s, 2, seed + k).map(([x, y]) => [cx + (x - cx) * scale + 4, 50 + (y - 50) * scale - 3] as Pt);
    });
  };

  it('erkennt jede Ziffer', () => {
    for (const d of Object.keys(DIGITS)) {
      const r = checkFree(write(d), d, digitLayout(d).cells);
      expect(r.read).toBe(d);
      expect(r.ok).toBe(true);
    }
  });

  it('erkennt zweistellige Zahlen', () => {
    for (const n of ['12', '17', '20', '15', '19']) expect(checkFree(write(n), n, digitLayout(n).cells).ok).toBe(true);
  });

  it('lehnt eine falsche Ziffer ab', () => {
    const wrong: [string, string][] = [['1', '7'], ['3', '8'], ['6', '0'], ['9', '4'], ['2', '5'], ['0', '8']];
    for (const [written, expected] of wrong) {
      const r = checkFree(write(written), expected, digitLayout(expected).cells);
      expect(r.ok, `${written} statt ${expected}`).toBe(false);
    }
  });

  it('lehnt ein leeres Kästchen ab', () => {
    const strokes = write('1');
    expect(checkFree(strokes, '12', digitLayout('12').cells).ok).toBe(false);
  });
});

describe('Spielregeln Nachspuren', () => {
  const ctx = (n: number, level: 0 | 1 | 2, shared = false, seed = 3) => ({ n, starter: 0, level, humans: shared ? n : 1, shared, rnd: seeded(seed) });

  it('legt Aufgaben je Stufe an', () => {
    for (const level of [0, 1, 2] as const) {
      const s = traceDef('schwung').init(ctx(1, level));
      expect(s.tasks).toHaveLength(TRACE_SOLO);
      for (const t of s.tasks) expect(t.k === 'schwung' && SCHWUNGE.find((x) => x.id === t.id)!.level).toBe(level);
    }
    const r = seeded(9);
    for (let i = 0; i < 300; i++) {
      const easy = numberTask(0, r);
      expect(easy.k === 'zahl' && easy.mode === 'guided' && Number(easy.text) <= 9).toBe(true);
      const mid = numberTask(1, r);
      expect(mid.k === 'zahl' && mid.mode === 'guided' && Number(mid.text) >= 1 && Number(mid.text) <= 20 && mid.count?.n === Number(mid.text)).toBe(true);
      const hard = numberTask(2, r);
      if (hard.k !== 'zahl') throw new Error('Zahl erwartet');
      expect(hard.mode).toBe('free');
      expect(Number(hard.text)).toBeGreaterThanOrEqual(0);
      expect(Number(hard.text)).toBeLessThanOrEqual(20);
      const calc = /^(\d+) ([+−]) (\d+) = \?$/.exec(hard.prompt);
      if (calc) expect(calc[2] === '+' ? Number(calc[1]) + Number(calc[3]) : Number(calc[1]) - Number(calc[3])).toBe(Number(hard.text));
    }
  });

  it('zählt Sterne, Punkte und geht reihum weiter', () => {
    const def = traceDef('zahlen');
    let s = def.init(ctx(2, 0, true));
    expect(s.order).toBe('turns');
    expect(s.tasks).toHaveLength(TRACE_EACH * 2);
    expect(def.turn(s)).toBe(0);
    expect(def.apply(s, { t: 'done', stars: 3, ms: 4000 }, 1, Math.random)).toBeNull();
    expect(def.apply(s, { t: 'done', stars: 7, ms: 4000 }, 0, Math.random)).toBeNull();
    s = def.apply(s, { t: 'done', stars: 3, ms: 4000 }, 0, Math.random)!;
    expect(s.phase).toBe('reveal');
    expect(s.scores[0]).toBe(tracePoints({ stars: 3, ms: 4000 }));
    expect(s.correct[0]).toBe(1);
    s = def.apply(s, { t: 'next' }, 0, Math.random)!;
    expect(def.turn(s)).toBe(1);
    // Ganze Runde zu Ende spielen
    while (s.phase !== 'done') {
      if (s.phase === 'reveal') s = def.apply(s, { t: 'next' }, 0, Math.random)!;
      else s = def.apply(s, { t: 'done', stars: 1, ms: 20000 }, def.turn(s) as number, Math.random)!;
    }
    const o = def.outcome(s)!;
    expect(o.asked).toEqual([3, 3]);
    expect(o.places).toEqual([1, 2]);
  });

  it('spielt mit Robo gleichzeitig und übersteht den Weg übers Netz', () => {
    const def = traceDef('schwung');
    let s = def.init(ctx(2, 2));
    expect(def.turn(s)).toBe('all');
    const r = seeded(4);
    for (let i = 0; i < 40 && s.phase !== 'done'; i++) {
      s = JSON.parse(JSON.stringify(s));
      if (s.phase === 'reveal') s = def.apply(s, { t: 'next' }, 0, r)!;
      else {
        if (!s.answers[0]) s = def.apply(s, { t: 'done', stars: 2, ms: 9000 }, 0, r)!;
        const a = def.robo!(s, 1, 2, r);
        if (a) s = def.apply(s, a, 1, r)!;
      }
    }
    expect(s.phase).toBe('done');
    expect(def.outcome(s)!.asked).toEqual([TRACE_SOLO, TRACE_SOLO]);
  });
});
