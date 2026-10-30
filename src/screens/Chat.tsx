import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CHAT_MAX, chatProblem, QUICK_PHRASES } from '../lib/chat';
import { useData } from '../lib/store';
import { cls } from '../lib/util';
import { sendChat, useRoom } from '../net/room';
import { chatFeed, humanCount, type FeedItem } from '../net/roomLogic';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/parts';

/**
 * Chat im Online-Spielzimmer – nur, wenn mindestens zwei echte Kinder drin sind (nicht gegen Robo
 * oder allein). Eltern stellen ein: frei schreiben, nur fertige Sätze oder gar kein Chat.
 */

// Bis wann hat dieses Gerät die Nachrichten gesehen? Und ist der Chat gerade offen?
let seenAt = 0;
let open = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const markSeen = (at: number) => {
  if (at > seenAt) {
    seenAt = at;
    notify();
  }
};
export const chatOpen = () => open;

/** Nachrichten, die Kinder nicht sehen sollen (falls ein Gerät den Filter umgeht), werden ausgeblendet */
const visible = (m: FeedItem) => !chatProblem(m.t);

export function useChat() {
  const room = useRoom();
  const data = useData();
  useSyncExternalStore(subscribe, () => seenAt, () => seenAt);
  const { info, seats, uid } = room;
  const admitted = !!info && !!uid && (info.host === uid || info.allowed?.[uid] !== undefined);
  const enabled = data.settings.chat !== 'off' && admitted && humanCount(info!, seats) >= 2;
  const feed = enabled ? chatFeed(info!, seats).filter(visible) : [];
  const unread = feed.filter((m) => m.uid !== uid && m.at > seenAt).length;
  return { enabled, feed, unread, me: uid, mode: data.settings.chat ?? 'free' };
}

export function ChatSheet({ onClose }: { onClose: () => void }) {
  const { feed, me, mode, enabled } = useChat();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const last = useRef(0);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    open = true;
    return () => {
      open = false;
    };
  }, []);
  // Neueste Nachricht sichtbar und gelesen
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
    if (feed.length) markSeen(feed[feed.length - 1].at);
  }, [feed.length]);
  useEffect(() => {
    if (!enabled) onClose();
  }, [enabled]);

  const send = (raw: string) => {
    const problem = chatProblem(raw);
    if (problem) return setError(problem);
    if (Date.now() - last.current < 1500) return setError('Nicht so schnell – warte kurz.');
    last.current = Date.now();
    setError(null);
    setText('');
    void sendChat(raw.trim());
  };

  return (
    <Sheet title="Chat" onClose={onClose}>
      <div className="chat-list" ref={list} aria-live="polite">
        {!feed.length && <p className="small muted center">Noch keine Nachrichten. Sag Hallo!</p>}
        {feed.map((m) => (
          <div key={m.key} className={cls('chat-msg', m.uid === me && 'mine')}>
            {m.uid !== me && <Avatar kind={m.avatar} size={30} bg={m.color} />}
            <div className="chat-bubble">
              {m.uid !== me && <b>{m.name}</b>}
              <span>{m.t}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="chat-quick" aria-label="Schnell-Sätze">
        {QUICK_PHRASES.map((q) => (
          <button key={q} type="button" className="chip" onClick={() => send(q)}>
            {q}
          </button>
        ))}
      </div>
      {mode === 'free' && (
        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
        >
          <input className="input" value={text} maxLength={CHAT_MAX} onChange={(e) => setText(e.target.value)} placeholder="Schreib etwas Nettes …" aria-label="Nachricht" enterKeyHint="send" />
          <button type="submit" className="icon-btn primary-icon" aria-label="Senden" disabled={!text.trim()}>
            <Icon name="send" />
          </button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
      <p className="small muted">Bleib freundlich. Verrate nie deinen echten Namen, deine Adresse oder Telefonnummer.</p>
    </Sheet>
  );
}

/** Chat-Knopf mit Zähler für ungelesene Nachrichten */
export function ChatButton({ className }: { className?: string }) {
  const { enabled, unread } = useChat();
  const [show, setShow] = useState(false);
  if (!enabled) return null;
  return (
    <>
      <button type="button" className={cls('icon-btn chat-btn', className)} aria-label={unread ? `Chat, ${unread} neu` : 'Chat'} onClick={() => setShow(true)}>
        <Icon name="chat" />
        {unread > 0 && <span className="chat-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {show && <ChatSheet onClose={() => setShow(false)} />}
    </>
  );
}

/** Im Wartezimmer: die letzten Nachrichten und ein Knopf zum Schreiben */
export function ChatCard() {
  const { enabled, feed, unread, me } = useChat();
  const [show, setShow] = useState(false);
  if (!enabled) return null;
  const recent = feed.slice(-3);
  return (
    <section className="card col" aria-label="Chat" style={{ gap: 10 }}>
      <div className="row between">
        <h2>Chat</h2>
        {unread > 0 && <span className="tag online-tag">{unread} neu</span>}
      </div>
      {recent.length ? (
        <div className="chat-list compact">
          {recent.map((m) => (
            <div key={m.key} className={cls('chat-msg', m.uid === me && 'mine')}>
              {m.uid !== me && <Avatar kind={m.avatar} size={26} bg={m.color} />}
              <div className="chat-bubble">
                {m.uid !== me && <b>{m.name}</b>}
                <span>{m.t}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="small muted">Noch keine Nachrichten.</p>
      )}
      <button type="button" className="btn secondary block" onClick={() => setShow(true)}>
        <Icon name="chat" /> Schreiben
      </button>
      {show && <ChatSheet onClose={() => setShow(false)} />}
    </section>
  );
}
