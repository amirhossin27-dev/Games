import { afterEach, beforeAll, describe, expect, it } from 'vitest';

/** Ein Schein-AudioContext, der nur mitschreibt, welche Wellenformen gespielt werden. */
const played: OscillatorType[] = [];
const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
const node = () => ({ connect: (n: unknown) => n });
class FakeAudioContext {
  currentTime = 0;
  state = 'running';
  sampleRate = 44100;
  destination = {};
  createOscillator() {
    const o = { ...node(), type: 'sine' as OscillatorType, frequency: param(), start() {}, stop() {} };
    return new Proxy(o, {
      set(t, k, v) {
        (t as Record<string | symbol, unknown>)[k] = v;
        return true;
      },
      get(t, k) {
        if (k === 'start') return () => played.push(t.type);
        return (t as Record<string | symbol, unknown>)[k];
      },
    });
  }
  createGain() {
    return { ...node(), gain: param() };
  }
  createBiquadFilter() {
    return { ...node(), type: 'lowpass', frequency: param(), Q: param() };
  }
  createBuffer(_c: number, len: number) {
    return { getChannelData: () => new Float32Array(len) };
  }
  createBufferSource() {
    return { ...node(), buffer: null, start() {} };
  }
}

let engine: typeof import('../engine');

beforeAll(async () => {
  (globalThis as unknown as { window: unknown }).window = {
    AudioContext: FakeAudioContext,
    setTimeout: (fn: () => void) => {
      fn();
      return 0;
    },
  };
  engine = await import('../engine');
});

afterEach(() => {
  played.length = 0;
  engine.setSoundStyle('soft');
});

describe('Klänge', () => {
  it('Lern- und Brettspiele klingen weich: nur Sinus-Töne, kein Schnarren', () => {
    expect(engine.soundStyle()).toBe('soft');
    for (const k of ['tap', 'flip', 'point', 'match', 'miss', 'win', 'lose', 'draw', 'dice', 'take', 'hit'] as const) engine.sfx[k]();
    expect(played.length).toBeGreaterThan(20);
    expect(new Set(played)).toEqual(new Set(['sine']));
  });

  it('Arcade behält den 8-Bit-Klang', () => {
    engine.setSoundStyle('retro');
    engine.sfx.tap();
    engine.sfx.miss();
    engine.sfx.win();
    expect(played).toContain('square');
    expect(played).toContain('sawtooth');
  });

  it('Arcade-eigene Klänge bleiben auch im weichen Stil retro', () => {
    engine.sfx.bounce();
    engine.sfx.brick();
    expect(played).toEqual(['square', 'square']);
  });
});
