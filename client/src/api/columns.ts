import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { http } from './http';
import { TASKS_KEY } from './cache';
import type { Column } from './types';

export const COLUMNS_KEY = ['columns'] as const;
export const MAX_COLUMNS = 12;

// What a brand-new account looks like before the server has answered, so the first paint already has the board's shape.
const FALLBACK: Column[] = [
  { id: 'f1', key: 'todo', name: 'To do', isDone: false, color: null },
  { id: 'f2', key: 'in_progress', name: 'In progress', isDone: false, color: null },
  { id: 'f3', key: 'issue', name: 'Issue', isDone: false, color: null },
  { id: 'f4', key: 'rework', name: 'Re-work', isDone: false, color: null },
  { id: 'f5', key: 'done', name: 'Done', isDone: true, color: null },
];

export function useColumns() {
  return useQuery({
    queryKey: COLUMNS_KEY,
    queryFn: ({ signal }) => http<{ columns: Column[] }>('/columns', { signal }).then((r) => r.columns),
    // Columns change rarely and only through this app, so keep them for a long time.
    staleTime: 10 * 60_000,
  });
}

/** Column lookups for the rest of the UI: names for lozenges, and "is this status finished?". */
export function useColumnLookup() {
  const { data } = useColumns();
  const columns = data ?? FALLBACK;
  const byKey = useMemo(() => new Map(columns.map((c) => [c.key, c])), [columns]);
  const isDone = useCallback((key: string) => byKey.get(key)?.isDone ?? key === 'done', [byKey]);
  const nameOf = useCallback((key: string) => byKey.get(key)?.name ?? key, [byKey]);
  const colorOf = useCallback((key: string) => byKey.get(key)?.color ?? null, [byKey]);
  return { columns, loaded: !!data, isDone, nameOf, colorOf };
}

type Reply = { columns: Column[] };

function useColumnMutation<V>(request: (v: V) => Promise<Reply>, opts: { optimistic?: (cols: Column[], v: V) => Column[]; refetchTasks?: boolean } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: request,
    onMutate: async (v: V) => {
      await qc.cancelQueries({ queryKey: COLUMNS_KEY });
      const previous = qc.getQueryData<Column[]>(COLUMNS_KEY);
      if (opts.optimistic && previous) qc.setQueryData<Column[]>(COLUMNS_KEY, opts.optimistic(previous, v));
      return { previous };
    },
    onError: (_e, _v, ctx) => ctx?.previous && qc.setQueryData(COLUMNS_KEY, ctx.previous),
    // The server's list is the truth, including keys it generated.
    onSuccess: (reply) => qc.setQueryData(COLUMNS_KEY, reply.columns),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['stats'] });
      // Tasks only need refetching when the change moved or finished them.
      if (opts.refetchTasks) void qc.invalidateQueries({ queryKey: TASKS_KEY });
    },
  });
}

export const useAddColumn = () =>
  useColumnMutation((v: { name: string; isDone: boolean; color?: string | null }) => http<Reply>('/columns', { method: 'POST', body: v }));

export const useUpdateColumn = () =>
  useColumnMutation((v: { id: string; changes: { name?: string; isDone?: boolean; color?: string | null } }) => http<Reply>(`/columns/${v.id}`, { method: 'PATCH', body: v.changes }), {
    optimistic: (cols, v) => cols.map((c) => (c.id === v.id ? { ...c, ...v.changes } : c)),
    // Turning "done" on or off finishes or reopens the tasks inside.
    refetchTasks: true,
  });

export const useMoveColumn = () =>
  useColumnMutation((v: { id: string; afterId: string | null }) => http<Reply>(`/columns/${v.id}/move`, { method: 'POST', body: { afterId: v.afterId } }), {
    optimistic: (cols, v) => {
      const moving = cols.find((c) => c.id === v.id);
      if (!moving) return cols;
      const rest = cols.filter((c) => c.id !== v.id);
      const at = v.afterId ? rest.findIndex((c) => c.id === v.afterId) + 1 : 0;
      return [...rest.slice(0, at), moving, ...rest.slice(at)];
    },
  });

export const useDeleteColumn = () =>
  useColumnMutation(
    (v: { id: string; moveTo?: string }) => http<Reply>(`/columns/${v.id}${v.moveTo ? `?moveTo=${encodeURIComponent(v.moveTo)}` : ''}`, { method: 'DELETE' }),
    { optimistic: (cols, v) => cols.filter((c) => c.id !== v.id), refetchTasks: true },
  );
