import { usePlaytime } from '../lib/playtime';
import { cls } from '../lib/util';
import { Icon } from './Icon';

/** Restliche Spielzeit – nur sichtbar, wenn Eltern ein Limit eingestellt haben. */
export function TimePill({ className }: { className?: string }) {
  const { status } = usePlaytime();
  if (status.remainingSec === null || status.locked) return null;
  const sec = Math.ceil(status.remainingSec);
  const text = sec >= 120 ? `noch ${Math.ceil(sec / 60)} Min` : `noch ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  return (
    <span className={cls('pill', sec <= 60 ? 'alarm' : sec <= 300 && 'warn', className)} role="timer" aria-label={`Spielzeit: ${text}`}>
      <Icon name="hourglass" size={18} />
      {text}
    </span>
  );
}
