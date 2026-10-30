import { useState } from 'react';
import { nav } from '../lib/nav';
import { checkParentPassword, checkRecoveryCode, PASSWORD_MIN, setParentPassword } from '../lib/parent';
import { LIMIT_CHOICES, LOCK_MS, nowMs, playActions, usePlaytime } from '../lib/playtime';
import { actions, useData, type Settings } from '../lib/store';
import { ARCADE_AFTER_CHOICES, arcadeAfter, learnedToday } from '../lib/unlock';
import { formatClock } from '../lib/util';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import { Joy } from '../ui/Joy';
import { toast } from '../ui/parts';
import { deleteCloudProfile, makePass } from '../net/cloud';

function PasswordSetup({ onDone, title }: { onDone: () => void; title: string }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [error, setError] = useState('');
  const [code, setCode] = useState<string | null>(null);
  if (code)
    return (
      <div className="card col">
        <h2>Notfall-Code</h2>
        <p>Falls du das Passwort vergisst, kannst du es mit diesem Code zurücksetzen. Schreib ihn dir auf – er wird nur jetzt angezeigt.</p>
        <div className="code-box">{code}</div>
        <button type="button" className="btn primary block" onClick={onDone}>
          Aufgeschrieben – weiter
        </button>
      </div>
    );
  return (
    <form
      className="card col"
      onSubmit={async (e) => {
        e.preventDefault();
        if (a.length < PASSWORD_MIN) return setError(`Mindestens ${PASSWORD_MIN} Zeichen.`);
        if (a !== b) return setError('Die beiden Passwörter sind nicht gleich.');
        setCode(await setParentPassword(a));
      }}
    >
      <h2>{title}</h2>
      <p className="small muted">Mit dem Passwort schützt du die Spielzeit und die Einstellungen. Wähle eines, das dein Kind nicht kennt.</p>
      <div className="field">
        <label htmlFor="pw1">Passwort</label>
        <input id="pw1" className="input" type="password" autoComplete="new-password" value={a} onChange={(e) => setA(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="pw2">Passwort wiederholen</label>
        <input id="pw2" className="input" type="password" autoComplete="new-password" value={b} onChange={(e) => setB(e.target.value)} />
      </div>
      {error && <p className="error">{error}</p>}
      <button type="submit" className="btn primary block">
        Passwort festlegen
      </button>
    </form>
  );
}

function Login({ onOk }: { onOk: () => void }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [code, setCode] = useState('');
  const [reset, setReset] = useState(false);
  if (reset) return <PasswordSetup title="Neues Passwort" onDone={onOk} />;
  if (forgot)
    return (
      <form
        className="card col"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const ok = await checkRecoveryCode(code);
          setBusy(false);
          if (ok) setReset(true);
          else setError('Der Notfall-Code stimmt nicht.');
        }}
      >
        <h2>Passwort vergessen</h2>
        <p className="small muted">Gib den Notfall-Code ein, den du beim Festlegen des Passworts bekommen hast.</p>
        <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABCD-1234" autoCapitalize="characters" aria-label="Notfall-Code" />
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn primary block" disabled={busy}>
          Prüfen
        </button>
        <button type="button" className="btn ghost" onClick={() => setForgot(false)}>
          Zurück
        </button>
      </form>
    );
  return (
    <form
      className="card col"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const ok = await checkParentPassword(pw);
        setBusy(false);
        if (ok) onOk();
        else {
          setError('Das Passwort stimmt nicht.');
          setPw('');
        }
      }}
    >
      <h2>Eltern-Passwort</h2>
      <input className="input" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} aria-label="Eltern-Passwort" autoFocus />
      {error && <p className="error">{error}</p>}
      <button type="submit" className="btn primary block" disabled={busy || !pw}>
        Öffnen
      </button>
      <button type="button" className="btn ghost" onClick={() => setForgot(true)}>
        Passwort vergessen?
      </button>
    </form>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="setting-row">
      <span className="grow">{label}</span>
      <button type="button" className="switch" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />
    </div>
  );
}

