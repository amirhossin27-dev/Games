import { describe, expect, it } from 'vitest';
import { applyResult, BADGES } from '../lib/progress';
import { nextSpruch, SPRUECHE, startSpruch, type SpruchDeck } from '../lib/sprueche';
import { newProfile } from '../lib/store';

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

describe('Mut-mach-Sprüche', () => {
  it('hat 30 verschiedene, kurze Sprüche', () => {
    expect(SPRUECHE).toHaveLength(30);
    expect(new Set(SPRUECHE).size).toBe(30);
    for (const s of SPRUECHE) {
      expect(s.trim()).toBe(s);
      expect(s.length).toBeGreaterThan(5);
      expect(s.length).toBeLessThanOrEqual(70);
    }
  });

  it('zeigt bei jedem Start einen anderen Spruch und erst nach allen 30 wieder den ersten', () => {
    const rnd = seeded(7);
    let deck: SpruchDeck | null = null;
    const shown: number[] = [];
    for (let start = 0; start < 300; start++) {
      const next = nextSpruch(deck, SPRUECHE.length, rnd);
      shown.push(next.index);
      deck = JSON.parse(JSON.stringify(next.deck)) as SpruchDeck;
    }
    for (let i = 1; i < shown.length; i++) expect(shown[i]).not.toBe(shown[i - 1]);
    for (let block = 0; block < 10; block++) {
      expect(new Set(shown.slice(block * 30, block * 30 + 30)).size).toBe(30);
    }
  });

  it('mischt neu, wenn der gespeicherte Stapel fehlt oder kaputt ist', () => {
    for (const saved of [null, 'quatsch', { order: [0, 1, 2], pos: 0 }, { order: Array(30).fill(0), pos: 0 }, { order: [...SPRUECHE.keys()], pos: 99 }]) {
      const { index, deck } = nextSpruch(saved);
      expect(deck.pos).toBe(0);
      expect(new Set(deck.order).size).toBe(30);
      expect(index).toBe(deck.order[0]);
    }
  });

  it('bleibt während eines Starts gleich, auch ohne Speicher', () => {
    const first = startSpruch();
    expect(SPRUECHE).toContain(first);
    expect(startSpruch()).toBe(first);
  });
});

describe('ohne Tagesaufgabe', () => {
  it('gibt nur die Sterne aus dem Spiel, keinen Bonus mehr', () => {
    const p = newProfile({ name: 'Flinker Fuchs', avatar: 'fuchs', color: '#F6D3B8', age: 1 });
    const res = applyResult(p, { profileId: p.id, game: 'rechnen', stars: 3, won: false, together: true, logic: false, correct: 10, subject: 'math' });
    expect(res.out.starsGained).toBe(3);
    expect(res.profile.stars).toBe(3);
  });

  it('vergibt den Dranbleiber nach 50 Spielen', () => {
    const badge = BADGES.find((b) => b.name === 'Dranbleiber')!;
    let p = newProfile({ name: 'Mutige Eule', avatar: 'eule', color: '#F6D3B8', age: 2 });
    p = { ...p, games: { rechnen: { played: 30, won: 0, stars: 2 }, paare: { played: 18, won: 0, stars: 1 } } };
    let res = applyResult(p, { profileId: p.id, game: 'paare', stars: 1, won: false, together: false, logic: false });
    expect(res.out.earned).not.toContain(badge);
    res = applyResult(res.profile, { profileId: p.id, game: 'paare', stars: 1, won: false, together: false, logic: false });
    expect(res.out.earned).toContain(badge);
    expect(BADGES).toHaveLength(12);
  });
});
