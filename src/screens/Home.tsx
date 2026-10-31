import { useState, type CSSProperties } from 'react';
import { CATEGORY, CATEGORY_ORDER, GAMES, playersText, type Category, type GameMeta } from '../games/registry';
import { nav } from '../lib/nav';
import { useRoom } from '../net/room';
import { levelOf } from '../lib/progress';
import { startSpruch } from '../lib/sprueche';
import { useData, type Profile } from '../lib/store';
import { arcadeAfter, learnedToday, learnLeft, learnText } from '../lib/unlock';
import { cls } from '../lib/util';
import { Avatar } from '../ui/Avatar';
import { GameArt } from '../ui/GameArt';
import { Icon, type IconName } from '../ui/Icon';
import { Joy } from '../ui/Joy';
import { SpeakButton, Stars } from '../ui/parts';
import { TimePill } from '../ui/TimePill';

export function TabBar({ active }: { active: 'home' | 'rooms' | 'me' }) {
  const tabs: { id: 'home' | 'rooms' | 'me'; label: string; icon: IconName }[] = [
    { id: 'home', label: 'Spielen', icon: 'pad' },
    { id: 'rooms', label: 'Zimmer', icon: 'users' },
    { id: 'me', label: 'Ich', icon: 'user' },
  ];
  return (
    <nav className="tabbar" aria-label="Hauptmenü">
      <div className="tabbar-inner">
        {tabs.map((t) => (
          <button key={t.id} type="button" className="tab" aria-current={active === t.id ? 'page' : undefined} onClick={() => nav.go({ name: t.id })}>
            <span className="tab-icon">
              <Icon name={t.icon} size={24} />
            </span>
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

export function GameCard({ game, profile, left = 0 }: { game: GameMeta; profile: Profile; left?: number }) {
  const cat = CATEGORY[game.category];
  const stars = profile.games[game.id]?.stars ?? 0;
  return (
    <button type="button" className={cls('game-card', left > 0 && 'locked')} onClick={() => nav.go({ name: 'game', id: game.id })}>
      <span className="game-card-art">
        <GameArt kind={game.art} height={90} />
        {left > 0 && (
          <span className="lock-badge" aria-hidden="true">
            <Icon name="lock" size={22} />
          </span>
        )}
      </span>
      <b>{game.name}</b>
      <span className="meta">
        <span className="tag" style={{ '--tag-bg': cat.bg, '--tag-fg': cat.fg } as CSSProperties}>
          {cat.label}
        </span>
        <span className="row" style={{ gap: 3 }}>
          <Icon name="user" size={14} stroke={2.6} />
          {playersText(game)}
        </span>
      </span>
      {left > 0 ? (
        <span className="lock-note">
          <Icon name="lock" size={14} stroke={2.6} />
          Frei nach {left} {left === 1 ? 'Lernspiel' : 'Lernspielen'}
        </span>
      ) : (
        <Stars n={stars} size={16} />
      )}
    </button>
  );
}

type Tab = 'alle' | 'zusammen' | Category;

export function Home({ profile, tab: initial }: { profile: Profile; tab?: string }) {
  const [tab, setTab] = useState<Tab>((initial as Tab) ?? 'alle');
  const room = useRoom();
  const { settings } = useData();
  const lvl = levelOf(profile.stars);
  const spruch = startSpruch();
  const games = GAMES.filter((g) => (tab === 'alle' ? true : tab === 'zusammen' ? g.players[1] > 1 : g.category === tab));
  // Altersgerechte Spiele zuerst
  const age = [4, 6, 8, 10][profile.age];
  // Gesperrte Arcade-Spiele ans Ende
  const left = (g: GameMeta) => learnLeft(g, profile, settings);
  const sorted = [...games].sort((a, b) => Number(left(a) > 0) - Number(left(b) > 0) || Number(a.minAge > age + 1) - Number(b.minAge > age + 1));
  const need = arcadeAfter(settings);
  const learned = Math.min(need, learnedToday(profile));
  const tabs: { id: Tab; label: string }[] = [
    { id: 'alle', label: 'Alle' },
    { id: 'zusammen', label: 'Zusammen' },
    ...CATEGORY_ORDER.map((c) => ({ id: c as Tab, label: CATEGORY[c].label })),
  ];

  return (
    <section className="screen">
      <header className="col" style={{ gap: 14 }}>
        <div className="hello">
          <span className="polaroid">
            <Avatar kind={profile.avatar} size={58} bg={profile.color} />
          </span>
          <div className="grow">
            <span className="muted">Hallo,</span>
            <h1>{profile.name}!</h1>
            <svg className="squiggle" width="150" height="12" viewBox="0 0 150 12" aria-hidden="true">
              <path d="M3 8 C 26 3, 48 11, 74 6 S 122 3, 147 7" fill="none" stroke="#D9774F" strokeWidth="3.5" strokeLinecap="round" />
            </svg>
          </div>
          <div className="star-badge" aria-label={`${profile.stars} Sterne`}>
            <b>{profile.stars}</b>
            <span>Sterne</span>
          </div>
        </div>
        <div className="row">
          <span className="label">Level {lvl.level}</span>
          <div className="bar grow" aria-hidden="true">
            <i style={{ width: `${lvl.progress * 100}%` }} />
          </div>
          <span className="small muted">noch {lvl.toNext}</span>
        </div>
        <TimePill />
      </header>

      {room.code && room.profileId === profile.id && (
        <button type="button" className="room-banner" onClick={() => nav.go({ name: 'rooms' })}>
          <Icon name="users" size={26} />
          <span className="grow">Du bist in einem Spielzimmer – zurück zu den anderen</span>
          <Icon name="arrow" />
        </button>
      )}

      <section className="card tape" aria-label="Zusammen spielen">
        <div className="col" style={{ gap: 12 }}>
          <div className="row between">
            <div>
              <h2>Zusammen spielen</h2>
              <p style={{ color: '#3B4A3F' }}>Bis zu 4 Kinder – an einem Gerät oder online, jedes am eigenen.</p>
            </div>
          </div>
          <div className="row" style={{ gap: 12 }}>
            <button type="button" className="btn primary grow" onClick={() => setTab('zusammen')}>
              Spiele für mehrere
            </button>
            <button type="button" className="btn secondary" onClick={() => nav.go({ name: 'rooms' })}>
              Online
            </button>
          </div>
        </div>
      </section>

      <section className="sticky spruch" aria-label="Joys Spruch für dich">
        <Joy size={54} mood="cheer" />
        <div className="grow col" style={{ gap: 2 }}>
          <span className="label">Joy sagt:</span>
          <p className="display">{spruch}</p>
        </div>
        <SpeakButton text={spruch} />
      </section>

      {learned < need && (
        <section className="card stitched row" aria-label="Erst lernen, dann spielen">
          <Icon name="lock" size={28} />
          <div className="grow col" style={{ gap: 6 }}>
            <b className="display">Erst lernen, dann spielen!</b>
            <span className="small">Spiele heute {learnText(need - learned)}, dann sind die Arcade-Spiele frei.</span>
            <div className="dots" aria-label={`${learned} von ${need} Lernspielen`}>
              {Array.from({ length: Math.min(need, 10) }, (_, i) => (
                <span key={i} className={i < learned ? 'on' : ''} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section aria-label="Spiele">
        <div className="folder-tabs" role="toolbar" aria-label="Spiele filtern">
          {tabs.map((t) => (
            <button key={t.id} type="button" className="folder-tab" aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="games-panel">
          {sorted.map((g) => (
            <GameCard key={g.id} game={g} profile={profile} left={left(g)} />
          ))}
        </div>
      </section>
    </section>
  );
}
