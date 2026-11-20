import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, http, setUnauthorizedHandler } from './http';
import type { User } from './types';

const ME_KEY = ['me'] as const;

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

  // Any 401 from the API (e.g. an expired session) drops the user back to the sign-in page.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      qc.setQueryData(ME_KEY, null);
      qc.removeQueries({ queryKey: ['tasks'] });
      qc.removeQueries({ queryKey: ['stats'] });
    });
  }, [qc]);

  const value = useMemo<AuthState>(() => ({ user: me.data ?? null, loading: me.isPending }), [me.data, me.isPending]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export function useSignIn(mode: 'login' | 'register') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; email: string; password: string }) =>
      http<{ user: User }>(`/auth/${mode}`, { method: 'POST', body }),
    onSuccess: ({ user }) => qc.setQueryData(ME_KEY, user),
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => http<void>('/auth/logout', { method: 'POST' }),
    onSettled: () => {
      // Clear everything so the next person on a shared computer sees none of it.
      qc.setQueryData(ME_KEY, null);
      qc.removeQueries({ queryKey: ['tasks'] });
      qc.removeQueries({ queryKey: ['stats'] });
    },
  });
}
