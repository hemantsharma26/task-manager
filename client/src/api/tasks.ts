import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { todayLocal } from '../lib/dates';
import { http } from './http';
import type { Task, TaskFilters, TaskInput, TaskPage, TaskStats } from './types';

export const PAGE_SIZE = 8;

const taskKeys = {
  all: ['tasks'] as const,
  list: (f: TaskFilters, today: string) => ['tasks', 'list', f, today] as const,
  stats: (today: string) => ['stats', today] as const,
};

function toQueryString(f: TaskFilters, today: string) {
  const p = new URLSearchParams({ sort: f.sort, order: f.order, page: String(f.page), limit: String(PAGE_SIZE), today });
  if (f.status) p.set('status', f.status);
  if (f.priority) p.set('priority', f.priority);
  if (f.due) p.set('due', f.due);
  if (f.q) p.set('q', f.q);
  return p.toString();
}

export function useTasks(filters: TaskFilters) {
  const today = todayLocal();
  return useQuery({
    queryKey: taskKeys.list(filters, today),
    queryFn: ({ signal }) => http<TaskPage>(`/tasks?${toQueryString(filters, today)}`, { signal }),
    // Keep showing the old page while the next one loads, so filtering does not flash empty.
    placeholderData: keepPreviousData,
  });
}

export function useStats() {
  const today = todayLocal();
  return useQuery({
    queryKey: taskKeys.stats(today),
    queryFn: ({ signal }) => http<TaskStats>(`/tasks/stats?today=${today}`, { signal }),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TaskInput) => http<{ task: Task }>('/tasks', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }).then(() => qc.invalidateQueries({ queryKey: ['stats'] })),
  });
}

type Snapshot = [QueryKey, TaskPage | undefined][];

/**
 * Updates every cached list optimistically, rolls back if the request fails, and always
 * refetches afterwards so the server stays the source of truth (it also decides things the
 * client cannot, like which page a task now belongs on).
 */
function useOptimistic<V>(request: (v: V) => Promise<unknown>, patch: (page: TaskPage, v: V) => TaskPage) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: request,
    onMutate: async (variables: V) => {
      await qc.cancelQueries({ queryKey: taskKeys.all });
      const snapshot: Snapshot = qc.getQueriesData<TaskPage>({ queryKey: taskKeys.all });
      qc.setQueriesData<TaskPage>({ queryKey: taskKeys.all }, (page) => (page ? patch(page, variables) : page));
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: taskKeys.all });
      void qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export const useUpdateTask = () =>
  useOptimistic<{ id: string; changes: Partial<TaskInput> }>(
    ({ id, changes }) => http(`/tasks/${id}`, { method: 'PATCH', body: changes }),
    (page, { id, changes }) => ({
      ...page,
      items: page.items.map((t) => (t.id === id ? { ...t, ...changes } : t)),
    }),
  );

export const useDeleteTask = () =>
  useOptimistic<string>(
    (id) => http(`/tasks/${id}`, { method: 'DELETE' }),
    (page, id) => ({ ...page, items: page.items.filter((t) => t.id !== id), total: Math.max(0, page.total - 1) }),
  );
