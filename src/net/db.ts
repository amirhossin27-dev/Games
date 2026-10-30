import { DB_URL } from './config';

/** Kleiner REST-Zugang zur Firebase Realtime Database (ohne SDK, wie in Arta). */

export const SERVER_TIME = { '.sv': 'timestamp' } as const;

export class DbError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const dbUrl = (path: string, token: string, extra = '') => `${DB_URL}/${path}.json?auth=${encodeURIComponent(token)}${extra}`;

export async function dbRequest<T = unknown>(method: 'GET' | 'PUT' | 'PATCH' | 'DELETE', path: string, token: string, body?: unknown): Promise<T> {
  const res = await fetch(dbUrl(path, token), { method, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new DbError(res.status, text || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

// ───── Live-Stream (Server-Sent Events) ─────

type Tree = Record<string, unknown>;

function setAt(obj: unknown, parts: string[], value: unknown): unknown {
  if (!parts.length) return value;
  const [head, ...rest] = parts;
  const base: Tree = obj && typeof obj === 'object' ? { ...(obj as Tree) } : {};
  const next = setAt(base[head], rest, value);
  if (next === null || next === undefined) delete base[head];
  else base[head] = next;
  return base;
}

/** Wendet ein `put`/`patch`-Ereignis des Firebase-Streams auf unsere Kopie an. */
export function applyStreamEvent(tree: unknown, type: 'put' | 'patch', path: string, data: unknown): Tree | null {
  const parts = path.split('/').filter(Boolean);
  let next: unknown = tree;
  if (type === 'put') next = setAt(tree, parts, data);
  else if (data && typeof data === 'object') {
    for (const [k, v] of Object.entries(data as Tree)) next = setAt(next, [...parts, ...k.split('/').filter(Boolean)], v);
  }
  return next && typeof next === 'object' ? (next as Tree) : null;
}

export interface StreamHandlers {
  onData(tree: Tree | null): void;
  onOpen(): void;
  /** Schlüssel abgelaufen → neu verbinden */
  onExpired(): void;
  /** Kein Zugriff (z. B. Zimmer gelöscht) */
  onDenied(): void;
  onError(): void;
}

/** Hört live auf einen Pfad. Gibt eine Funktion zum Schließen zurück. */
export function openStream(path: string, token: string, h: StreamHandlers): () => void {
  let tree: Tree | null = null;
  const es = new EventSource(dbUrl(path, token));
  const onEvent = (type: 'put' | 'patch') => (e: MessageEvent<string>) => {
    try {
      const msg = JSON.parse(e.data) as { path: string; data: unknown };
      tree = applyStreamEvent(tree, type, msg.path ?? '/', msg.data);
      h.onData(tree);
    } catch {
      // kaputtes Ereignis überspringen
    }
  };
  es.addEventListener('open', () => h.onOpen());
  es.addEventListener('put', onEvent('put') as EventListener);
  es.addEventListener('patch', onEvent('patch') as EventListener);
  es.addEventListener('auth_revoked', () => h.onExpired());
  es.addEventListener('cancel', () => h.onDenied());
  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED) h.onError();
  };
  return () => es.close();
}
