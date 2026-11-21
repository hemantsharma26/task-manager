import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { TASKS_KEY } from './cache';
import { http } from './http';
import type { Priority } from './types';

export const PRIORITIES_KEY = ['priorities'] as const;
export const MAX_PRIORITIES = 12;

// The classic three, used for the very first paint before the server has answered.
const FALLBACK: Priority[] = [
  { id: 'p1', key: 'low', name: 'Low', color: '#1d7afc' },
  { id: 'p2', key: 'medium', name: 'Medium', color: '#e56910' },
  { id: 'p3', key: 'high', name: 'High', color: '#c9372c' },
];
const UNKNOWN_COLOR = '#626f86';

export function usePriorities() {
  return useQuery({
    queryKey: PRIORITIES_KEY,
    queryFn: ({ signal }) => http<{ priorities: Priority[] }>('/priorities', { signal }).then((r) => r.priorities),
    // They change rarely and only through this app, so keep them for a long time.
    staleTime: 10 * 60_000,
  });
}

/** Lookups for the rest of the UI: a priority's name and colour from the key a task carries. */
export function usePriorityLookup() {
  const { data } = usePriorities();
  const priorities = data ?? FALLBACK;
  const byKey = useMemo(() => new Map(priorities.map((p) => [p.key, p])), [priorities]);
  const nameOf = useCallback((key: string) => byKey.get(key)?.name ?? key, [byKey]);
  const colorOf = useCallback((key: string) => byKey.get(key)?.color ?? UNKNOWN_COLOR, [byKey]);
  return { priorities, loaded: !!data, nameOf, colorOf };
}

type Reply = { priorities: Priority[] };

function usePriorityMutation<V>(request: (v: V) => Promise<Reply>, opts: { optimistic?: (rows: Priority[], v: V) => Priority[]; refetchTasks?: boolean } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: request,
    onMutate: async (v: V) => {
      await qc.cancelQueries({ queryKey: PRIORITIES_KEY });
      const previous = qc.getQueryData<Priority[]>(PRIORITIES_KEY);
      if (opts.optimistic && previous) qc.setQueryData<Priority[]>(PRIORITIES_KEY, opts.optimistic(previous, v));
      return { previous };
    },
    onError: (_e, _v, ctx) => ctx?.previous && qc.setQueryData(PRIORITIES_KEY, ctx.previous),
    onSuccess: (reply) => qc.setQueryData(PRIORITIES_KEY, reply.priorities),
    onSettled: () => {
      if (opts.refetchTasks) void qc.invalidateQueries({ queryKey: TASKS_KEY });
    },
  });
}

export const useAddPriority = () => usePriorityMutation((v: { name: string; color: string }) => http<Reply>('/priorities', { method: 'POST', body: v }));

export const useUpdatePriority = () =>
  usePriorityMutation((v: { id: string; changes: { name?: string; color?: string } }) => http<Reply>(`/priorities/${v.id}`, { method: 'PATCH', body: v.changes }), {
    optimistic: (rows, v) => rows.map((p) => (p.id === v.id ? { ...p, ...v.changes } : p)),
  });

export const useMovePriority = () =>
  usePriorityMutation((v: { id: string; afterId: string | null }) => http<Reply>(`/priorities/${v.id}/move`, { method: 'POST', body: { afterId: v.afterId } }), {
    optimistic: (rows, v) => {
      const moving = rows.find((p) => p.id === v.id);
      if (!moving) return rows;
      const rest = rows.filter((p) => p.id !== v.id);
      const at = v.afterId ? rest.findIndex((p) => p.id === v.afterId) + 1 : 0;
      return [...rest.slice(0, at), moving, ...rest.slice(at)];
    },
    // The order decides how "sort by priority" ranks tasks.
    refetchTasks: true,
  });

export const useDeletePriority = () =>
  usePriorityMutation((v: { id: string; moveTo?: string }) => http<Reply>(`/priorities/${v.id}${v.moveTo ? `?moveTo=${encodeURIComponent(v.moveTo)}` : ''}`, { method: 'DELETE' }), {
    optimistic: (rows, v) => rows.filter((p) => p.id !== v.id),
    refetchTasks: true,
  });