function ParentPanel({ onClose }: { onClose: () => void }) {
  const data = useData();
  const { play, status } = usePlaytime();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [newPw, setNewPw] = useState(false);
  const usedMin = Math.floor(status.usedSec / 60);
  const [pass, setPass] = useState<{ name: string; url: string } | null>(null);
  const showPass = async (id: string, name: string) => {
    try {
      setPass({ name, url: await makePass(id) });
    } catch {
      toast('Dafür braucht Joyboy kurz Internet.');
    }
  };
  const set = (s: Partial<Settings>) => actions.settings(s);

  if (newPw) return <PasswordSetup title="Passwort ändern" onDone={() => setNewPw(false)} />;

  return (
    <div className="col" style={{ gap: 18 }}>
      <section className="card col" aria-label="Spielzeit">
        <div className="row">
          <Icon name="hourglass" size={26} />
          <h2 className="grow">Spielzeit</h2>
        </div>
        <p className="small">
          Ist die eingestellte Zeit aufgebraucht, macht Joyboy <b>12 Stunden Pause</b>. Oben in der App läuft die Restzeit mit.
        </p>
        <div className="limit-grid" role="group" aria-label="Spielzeit-Limit">
          <button type="button" aria-pressed={play.limitMin === null} onClick={() => playActions.setLimit(null)}>
            Aus
          </button>
          {LIMIT_CHOICES.map((m) => (
            <button key={m} type="button" aria-pressed={play.limitMin === m} onClick={() => playActions.setLimit(m)}>
              {m}
              <small>Min</small>
            </button>
          ))}
        </div>
        <div className="card stitched col" style={{ gap: 6, padding: 12 }}>
          {status.locked ? (
            <p>
              <b>Gesperrt</b> – wieder frei in {formatClock(((status.unlockAt ?? 0) - nowMs()) / 1000)} (um{' '}
              {new Date((status.unlockAt ?? 0) - (nowMs() - Date.now())).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr).
            </p>
          ) : (
            <p>
              Gespielt: <b>{usedMin} Min</b>
              {status.remainingSec !== null && (
                <>
                  {' '}
                  · übrig: <b>{Math.ceil(status.remainingSec / 60)} Min</b>
                </>
              )}
            </p>
          )}
          <p className="small muted">Das Kontingent gilt für 12 Stunden ab dem ersten Spielen.</p>
        </div>
        <div className="row wrap">
          <button type="button" className="btn small butter" onClick={() => playActions.bonus(15)}>
            <Icon name="gift" size={18} /> +15 Minuten schenken
          </button>
          <button type="button" className="btn small secondary" onClick={() => playActions.unlock()}>
            {status.locked ? 'Sperre aufheben' : 'Zeit zurücksetzen'}
          </button>
        </div>
        <p className="small muted">Tipp: Lass Datum und Uhrzeit am Gerät automatisch einstellen. Joyboy gleicht die Zeit zusätzlich über das Internet ab.</p>
      </section>

      <section className="card col" aria-label="Erst lernen, dann spielen">
        <div className="row">
          <Icon name="lock" size={26} />
          <h2 className="grow">Erst lernen, dann spielen</h2>
        </div>
        <p className="small">
          Die Arcade-Spiele (Schlange, 2048, Pong-Duell und Co.) sind jeden Tag erst frei, wenn das Kind <b>so viele Lern- und Brettspiele</b> zu Ende gespielt hat. Um Mitternacht beginnt die Zählung neu.
        </p>
        <div className="limit-grid" role="group" aria-label="Lernspiele bis zu den Arcade-Spielen">
          <button type="button" aria-pressed={arcadeAfter(data.settings) === 0} onClick={() => set({ arcadeAfter: 0 })}>
            Aus
          </button>
          {ARCADE_AFTER_CHOICES.map((n) => (
            <button key={n} type="button" aria-pressed={arcadeAfter(data.settings) === n} onClick={() => set({ arcadeAfter: n })}>
              {n}
              <small>{n === 1 ? 'Lernspiel' : 'Lernspiele'}</small>
            </button>
          ))}
        </div>
        {arcadeAfter(data.settings) > 0 && data.profiles.length > 0 && (
          <div className="card stitched col" style={{ gap: 6, padding: 12 }}>
            {data.profiles.map((p) => {
              const done = learnedToday(p);
              const need = arcadeAfter(data.settings);
              return (
                <div key={p.id} className="row">
                  <Avatar kind={p.avatar} size={30} bg={p.color} />
                  <span className="grow">{p.name}</span>
                  <span className="small">{done >= need ? <b>frei</b> : `heute ${done} von ${need}`}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="card col" aria-label="Einstellungen">
        <h2>Einstellungen</h2>
        <div className="field">
          <span className="field-label">Vorlesen</span>
          <div className="seg">
            {(
              [
                ['auto', 'Automatisch', 'bis 7 Jahre'],
                ['on', 'Immer', ''],
                ['off', 'Aus', ''],
              ] as const
            ).map(([v, l, sub]) => (
              <button key={v} type="button" aria-pressed={data.settings.speech === v} onClick={() => set({ speech: v })}>
                {l}
                {sub && <small>{sub}</small>}
              </button>
            ))}
          </div>
        </div>
        <Switch label="Töne" on={data.settings.sound} onChange={(v) => set({ sound: v })} />
        <Switch label="Nur Namen vom Namens-Würfel erlauben" on={data.settings.onlyGeneratedNames} onChange={(v) => set({ onlyGeneratedNames: v })} />
      </section>

      <section className="card col" aria-label="Kinder auf diesem Gerät">
        <h2>Kinder auf diesem Gerät</h2>
        {data.profiles.map((p) => (
          <div key={p.id} className="setting-row">
            <Avatar kind={p.avatar} size={40} bg={p.color} />
            <span className="grow display">{p.name}</span>
            {confirm === p.id ? (
              <button
                type="button"
                className="btn small warm"
                onClick={() => {
                  void deleteCloudProfile(p.id);
                  actions.removeProfile(p.id);
                  setConfirm(null);
                }}
              >
                Wirklich löschen
              </button>
            ) : (
              <>
                <button type="button" className="icon-btn soft" aria-label={`Spielerpass für ${p.name}`} onClick={() => void showPass(p.id, p.name)}>
                  <Icon name="key" size={20} />
                </button>
                <button type="button" className="icon-btn soft" aria-label={`${p.name} löschen`} onClick={() => setConfirm(p.id)}>
                  <Icon name="trash" size={20} />
                </button>
              </>
            )}
          </div>
        ))}
        {pass && (
          <div className="card stitched col" style={{ padding: 12 }}>
            <b className="display">Spielerpass für {pass.name}</b>
            <p className="small">Öffne diesen Link auf dem neuen Gerät – dann ist der Spielstand von {pass.name} dort. Behandle ihn wie einen Schlüssel und gib ihn nicht weiter.</p>
            <div className="row wrap">
              <button
                type="button"
                className="btn small primary"
                onClick={async () => {
                  try {
                    if (navigator.share) await navigator.share({ title: `Joyboy-Spielerpass für ${pass.name}`, url: pass.url });
                    else {
                      await navigator.clipboard.writeText(pass.url);
                      toast('Link kopiert!');
                    }
                  } catch {
                    // abgebrochen
                  }
                }}
              >
                <Icon name="share" size={18} /> Teilen
              </button>
              <button type="button" className="btn small secondary" onClick={() => setPass(null)}>
                Schließen
              </button>
            </div>
          </div>
        )}
        <p className="small muted">
          Die Spielstände liegen auf diesem Gerät und – sobald Internet da ist – zusätzlich gesichert in der Cloud (nur Spitzname, Tier, Sterne und Spielstand). Mit dem Spielerpass nehmt ihr sie auf ein neues Gerät mit. Joyboy hat keine Werbung, keine Käufe und keinen Chat.
        </p>
      </section>

      <button type="button" className="btn secondary block" onClick={() => setNewPw(true)}>
        <Icon name="key" /> Passwort ändern
      </button>
      <button type="button" className="btn primary big block" onClick={onClose}>
        Fertig
      </button>
    </div>
  );
}

export function Parents() {
  const data = useData();
  const [open, setOpen] = useState(false);
  // Beim ersten Mal bleibt die Einrichtung offen, bis der Notfall-Code gezeigt wurde.
  const [firstSetup] = useState(() => !data.parent);
  const close = () => {
    setOpen(false);
    nav.back();
  };
  return (
    <section className="screen">
      <div className="topbar">
        <button type="button" className="icon-btn" aria-label="Zurück" onClick={close}>
          <Icon name="back" />
        </button>
        <h1>Für Eltern</h1>
        <Joy size={40} mood="happy" />
      </div>
      {open ? (
        <ParentPanel onClose={close} />
      ) : firstSetup || !data.parent ? (
        <PasswordSetup title="Eltern-Passwort festlegen" onDone={() => setOpen(true)} />
      ) : (
        <Login onOk={() => setOpen(true)} />
      )}
    </section>
  );
}

/** Spielpause nach Ablauf der Spielzeit */
export function LockScreen() {
  const { status } = usePlaytime();
  const data = useData();
  const left = Math.max(0, ((status.unlockAt ?? 0) - nowMs()) / 1000);
  const at = new Date(Date.now() + left * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const kids = data.profiles.slice(0, 4);
  return (
    <div className="lock-screen" role="alert">
      <span className="zzz" aria-hidden="true">
        Z z z
      </span>
      <Joy size={130} mood="sleep" />
      <h1>Spielpause!</h1>
      <p>Die Spielzeit ist für heute aufgebraucht. Joy ruht sich aus – du auch?</p>
      <p className="small">Weiter geht's in</p>
      <div className="lock-countdown" role="timer">
        {formatClock(left)}
      </div>
      <p className="small">um {at} Uhr</p>
      <div className="row" style={{ gap: 6 }}>
        {kids.map((p) => (
          <Avatar key={p.id} kind={p.avatar} size={34} bg={p.color} />
        ))}
      </div>
      <p className="small" style={{ opacity: 0.85 }}>
        Tipp: Male ein Bild, lies ein Buch oder geh nach draußen!
      </p>
      <button type="button" className="btn secondary small" onClick={() => nav.go({ name: 'parents' })}>
        <Icon name="lock" size={18} /> Für Eltern
      </button>
      <span className="sr">Sperre dauert insgesamt {LOCK_MS / 3_600_000} Stunden.</span>
    </div>
  );
}
