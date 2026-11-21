import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { COLUMNS_KEY } from './columns';
import { ApiError, http, setActiveWorkspace, setUnauthorizedHandler } from './http';
import type { User } from './types';

const ME_KEY = ['me'] as const;
const SESSIONS_KEY = ['sessions'] as const;

interface AuthState {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  const me = useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return (await http<{ user: User }>('/auth/me')).user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null; // signed out is a normal state
        throw err;
      }
    },
    staleTime: Infinity,
    retry: false,
  });

  // The session could not be renewed (expired, signed out elsewhere, revoked): back to the sign-in page.
  useEffect(() => {
    setUnauthorizedHandler(() => forgetEverything(qc));
  }, [qc]);

  const value = useMemo<AuthState>(() => ({ user: me.data ?? null, loading: me.isPending }), [me.data, me.isPending]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Nothing of the previous user may stay in memory: the next person on a shared computer sees none of it. */
function forgetEverything(qc: ReturnType<typeof useQueryClient>) {
  qc.setQueryData(ME_KEY, null);
  setActiveWorkspace(null);
  for (const key of [['tasks'], ['stats'], COLUMNS_KEY, ['priorities'], SESSIONS_KEY, ['workspaces'], ['team'], ['invitation']]) qc.removeQueries({ queryKey: key });
}

export const useAuth = () => useContext(AuthContext);

export function useSignIn(mode: 'login' | 'register') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; email: string; password: string }) => http<{ user: User }>(`/auth/${mode}`, { method: 'POST', body }),
    onSuccess: ({ user }) => {
      forgetEverything(qc);
      qc.setQueryData(ME_KEY, user);
    },
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => http<void>('/auth/logout', { method: 'POST' }),
    onSettled: () => forgetEverything(qc),
  });
}

export function useSignOutEverywhere() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => http<void>('/auth/logout-all', { method: 'POST' }),
    onSuccess: () => forgetEverything(qc),
  });
}

export function useChangePassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) => http<{ user: User }>('/auth/password', { method: 'POST', body }),
    // Every other device was just signed out: the list of devices is different now.
    onSuccess: () => qc.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });
}

export interface DeviceSession {
  id: string;
  ip: string;
  userAgent: string;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}

export function useSessions(enabled: boolean) {
  return useQuery({
    queryKey: SESSIONS_KEY,
    enabled,
    queryFn: ({ signal }) => http<{ sessions: DeviceSession[] }>('/auth/sessions', { signal }).then((r) => r.sessions),
  });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => http<void>(`/auth/sessions/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });
}

/** Every device except this one. This one stays signed in. */
export function useSignOutOthers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => http<void>('/auth/logout-others', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });
}

/** "Forgot password": always succeeds from the caller's side, whether or not the address has an account. */
export const useForgotPassword = () => useMutation({ mutationFn: (email: string) => http<{ ok: true }>('/auth/forgot-password', { method: 'POST', body: { email } }) });

export const useResetPassword = () =>
  useMutation({ mutationFn: (v: { token: string; newPassword: string }) => http<void>('/auth/reset-password', { method: 'POST', body: v }) });
