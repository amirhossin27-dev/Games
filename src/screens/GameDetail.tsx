import { useEffect, useState, type CSSProperties } from 'react';
import type { SeatInfo } from '../engine/game';
import { isOnlineGame } from '../games/defs';
import { CATEGORY, GAME_BY_ID, playersText, type GameId, type GameMeta } from '../games/registry';
import { ANIMALS } from '../lib/names';
import { nav } from '../lib/nav';
import { speakIfAuto } from '../lib/speech';
import { LEVEL_LABEL, levelForAge, useData, type Level, type Profile } from '../lib/store';
import { arcadeAfter, learnedToday, learnLeft, learnText } from '../lib/unlock';
import { pick } from '../lib/util';
import { onlineAllowed } from '../net/consent';
import { Avatar } from '../ui/Avatar';
import { GameArt } from '../ui/GameArt';
import { Icon, type IconName } from '../ui/Icon';
import { Joy } from '../ui/Joy';
import { Sheet, Stars } from '../ui/parts';
import { TimePill } from '../ui/TimePill';

const ROBO_NAMES = ['Robo', 'Robbi', 'Roboto'];
const LEVEL_SUB: Record<string, [string, string, string]> = {
  rechnen: ['bis 10', 'bis 20', 'bis 100 · mal, geteilt'],
  buchstaben: ['Anlaut', 'Bilder', 'Lücken'],
  uhr: ['volle Std.', 'halb, Viertel', 'Minuten, Dauer'],
  welt: ['Bilder', 'Tiere, Natur', 'Länder, All'],
  woerter: ['Buchstaben', 'Silben', 'Mehrzahl, Schreiben'],
  englisch: ['Bild → Wort', 'Wort → Bild', 'Sätze, Grammatik'],
  zahlenspur: ['0 bis 9', 'bis 20', 'ohne Vorlage'],
  schwung: ['Bögen', 'Zickzack', 'Schlaufen'],
  paare: ['12 Karten', '16 Karten', '24 Karten'],
  vier: ['Robo übt', 'Robo denkt mit', 'Robo-Profi'],
  ttt: ['Robo übt', 'Robo denkt mit', 'Robo-Profi'],
  ludo: ['Robo übt', 'Robo denkt mit', 'Robo-Profi'],
  maumau: ['Robo übt', 'Robo denkt mit', 'Robo-Profi'],
  wuerfel: ['kurzer Block', 'ganzer Block', 'ganzer Block'],
  schiffe: ['8 × 8', '10 × 10', 'kleine Schiffe'],
  slf: ['3 Spalten', '4 Spalten', '6 Spalten, J, U'],
};

export const seatOf = (p: Profile): SeatInfo => ({ name: p.name, avatar: p.avatar, color: p.color, robo: false, profileId: p.id });
export const roboSeat = (k: number): SeatInfo => ({ name: ROBO_NAMES[k % 3], avatar: 'robo', color: '#E6E6DF', robo: true });

function guestSeat(taken: SeatInfo[]): SeatInfo {
  const free = ANIMALS.filter((a) => !taken.some((t) => t.avatar === a.kind));
  const a = pick(free.length ? free : ANIMALS);
  return { name: `Gast ${a.name}`, avatar: a.kind, color: '#F7EDC8', robo: false };
}

function ModeTile({ icon, title, sub, onClick, main, disabled }: { icon: IconName; title: string; sub: string; onClick?: () => void; main?: boolean; disabled?: boolean }) {
  return (
    <button type="button" className={main ? 'mode-tile main' : 'mode-tile'} onClick={onClick} disabled={disabled}>
      <span className="ico">
        <Icon name={icon} />
      </span>
      <span>
        <b>{title}</b>
        <br />
        <span className="sub">{sub}</span>
      </span>
    </button>
  );
}

