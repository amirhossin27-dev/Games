import { useEffect, useRef, useState } from 'react';
import { CHAT_MAX, chatProblem, chatText, freeChat, QUICK_SENTENCES } from '../lib/chat';
import { useData, type Profile } from '../lib/store';
import { cls } from '../lib/util';
import { sendChat, useRoom } from '../net/room';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/parts';

/**
 * Chat im Spielzimmer: oben die Nachrichten, darunter fertige Sätze zum Antippen (gehen sofort
 * raus) und – wenn die Eltern es erlauben – ein Feld zum Selbstschreiben mit Wortfilter.
 */

/** Ist der Chat gerade als Fenster im Spiel offen? (Dann keine Hinweise für neue Nachrichten) */
let sheets = 0;
export const chatSheetOpen = () => sheets > 0;

export function ChatPanel({ profile, compact }: { profile: Profile; compact?: boolean }) {
  const room = useRoom();
  const data = useData();
  const [text, setText] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const free = freeChat(data.settings);
  const shown = room.chat.map((m) => ({ m, t: chatText(m, room.uid, data.settings) })).filter((x) => x.t !== null);
  const lastId = shown[shown.length - 1]?.m.id;

  // Neue Nachricht → nach unten scrollen
  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId]);

  const send = async (t: string, quick?: number) => {
    setBusy(true);
    setHint(null);
    const problem = await sendChat(profile, t, quick);
    setBusy(false);
    if (problem) setHint(problem);
    else if (quick === undefined) setText('');
  };

  const typed = text.trim();
  const live = typed ? chatProblem(typed) : null;

  return (
    <section className={cls('chat', compact && 'compact')} aria-label="Chat">
      <div className="chat-log" ref={log} role="log" aria-live="polite">
        {shown.length === 0 ? (
          <p className="small muted center">Noch keine Nachrichten. Tipp unten auf einen Satz!</p>
        ) : (
          shown.map(({ m, t }) => {
            const mine = m.by === room.uid;
            return (
              <div key={m.id} className={cls('chat-msg', mine && 'mine')}>
                {!mine && <Avatar kind={m.avatar} size={30} bg={m.color} />}
                <div className="chat-bubble">
                  {!mine && <b className="small">{m.name}</b>}
                  <span>{t}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="chat-quick" role="group" aria-label="Fertige Sätze">
        {QUICK_SENTENCES.map((q, i) => (
          <button key={q} type="button" className="chat-chip" disabled={busy} onClick={() => void send(q, i)}>
            {q}
          </button>
        ))}
      </div>
      {free ? (
        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault();
            if (typed && !live) void send(typed);
          }}
        >
          <input
            className="input"
            value={text}
            maxLength={CHAT_MAX}
            placeholder="Selbst schreiben …"
            aria-label="Nachricht schreiben"
            enterKeyHint="send"
            autoComplete="off"
            onChange={(e) => {
              setText(e.target.value);
              setHint(null);
            }}
          />
          <button type="submit" className="icon-btn send" aria-label="Senden" disabled={busy || !typed || !!live}>
            <Icon name="send" />
          </button>
        </form>
      ) : (
        <p className="small muted">Deine Eltern haben eingestellt: Hier gibt es nur fertige Sätze.</p>
      )}
      {(hint ?? live) && <p className="error small">{hint ?? live}</p>}
    </section>
  );
}

/** Chat während der Runde (aus dem Spiel heraus) */
export function ChatSheet({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  useEffect(() => {
    sheets++;
    return () => {
      sheets--;
    };
  }, []);
  return (
    <Sheet title="Chat" onClose={onClose}>
      <ChatPanel profile={profile} compact />
    </Sheet>
  );
}
