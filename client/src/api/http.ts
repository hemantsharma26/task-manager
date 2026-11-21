export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields: FieldError[] = [],
    /** For 429: seconds until trying again is worthwhile. */
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Message for one form field, if the server complained about it. */
  fieldMessage(field: string) {
    return this.fields.find((f) => f.field === field)?.message;
  }
}

/**
 * Which board requests are about. Null is the person's own board; otherwise the id of a board they were invited to, sent with
 * every request as X-Workspace-Id (the server checks they really are on that team).
 */
let activeWorkspace: string | null = null;
export const setActiveWorkspace = (id: string | null) => {
  activeWorkspace = id;
};
export const getActiveWorkspace = () => activeWorkspace;
// Account-level calls are not about any board.
const BOARDLESS_PATHS = ['/auth', '/workspaces', '/invitations'];

type Listener = () => void;
let onUnauthorized: Listener = () => {};

/** The auth provider registers a callback so a session that cannot be renewed signs the user out in the UI. */
export const setUnauthorizedHandler = (fn: Listener) => {
  onUnauthorized = fn;
};

// Calls that must never trigger a silent refresh: they are the ones that create or end a session, or the refresh itself.
const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];
const isAuthPath = (path: string) => AUTH_PATHS.some((p) => path.startsWith(p));

let inFlightRefresh: Promise<boolean> | null = null;

/**
 * Asks the server for a new access token using the refresh cookie (the browser sends it by itself; JavaScript never sees
 * it). Many requests failing at once share one refresh, and across browser tabs a lock makes them take turns, so two tabs
 * never present the same refresh token at the same moment.
 */
export function refreshAccess(): Promise<boolean> {
  inFlightRefresh ??= (async () => {
    const run = async () => {
      try {
        return (await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })).ok;
      } catch {
        return false;
      }
    };
    // Web Locks exist only in secure contexts (https, localhost), so fall back to a plain call when they are missing.
    const locks = (navigator as { locks?: LockManager }).locks;
    return locks ? locks.request('tm-token-refresh', run) : run();
  })().finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

interface RequestInit2 {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

export async function http<T>(path: string, init: RequestInit2 = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (activeWorkspace && !BOARDLESS_PATHS.some((p) => path.startsWith(p))) headers['X-Workspace-Id'] = activeWorkspace;

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? 'GET',
      headers: Object.keys(headers).length ? headers : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: 'same-origin',
      signal: init.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check your connection and try again.');
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    // The access token is short-lived by design. When it runs out, get a new one quietly and repeat the request once;
    // the user only sees a sign-in page if the session itself is over.
    if (res.status === 401 && !retried && !isAuthPath(path)) {
      if (await refreshAccess()) return http<T>(path, init, true);
      onUnauthorized();
    }
    const e = data?.error;
    const retryAfter = Number(res.headers.get('Retry-After'));
    throw new ApiError(
      res.status,
      e?.code ?? 'ERROR',
      e?.message ?? 'Something went wrong. Please try again.',
      Array.isArray(e?.details) ? e.details : [],
      retryAfter > 0 ? retryAfter : undefined,
    );
  }
  return data as T;
}
