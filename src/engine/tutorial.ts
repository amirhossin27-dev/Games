import type { Task } from '../learn/tasks';
import type { ArtKind } from '../ui/GameArt';

/**
 * Ein Tutorial besteht aus 3–5 kurzen Schritten. Jeder Schritt hat einen Satz, den Joy sagt
 * (und vorliest), und ein Bild dazu. Der letzte Schritt kann ein Probezug sein.
 */

export type Gesture = 'tap' | 'left' | 'right' | 'up' | 'down' | 'hold' | 'drag';

export type TutArt =
  | { k: 'art'; art: ArtKind }
  | { k: 'gesture'; g: Gesture; label?: string }
  | { k: 'pics'; items: string[]; caption?: string }
  | { k: 'grid'; cols: number; cells: (string | null)[]; point?: number; mark?: number[] }
  | { k: 'cards'; cards: { t: string; red?: boolean; dim?: boolean }[]; point?: number }
  | { k: 'dice'; values: number[]; held?: boolean[] }
  | { k: 'clock'; h: number; m: number; label?: string }
  | { k: 'quiz'; task: Task; point?: number; tryIt?: boolean };

export interface TutorialStep {
  say: string;
  art: TutArt;
}
