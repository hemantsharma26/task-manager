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
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Message for one form field, if the server complained about it. */
  fieldMessage(field: string) {
    return this.fields.find((f) => f.field === field)?.message;
  }
}

type Listener = () => void;
let onUnauthorized: Listener = () => {};

/** The auth provider registers a callback so any 401 anywhere signs the user out in the UI. */
export const setUnauthorizedHandler = (fn: Listener) => {
  onUnauthorized = fn;
};

export async function http<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? 'GET',
      headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
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
    const e = data?.error;
    // 401 from /auth/login means "wrong password", which is not a signed-out session.
    if (res.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) onUnauthorized();
    throw new ApiError(
      res.status,
      e?.code ?? 'ERROR',
      e?.message ?? 'Something went wrong. Please try again.',
      Array.isArray(e?.details) ? e.details : [],
    );
  }
  return data as T;
}
