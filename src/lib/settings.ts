import { soundOn } from './store';

/** Töne an? (Für die Spiele-Engine, die keinen React-Zugriff braucht.) */
export const soundEnabled = () => soundOn();
