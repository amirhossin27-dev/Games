import { useState } from 'react';
import { ADJECTIVES, ANIMALS, COLORS, generatedName, isGeneratedName, nameProblem, type AvatarKind } from '../lib/names';
import { nav } from '../lib/nav';
import { speak } from '../lib/speech';
import { actions, AGE_LABEL, useData, type AgeGroup } from '../lib/store';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import { JoySays } from '../ui/parts';

/** Neues Kind anlegen oder Profil ändern: Spielername, Tier, Lieblingsfarbe, Alter. */
export function Welcome({ edit }: { edit?: string }) {
  const data = useData();
  const existing = edit ? data.profiles.find((p) => p.id === edit) : undefined;
  const [avatar, setAvatar] = useState<AvatarKind>(existing?.avatar ?? 'fuchs');
  const [adj, setAdj] = useState(0);
  const [custom, setCustom] = useState<string | null>(existing ? existing.name : null);
  const [color, setColor] = useState(existing?.color ?? COLORS[0].hex);
  const [age, setAge] = useState<AgeGroup>(existing?.age ?? 1);
  const [error, setError] = useState<string | null>(null);
  const onlyGenerated = data.settings.onlyGeneratedNames;
  const name = custom ?? generatedName(ADJECTIVES[adj], avatar);
  const first = data.profiles.length === 0;

  const roll = () => {
    setCustom(null);
    setAdj((a) => (a + 1 + Math.floor(Math.random() * (ADJECTIVES.length - 1))) % ADJECTIVES.length);
    setError(null);
  };

  const save = () => {
    const problem = nameProblem(name) ?? (onlyGenerated && !isGeneratedName(name) ? 'Bitte nimm einen Namen vom Würfel.' : null);
    if (problem) {
      setError(problem);
      speak(problem);
      return;
    }
    if (existing) actions.editProfile(existing.id, { name: name.trim(), avatar, color, age });
    else actions.addProfile({ name, avatar, color, age });
    nav.go(existing ? { name: 'me' } : { name: 'home' });
  };

  return (
    <section className="screen">
      {!first && (
        <div className="topbar">
          <button type="button" className="icon-btn" aria-label="Zurück" onClick={() => nav.back()}>
            <Icon name="back" />
          </button>
          <h1>{existing ? 'Profil ändern' : 'Neues Kind'}</h1>
        </div>
      )}
      <JoySays text={existing ? 'Hier kannst du deinen Namen und dein Tier ändern.' : 'Hallo! Ich bin Joy. Wie heißt du – und welches Tier bist du?'} mood="talk" size={72} />

      <div className="field">
        <label htmlFor="spielername">Dein Spielername</label>
        <div className="name-field">
          <Avatar kind={avatar} size={46} bg={color} />
          <input
            id="spielername"
            value={name}
            maxLength={16}
            autoComplete="off"
            readOnly={onlyGenerated}
            onChange={(e) => {
              setCustom(e.target.value);
              setError(null);
            }}
          />
          <button type="button" className="icon-btn" aria-label="Neuen Namen würfeln" onClick={roll} style={{ background: 'var(--butter)', color: 'var(--on-butter)' }}>
            <Icon name="dice" size={26} />
          </button>
        </div>
        {error ? <p className="error">{error}</p> : <p className="small muted">Tipp: Nimm einen Spitznamen, nicht deinen echten Namen.</p>}
      </div>

      <div className="field">
        <span className="field-label">Such dir ein Tier aus</span>
        <div className="avatar-grid">
          {ANIMALS.map((a) => (
            <button
              key={a.kind}
              type="button"
              className="avatar-pick"
              aria-pressed={a.kind === avatar}
              aria-label={a.name}
              onClick={() => {
                setAvatar(a.kind);
                if (custom === null) setError(null);
              }}
            >
              <Avatar kind={a.kind} size={58} bg={a.kind === avatar ? color : '#EFE6D4'} label={a.name} />
              {a.kind === avatar && (
                <span className="check" aria-hidden="true">
                  <Icon name="check" size={14} stroke={3.4} />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">Deine Lieblingsfarbe</span>
        <div className="swatches">
          {COLORS.map((c) => (
            <button key={c.hex} type="button" className="swatch" style={{ background: c.hex }} aria-label={c.name} aria-pressed={c.hex === color} onClick={() => setColor(c.hex)} />
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">Wie alt bist du?</span>
        <div className="seg">
          {([0, 1, 2, 3] as AgeGroup[]).map((a) => (
            <button key={a} type="button" aria-pressed={a === age} onClick={() => setAge(a)} aria-label={`${AGE_LABEL[a]} Jahre`}>
              {AGE_LABEL[a]}
              <small>Jahre</small>
            </button>
          ))}
        </div>
      </div>

      <button type="button" className="btn primary big block" onClick={save}>
        {existing ? 'Speichern' : "Los geht's!"} <Icon name="arrow" />
      </button>
    </section>
  );
}
