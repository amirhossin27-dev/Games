import { nav } from '../lib/nav';
import { levelOf } from '../lib/progress';
import { actions, useData } from '../lib/store';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import { JoySays } from '../ui/parts';

/** Mehrere Kinder an einem Gerät: Wer spielt jetzt? */
export function Who() {
  const data = useData();
  return (
    <section className="screen">
      <JoySays text="Wer spielt jetzt? Tippe auf dein Tier." mood="happy" size={70} />
      <div className="who-grid">
        {data.profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            className="who-card"
            onClick={() => {
              actions.setActive(p.id);
              nav.go({ name: 'home' });
            }}
          >
            <Avatar kind={p.avatar} size={84} bg={p.color} />
            <span>{p.name}</span>
            <span className="small muted">Level {levelOf(p.stars).level}</span>
          </button>
        ))}
        {data.profiles.length < 6 && (
          <button type="button" className="who-card add" onClick={() => nav.go({ name: 'welcome' })}>
            <Icon name="plus" size={36} />
            <span>Neues Kind</span>
          </button>
        )}
      </div>
    </section>
  );
}
