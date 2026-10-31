/** Nachtmodus nach der lokalen Gerätezeit: 20:00 inklusive bis 07:00 exklusive. */
export function themeAt(now: Date): 'light' | 'dark' {
  const hour = now.getHours();
  return hour >= 20 || hour < 7 ? 'dark' : 'light';
}

export function nextThemeChange(now: Date): Date {
  const next = new Date(now);
  const hour = now.getHours();
  if (hour < 7) next.setHours(7, 0, 0, 0);
  else if (hour < 20) next.setHours(20, 0, 0, 0);
  else {
    next.setDate(next.getDate() + 1);
    next.setHours(7, 0, 0, 0);
  }
  return next;
}

/** Sofort vor dem ersten Rendern anwenden; auch bei offener App und nach Standby. */
export function startAutoTheme(): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const update = () => {
    clearTimeout(timer);
    const now = new Date();
    const theme = themeAt(now);
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1d2420' : '#f6f0e4');
    // Exakte Grenze; spätestens jede Minute auch Änderungen der Gerätezeit erkennen.
    timer = setTimeout(update, Math.min(60_000, nextThemeChange(now).getTime() - now.getTime()));
  };
  update();
  document.addEventListener('visibilitychange', update);
  window.addEventListener('focus', update);
  window.addEventListener('pageshow', update);
  return () => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', update);
    window.removeEventListener('focus', update);
    window.removeEventListener('pageshow', update);
  };
}
