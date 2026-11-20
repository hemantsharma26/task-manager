import { ApiError, http, setActiveWorkspace, setUnauthorizedHandler } from './http';

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

const calls = () => vi.mocked(fetch).mock.calls.map(([url, init]) => `${init?.method ?? 'GET'} ${String(url)}`);

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  // jsdom has no Web Locks; the fallback (no lock) is what runs here
  Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true });
});
afterEach(() => vi.unstubAllGlobals());

describe('http', () => {
  it('quietly refreshes an expired access token and repeats the request once', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(json(401, { error: { code: 'TOKEN_EXPIRED', message: 'expired' } }))
      .mockResolvedValueOnce(json(200, { user: {} })) // the refresh
      .mockResolvedValueOnce(json(200, { items: [1] }));
    await expect(http('/tasks')).resolves.toEqual({ items: [1] });
    expect(calls()).toEqual(['GET /api/tasks', 'POST /api/auth/refresh', 'GET /api/tasks']);
  });

  it('shares ONE refresh between many requests that fail at the same time', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const u = String(url);
      if (u.endsWith('/auth/refresh')) return json(200, { user: {} });
      return vi.mocked(fetch).mock.calls.filter(([x]) => String(x) === u).length === 1 ? json(401, { error: { code: 'TOKEN_EXPIRED', message: '' } }) : json(200, { ok: u });
    });
    await Promise.all([http('/tasks'), http('/columns'), http('/tasks/stats')]);
    expect(calls().filter((c) => c === 'POST /api/auth/refresh')).toHaveLength(1);
  });

  it('signs the user out when the session cannot be renewed, and does not loop', async () => {
    const onOut = vi.fn();
    setUnauthorizedHandler(onOut);
    vi.mocked(fetch).mockResolvedValueOnce(json(401, { error: { code: 'TOKEN_EXPIRED', message: 'expired' } })).mockResolvedValueOnce(json(401, { error: { code: 'UNAUTHORIZED', message: 'no' } }));
    await expect(http('/tasks')).rejects.toBeInstanceOf(ApiError);
    expect(onOut).toHaveBeenCalledOnce();
    expect(calls()).toEqual(['GET /api/tasks', 'POST /api/auth/refresh']);
  });

  it('gives up after one retry, so a server that keeps answering 401 cannot cause an endless loop', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => (String(url).endsWith('/auth/refresh') ? json(200, {}) : json(401, { error: { code: 'UNAUTHORIZED', message: 'no' } })));
    await expect(http('/tasks')).rejects.toBeInstanceOf(ApiError);
    expect(calls()).toEqual(['GET /api/tasks', 'POST /api/auth/refresh', 'GET /api/tasks']);
  });

  it('never tries to refresh for sign-in, register, refresh or sign-out (a wrong password is not an expired session)', async () => {
    for (const path of ['/auth/login', '/auth/register', '/auth/logout']) {
      vi.mocked(fetch).mockClear();
      vi.mocked(fetch).mockResolvedValueOnce(json(401, { error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } }));
      await expect(http(path, { method: 'POST', body: {} })).rejects.toMatchObject({ status: 401, message: 'Invalid email or password' });
      expect(calls()).toHaveLength(1);
    }
  });

  it('carries Retry-After from a 429 so the form can say how long to wait', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json(429, { error: { code: 'RATE_LIMITED', message: 'Too many attempts' } }, { 'Retry-After': '540' }));
    await expect(http('/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({ status: 429, retryAfterSeconds: 540 });
  });

  it('turns a network failure into a friendly error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(http('/tasks')).rejects.toMatchObject({ status: 0, code: 'NETWORK' });
  });

  it('sends cookies only to its own origin and a JSON content type only when there is a body', async () => {
    vi.mocked(fetch).mockResolvedValue(json(200, {}));
    await http('/tasks');
    await http('/tasks', { method: 'POST', body: { a: 1 } });
    const [, getInit] = vi.mocked(fetch).mock.calls[0]!;
    const [, postInit] = vi.mocked(fetch).mock.calls[1]!;
    expect(getInit?.credentials).toBe('same-origin');
    expect(getInit?.headers).toBeUndefined();
    expect(postInit?.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('names the board it is working on, except for account-level calls', async () => {
    vi.mocked(fetch).mockResolvedValue(json(200, {}));
    setActiveWorkspace('64b7f0c2a1b2c3d4e5f60718');
    try {
      await http('/tasks');
      await http('/team/members');
      await http('/workspaces');
      await http('/auth/me');
      await http('/invitations/abc');
      const sent = vi.mocked(fetch).mock.calls.map(([, init]) => (init?.headers as Record<string, string> | undefined)?.['X-Workspace-Id']);
      expect(sent).toEqual(['64b7f0c2a1b2c3d4e5f60718', '64b7f0c2a1b2c3d4e5f60718', undefined, undefined, undefined]);
    } finally {
      setActiveWorkspace(null);
    }
    await http('/tasks');
    expect(vi.mocked(fetch).mock.calls.at(-1)![1]?.headers).toBeUndefined();
  });
});
