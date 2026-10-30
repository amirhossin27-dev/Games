import { GAME_BY_ID } from '../games/registry';
import { nowMs } from '../lib/playtime';
import type { Profile } from '../lib/store';
import { cls } from '../lib/util';
import { dismissInvite, removeFriend, useFriends, type FriendView, type Invite } from '../net/friends';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';

/** „zuletzt da vor 3 Std.“ */
function lastSeen(on: number): string {
  if (!on) return 'nicht online';
  const min = Math.round((nowMs() - on) / 60_000);
  if (min < 60) return `zuletzt da vor ${Math.max(1, min)} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `zuletzt da vor ${h} Std.`;
  const d = Math.round(h / 24);
  return d === 1 ? 'zuletzt da gestern' : `zuletzt da vor ${d} Tagen`;
}

export function friendStatus(f: FriendView): string {
  if (f.room && f.game) return `im Spielzimmer · ${GAME_BY_ID[f.game]?.name ?? 'Spiel'}`;
  if (f.online) return 'ist online';
  return lastSeen(f.on);
}

/** Freunde-Liste im Zimmer-Tab: Wer ist da? Einladen oder einfach mitspielen. */
export function FriendsCard({ profile, onInvite, onJoin }: { profile: Profile; onInvite: (f: FriendView) => void; onJoin: (f: FriendView) => void }) {
  const friends = useFriends();
  const known = Object.keys(profile.friends).length;
  const list = friends.profileId === profile.id ? friends.list : [];
  return (
    <section className="card tape sage-tape col" style={{ gap: 12 }} aria-label="Freunde">
      <div className="row between">
        <h2>Freunde</h2>
        {list.some((f) => f.online) && <span className="tag online-tag">{list.filter((f) => f.online).length} online</span>}
      </div>
      {!known ? (
        <p className="muted">Wer mit dir online spielt, wird automatisch dein Freund. Dann siehst du hier, wer da ist, und könnt mit einem Tipp zusammen spielen.</p>
      ) : !friends.loaded && !list.length ? (
        <p className="muted">Ich schaue, wer da ist …</p>
      ) : (
        <div className="seat-list">
          {list.map((f) => (
            <div key={f.uid} className={cls('seat-row friend-row', !f.online && 'off')}>
              <span className="friend-avatar">
                <Avatar kind={f.avatar} size={42} bg={f.color} />
                {f.online && <span className="online-dot" aria-hidden="true" />}
              </span>
              <span className="grow">
                <b className="display">{f.name}</b>
                <br />
                <span className="small muted">{friendStatus(f)}</span>
              </span>
              {f.room ? (
                <button type="button" className="btn small primary" onClick={() => onJoin(f)}>
                  Mitspielen
                </button>
              ) : f.online ? (
                <button type="button" className="btn small secondary" onClick={() => onInvite(f)}>
                  Einladen
                </button>
              ) : (
                <button
                  type="button"
                  className="icon-btn soft"
                  aria-label={`${f.name} aus der Freunde-Liste nehmen`}
                  onClick={() => window.confirm(`${f.name} aus deiner Freunde-Liste nehmen?`) && removeFriend(profile.id, f.uid)}
                >
                  <Icon name="close" size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Einladung eines Freundes – erscheint überall in der App. */
export function InviteBanner({ invite, onAccept }: { invite: Invite; onAccept: (inv: Invite) => void }) {
  const game = GAME_BY_ID[invite.game];
  return (
    <div className="invite-banner" role="alertdialog" aria-label="Einladung">
      <Avatar kind={invite.friend.avatar} size={48} bg={invite.friend.color} />
      <div className="grow">
        <b className="display">{invite.by} lädt dich ein!</b>
        <p className="small">{game ? `Spielt zusammen ${game.name}.` : 'Komm ins Spielzimmer.'}</p>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button type="button" className="btn small primary" onClick={() => onAccept(invite)}>
            Mitspielen
          </button>
          <button type="button" className="btn small secondary" onClick={() => dismissInvite(invite)}>
            Nein, danke
          </button>
        </div>
      </div>
    </div>
  );
}