/** Mitspieler zusammenstellen: Kinder auf diesem Gerät, Gäste und Robo. */
function SetupSheet({ meta, me, profiles, onStart, onClose, robosOnly }: { meta: GameMeta; me: Profile; profiles: Profile[]; onStart: (seats: SeatInfo[]) => void; onClose: () => void; robosOnly?: boolean }) {
  const [max, min] = [meta.players[1], meta.players[0]];
  const [seats, setSeats] = useState<SeatInfo[]>(() => (robosOnly ? [seatOf(me), roboSeat(0)] : [seatOf(me)]));
  const others = profiles.filter((p) => p.id !== me.id);
  const full = seats.length >= max;
  const robos = seats.filter((s) => s.robo).length;
  const humans = seats.length - robos;
  const toggleProfile = (p: Profile) =>
    setSeats((list) => (list.some((s) => s.profileId === p.id) ? list.filter((s) => s.profileId !== p.id) : full ? list : [...list, seatOf(p)]));
  const remove = (i: number) => setSeats((list) => list.filter((_, k) => k !== i));
  const ok = seats.length >= Math.max(2, min) && seats.length <= max;

  return (
    <Sheet title={robosOnly ? 'Gegen Robo' : 'Wer spielt mit?'} onClose={onClose}>
      <p className="muted">
        {meta.name}: {playersText(meta)} Spieler. {!robosOnly && 'Tippe auf Kinder, Gäste oder Robo.'}
      </p>
      <div className="seat-list">
        {seats.map((s, i) => (
          <div key={i} className="seat-row">
            <Avatar kind={s.avatar} size={40} bg={s.color} />
            <span className="grow display">{s.name}</span>
            <span className="small muted">{i === 0 ? 'Du' : s.robo ? 'Computer' : s.profileId ? 'Kind' : 'Gast'}</span>
            {i > 0 && (
              <button type="button" className="icon-btn soft" aria-label={`${s.name} entfernen`} onClick={() => remove(i)}>
                <Icon name="close" size={18} />
              </button>
            )}
          </div>
        ))}
        {!full && (
          <div className="seat-row empty">
            <span className="small muted">Freier Platz {seats.length + 1}</span>
          </div>
        )}
      </div>
      {!full && (
        <div className="col">
          <span className="field-label">Dazuholen</span>
          <div className="pick-grid">
            {!robosOnly &&
              others.map((p) => (
                <button key={p.id} type="button" className="pick-btn" aria-pressed={seats.some((s) => s.profileId === p.id)} onClick={() => toggleProfile(p)}>
                  <Avatar kind={p.avatar} size={40} bg={p.color} />
                  {p.name}
                </button>
              ))}
            {!robosOnly && (
              <button type="button" className="pick-btn" onClick={() => setSeats((list) => [...list, guestSeat(list)])}>
                <span className="avatar" style={{ width: 40, height: 40, display: 'grid', placeItems: 'center', background: '#F7EDC8' }}>
                  <Icon name="plus" />
                </span>
                Gast
              </button>
            )}
            {meta.robo && (
              <button type="button" className="pick-btn" onClick={() => setSeats((list) => [...list, roboSeat(list.filter((s) => s.robo).length)])}>
                <Avatar kind="robo" size={40} bg="#E6E6DF" />
                Robo
              </button>
            )}
          </div>
        </div>
      )}
      <button type="button" className="btn primary big block" disabled={!ok} onClick={() => onStart(seats)}>
        {ok ? `Los geht's – ${humans === 1 ? 'du' : `${humans} Kinder`}${robos ? ` + ${robos} Robo` : ''}` : `Noch ${Math.max(2, min) - seats.length} Mitspieler`}
      </button>
    </Sheet>
  );
}

