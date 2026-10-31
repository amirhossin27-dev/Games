import { useSyncExternalStore } from 'react';
import type { SeatInfo } from '../engine/game';
import type { GameId } from '../games/registry';
import type { Level } from './store';

/** Einfache Navigation ohne Router: ein Bildschirm + optional ein laufendes Spiel oder Tutorial. */

export type Route =
  | { name: 'home'; tab?: string }
  | { name: 'rooms'; join?: string; preset?: GameId }
  | { name: 'me' }
  | { name: 'game'; id: GameId }
  | { name: 'parents' }
  | { name: 'welcome'; edit?: string }
  | { name: 'who' };

export interface Session {
  game: GameId;
  seats: SeatInfo[];
  level: Level;
  /** Zählt bei „Nochmal“ hoch */
  round: number;
}

interface NavState {
  route: Route;
  back: Route[];
  session: Session | null;
  /** Nur auf Wunsch geöffnet (So geht's / ?), nie von selbst beim Spielstart */
  tutorial: { game: GameId } | null;
}

let state: NavState = { route: { name: 'home' }, back: [], session: null, tutorial: null };
const listeners = new Set<() => void>();

function set(next: Partial<NavState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export const getNav = () => state;

export function useNav(): NavState {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    getNav,
    getNav,
  );
}

const TABS = new Set(['home', 'rooms', 'me']);

export const nav = {
  go(route: Route) {
    // Zwischen den Reitern gibt es keinen Zurück-Stapel.
    const back = TABS.has(route.name) ? [] : [...state.back, state.route];
    set({ route, back });
    window.scrollTo(0, 0);
  },
  back() {
    const back = state.back.slice();
    const route = back.pop() ?? { name: 'home' };
    set({ route, back });
  },
  play(s: Omit<Session, 'round'>) {
    set({ session: { ...s, round: 0 }, tutorial: null });
  },
  again() {
    if (state.session) set({ session: { ...state.session, round: state.session.round + 1 } });
  },
  closeGame() {
    set({ session: null });
  },
  tutorial(game: GameId) {
    set({ tutorial: { game } });
  },
  closeTutorial() {
    set({ tutorial: null });
  },
};
