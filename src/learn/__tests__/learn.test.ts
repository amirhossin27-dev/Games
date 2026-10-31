import { describe, expect, it } from 'vitest';
import type { BankItem } from '../choice';
import { EN_GAPS, EN_PHRASES, EN_WORDS, englishTask } from '../english';
import { quizDef } from '../quiz';
import { makeTask, type Subject } from '../tasks';
import { COMPOUNDS, PLURALS, SHORT_WORDS, SPELLING, SYLLABLES, wordTask } from '../words';
import { WORLD_EASY, WORLD_HARD, WORLD_MEDIUM, worldTask } from '../world';
import type { Level } from '../../lib/store';

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

const LEVELS: Level[] = [0, 1, 2];

function checkBank(bank: BankItem[]) {
  for (const it of bank) {
    expect(it.w.length, it.q).toBeGreaterThanOrEqual(3);
    expect(it.w, it.q).not.toContain(it.a);
    expect(new Set(it.w).size, it.q).toBe(it.w.length);
  }
}

describe('Neue Lernspiele', () => {
  it('jede Aufgabe hat vier verschiedene Antworten und genau eine richtige', () => {
    const rnd = seeded(3);
    for (const subject of ['rechnen', 'buchstaben', 'uhr', 'welt', 'woerter', 'englisch'] as Subject[])
      for (const level of LEVELS)
        for (let k = 0; k < 300; k++) {
          const t = makeTask(subject, level, rnd);
          expect(t.options, `${subject} ${level} ${t.prompt}`).toHaveLength(4);
          expect(new Set(t.options).size).toBe(4);
          expect(t.correct).toBeGreaterThanOrEqual(0);
          expect(t.prompt.length).toBeGreaterThan(0);
        }
  });

  it('genug verschiedene Aufgaben für eine Runde mit vier Kindern (20 ohne Wiederholung)', () => {
    for (const subject of ['welt', 'woerter', 'englisch'] as Subject[])
      for (const level of LEVELS) {
        const s = quizDef(subject).init({ n: 4, starter: 0, level, humans: 4, shared: true, rnd: seeded(level + 11) });
        expect(s.tasks).toHaveLength(20);
        const keys = s.tasks.map((t) => `${t.prompt}|${t.options[t.correct]}`);
        expect(new Set(keys).size, `${subject} ${level}`).toBe(20);
      }
  });

  it('Welt-Quiz: Sammlungen sind sauber, Leicht wird mit Bildern beantwortet', () => {
    for (const bank of [WORLD_EASY, WORLD_MEDIUM, WORLD_HARD]) {
      expect(bank.length).toBeGreaterThanOrEqual(30);
      checkBank(bank);
    }
    expect(worldTask(0, seeded(1)).pictures).toBe(true);
    expect(worldTask(2, seeded(1)).pictures).toBe(false);
  });

  it('Wort-Baumeister: Buchstaben und Silben ergeben das Wort', () => {
    const rnd = seeded(5);
    for (let k = 0; k < 200; k++) {
      const t = wordTask(0, rnd);
      expect(t.visual?.k).toBe('tiles');
      if (t.visual?.k === 'tiles') {
        const right = t.options[t.correct];
        expect([...t.visual.parts].sort().join('')).toBe([...right].sort().join(''));
        expect(t.visual.parts.join('')).not.toBe(right);
        expect(SHORT_WORDS.some(([w]) => w === right)).toBe(true);
      }
    }
    for (let k = 0; k < 300; k++) {
      const t = wordTask(1, rnd);
      const right = t.options[t.correct];
      if (t.visual?.k === 'tiles') expect(t.visual.parts.join('')).toBe(t.visual.parts.join('').toLowerCase());
      if (t.prompt.includes('?') && t.prompt.includes('·')) {
        // fehlende Silbe einsetzen ergibt ein Wort aus der Liste
        const full = t.prompt.replace('?', right).split(' · ').join('');
        expect(SYLLABLES.some(([s]) => s.join('') === full), full).toBe(true);
      }
    }
    for (const [syl] of SYLLABLES) expect(syl.length).toBeGreaterThanOrEqual(2);
    for (const c of COMPOUNDS) {
      expect(c.wrong).not.toContain(c.w);
      expect(c.wrong.length).toBeGreaterThanOrEqual(3);
    }
    for (const [w, , wrong] of SPELLING) {
      expect(wrong).not.toContain(w);
      expect(new Set(wrong).size, w).toBe(3);
    }
    for (const [one, , many, wrong] of PLURALS) {
      expect(wrong, one).not.toContain(many);
      expect(new Set(wrong).size, one).toBe(3);
    }
    // Schwer: auch die Mehrzahl kommt dran
    expect(Array.from({ length: 200 }, () => wordTask(2, rnd).hint).filter((h) => h === 'Wie heißt die Mehrzahl?').length).toBeGreaterThan(20);
  });

  it('English Words: jedes Wort hat Bild und Aussprache, Sätze sind sauber', () => {
    const en = EN_WORDS.map((w) => w.en);
    expect(new Set(en).size).toBe(en.length);
    for (const w of EN_WORDS) {
      expect(w.say.length).toBeGreaterThan(0);
      expect(EN_WORDS.filter((o) => o.cat === w.cat).length).toBeGreaterThanOrEqual(4);
    }
    checkBank(EN_PHRASES);
    checkBank(EN_GAPS);
    for (const g of EN_GAPS) expect(g.q, g.q).toContain('___');
    // Leicht und Mittel zeigen nach der Antwort, wie man das Wort ausspricht
    const rnd = seeded(9);
    for (const level of [0, 1] as Level[])
      for (let k = 0; k < 50; k++) expect(englishTask(level, rnd).explain).toMatch(/Man sagt ungefähr/);
  });
});