export function GameDetail({ id, profile }: { id: GameId; profile: Profile }) {
  const meta = GAME_BY_ID[id];
  const data = useData();
  const cat = CATEGORY[meta.category];
  const [level, setLevel] = useState<Level>(levelForAge(profile.age));
  const [setup, setSetup] = useState<null | 'together' | 'robo'>(null);
  const [circuit, setCircuit] = useState<Level>(0);
  const stat = profile.games[id];
  const sub = LEVEL_SUB[id];
  // Erst lernen, dann spielen
  const left = learnLeft(meta, profile, data.settings);
  const lockText = `${meta.name} ist frei, sobald du heute ${learnText(left)} gespielt hast.`;
  useEffect(() => {
    if (left > 0) speakIfAuto(`Erst lernen, dann spielen! ${lockText}`);
  }, []);

  const start = (seats: SeatInfo[]) => {
    setSetup(null);
    // Das Tutorial kommt nur, wenn man es selbst über „So geht's“ oder das ? öffnet.
    nav.play({ game: id, seats, level: id === 'joykart' ? circuit : level });
  };

  const [min, max] = meta.players;
  const canSolo = min === 1;
  const canRobo = meta.robo && max >= 2;
  const canTogether = max >= 2;

  return (
    <section className="screen">
      <div className="detail-hero">
        <GameArt kind={meta.art} height={190} />
        <button type="button" className="icon-btn" style={{ left: 12 }} aria-label="Zurück" onClick={() => nav.back()}>
          <Icon name="back" />
        </button>
        <button type="button" className="icon-btn" style={{ right: 12 }} aria-label="Spielregeln ansehen" onClick={() => nav.tutorial(id)}>
          <Icon name="help" />
        </button>
      </div>
      <div className="col">
        <div className="row between">
          <h1>{meta.name}</h1>
          <TimePill />
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <span className="tag" style={{ '--tag-bg': cat.bg, '--tag-fg': cat.fg } as CSSProperties}>
            {cat.label}
          </span>
          <span className="tag">ab {meta.minAge} Jahren</span>
          <span className="tag">{playersText(meta)} Spieler</span>
          <span className="tag">{meta.minutes}</span>
          {stat && <Stars n={stat.stars} size={18} />}
        </div>
        <p>{meta.tagline}</p>
        <p className="muted small">
          <b>Das übst du:</b> {meta.learn}
        </p>
      </div>

      <button type="button" className="card stitched row" style={{ textAlign: 'left' }} onClick={() => nav.tutorial(id)}>
        <Joy size={46} mood="talk" />
        <span className="grow">
          <b className="display">So geht's</b>
          <br />
          <span className="small muted">Joy erklärt das Spiel in {meta.tutorial.length} Schritten</span>
        </span>
        <span className="icon-btn" style={{ background: 'var(--butter)', color: 'var(--on-butter)' }} aria-hidden="true">
          <Icon name="play" />
        </span>
      </button>

      {id === 'joykart' && <div className="field"><span className="field-label">Startstrecke gegen Robo</span><div className="seg">
        {(['Sonnenbucht','Kap der Winde'] as const).map((name,i)=><button key={name} aria-pressed={circuit===i} onClick={()=>setCircuit(i as Level)}>{name}</button>)}
      </div></div>}
      {meta.levels && (
        <div className="field">
          <span className="field-label">Schwierigkeit</span>
          <div className="seg">
            {([0, 1, 2] as Level[]).map((l) => (
              <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)}>
                {LEVEL_LABEL[l]}
                {sub && <small>{sub[l]}</small>}
              </button>
            ))}
          </div>
        </div>
      )}

      {left > 0 ? (
        <div className="card stitched col" style={{ alignItems: 'center', textAlign: 'center' }} role="status">
          <Joy size={70} mood="talk" />
          <h2>Erst lernen, dann spielen!</h2>
          <p>{lockText}</p>
          <div className="dots" style={{ justifyContent: 'center' }} aria-label={`${learnedToday(profile)} von ${arcadeAfter(data.settings)} Lernspielen`}>
            {Array.from({ length: Math.min(arcadeAfter(data.settings), 10) }, (_, i) => (
              <span key={i} className={i < learnedToday(profile) ? 'on' : ''} />
            ))}
          </div>
          <button type="button" className="btn primary block" onClick={() => nav.go({ name: 'home' })}>
            Zu den Lernspielen
          </button>
        </div>
      ) : (
        <div className="field">
          <span className="field-label">Wie willst du spielen?</span>
          <div className="mode-grid">
            {canSolo && (
              <ModeTile icon="user" title="Allein" sub={stat?.best !== undefined ? `Rekord: ${stat.best} ${meta.scoreLabel ?? ''}` : 'Übe in Ruhe'} main={!canRobo} onClick={() => start([seatOf(profile)])} />
            )}
            {canRobo && (
              <ModeTile
                icon="robot"
                title="Gegen Robo"
                sub={id === 'joykart' ? 'Fahre gegen den Panda' : max > 2 ? 'Robo spielt mit – bis zu 3' : 'Robo passt sich an'}
                main
                onClick={() => (max > 2 ? setSetup('robo') : start([seatOf(profile), roboSeat(0)]))}
              />
            )}
            {canTogether && id !== 'joykart' && <ModeTile icon="device" title="Zusammen" sub={`${Math.max(2, min)}–${max} Kinder an einem Gerät`} onClick={() => setSetup('together')} />}
            {canTogether && (
              <ModeTile
                icon="globe"
                title="Online"
                sub={!isOnlineGame(id) ? 'Für dieses Spiel noch nicht' : onlineAllowed(data.settings) ? 'Jedes Kind am eigenen Gerät' : 'Erst die Eltern fragen'}
                disabled={!isOnlineGame(id)}
                onClick={() => nav.go({ name: 'rooms', preset: id })}
              />
            )}
          </div>
        </div>
      )}

      {setup && <SetupSheet meta={meta} me={profile} profiles={data.profiles} robosOnly={setup === 'robo'} onStart={start} onClose={() => setSetup(null)} />}
    </section>
  );
}
