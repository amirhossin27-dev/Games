import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextThemeChange, startAutoTheme, themeAt } from '../lib/theme';

const at = (hour: number, minute = 0, second = 0, ms = 0) => new Date(2026, 9, 31, hour, minute, second, ms);

describe('Automatischer Nachtmodus', () => {
  it.each([
    [at(0), 'dark'], [at(6, 59, 59, 999), 'dark'],
    [at(7), 'light'], [at(12), 'light'],
    [at(19, 59, 59, 999), 'light'], [at(20), 'dark'], [at(23, 59), 'dark'],
  ] as const)('verwendet für %s das Theme %s', (now, expected) => {
    expect(themeAt(now)).toBe(expected);
  });

  it('plant die nächste Grenze nach lokaler Kalenderzeit, auch über Mitternacht', () => {
    expect(nextThemeChange(at(0))).toEqual(at(7));
    expect(nextThemeChange(at(7))).toEqual(at(20));
    expect(nextThemeChange(at(20))).toEqual(new Date(2026, 10, 1, 7));
    expect(nextThemeChange(new Date(2026, 11, 31, 23))).toEqual(new Date(2027, 0, 1, 7));
    // Auch an den Tagen der Zeitumstellung bleibt 07:00 die lokale Grenze.
    for (const day of [new Date(2026, 2, 29, 0), new Date(2026, 9, 25, 0)]) {
      const next = nextThemeChange(day);
      expect(next.getHours()).toBe(7);
      expect(next.getDate()).toBe(day.getDate());
      expect(next.getTime()).toBeGreaterThan(day.getTime());
    }
  });
});

describe('Theme im laufenden App-Fenster', () => {
  let stop: (() => void) | undefined;
  let doc: EventTarget & { documentElement: { dataset: Record<string, string> }; querySelector: ReturnType<typeof vi.fn> };
  let win: EventTarget;
  let setAttribute: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    setAttribute = vi.fn();
    doc = Object.assign(new EventTarget(), {
      documentElement: { dataset: {} as Record<string, string> },
      querySelector: vi.fn(() => ({ setAttribute })),
    });
    win = new EventTarget();
    vi.stubGlobal('document', doc);
    vi.stubGlobal('window', win);
  });

  afterEach(() => {
    stop?.();
    stop = undefined;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('setzt beim Start sofort Nachtfarben und die Browserleisten-Farbe', () => {
    vi.setSystemTime(at(22));
    stop = startAutoTheme();
    expect(doc.documentElement.dataset.theme).toBe('dark');
    expect(setAttribute).toHaveBeenLastCalledWith('content', '#1d2420');
  });

  it.each([
    [at(19, 59, 59, 999), 'light', 'dark', '#1d2420'],
    [at(6, 59, 59, 999), 'dark', 'light', '#f6f0e4'],
  ])('wechselt exakt an der Grenze %s', (now, before, after, color) => {
    vi.setSystemTime(now);
    stop = startAutoTheme();
    expect(doc.documentElement.dataset.theme).toBe(before);
    vi.advanceTimersByTime(1);
    expect(doc.documentElement.dataset.theme).toBe(after);
    expect(setAttribute).toHaveBeenLastCalledWith('content', color);
  });

  it.each(['visibilitychange', 'focus', 'pageshow'])('holt nach Standby bei %s sofort die Zeit nach', (event) => {
    vi.setSystemTime(at(19));
    stop = startAutoTheme();
    vi.setSystemTime(at(21));
    (event === 'visibilitychange' ? doc : win).dispatchEvent(new Event(event));
    expect(doc.documentElement.dataset.theme).toBe('dark');
    expect(vi.getTimerCount()).toBe(1);
  });

  it('bemerkt eine veränderte Gerätezeit spätestens nach einer Minute', () => {
    vi.setSystemTime(at(12));
    stop = startAutoTheme();
    vi.setSystemTime(at(22));
    vi.advanceTimersByTime(60_000);
    expect(doc.documentElement.dataset.theme).toBe('dark');
  });

  it('läuft auch ohne theme-color-Meta-Tag und räumt Timer und Listener auf', () => {
    doc.querySelector.mockReturnValue(null);
    vi.setSystemTime(at(12));
    stop = startAutoTheme();
    stop();
    expect(vi.getTimerCount()).toBe(0);
    vi.setSystemTime(at(22));
    doc.dispatchEvent(new Event('visibilitychange'));
    win.dispatchEvent(new Event('focus'));
    win.dispatchEvent(new Event('pageshow'));
    expect(doc.documentElement.dataset.theme).toBe('light');
    expect(vi.getTimerCount()).toBe(0);
  });
});
