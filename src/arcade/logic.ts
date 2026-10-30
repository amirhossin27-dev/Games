/** Zwei Seiten für die Duell-Spiele an einem Gerät: unten p1, oben p2. */
export type Side = 'p1' | 'p2';

export const otherSide = (s: Side): Side => (s === 'p1' ? 'p2' : 'p1');
