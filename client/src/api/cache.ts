import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { Task, TaskPage } from './types';

/**
 * Everything the app caches about tasks lives under the ['tasks'] key, in three shapes:
 *   - a TaskPage            (the list view)
 *   - InfiniteData<TaskPage> (one board column)
 *   - a single Task          (the issue detail dialog)
 * These helpers edit all of them in one pass, so an edit made in the dialog shows up on the board
 * and in the list at once, without waiting for the network.
 */
type Cached = Task | TaskPage | InfiniteData<TaskPage>;

export const TASKS_KEY = ['tasks'] as const;

const isInfinite = (d: Cached): d is InfiniteData<TaskPage> => 'pages' in d;
const isPage = (d: Cached): d is TaskPage => 'items' in d;

/** Applies `fn` to every cached copy of a task. Returning null from `fn` removes it from lists. */
function mapCached(data: Cached | undefined, fn: (t: Task) => Task | null): Cached | undefined {
  if (!data) return data;
  const mapPage = (p: TaskPage): TaskPage => {
    const items = p.items.flatMap((t) => {
      const next = fn(t);
      return next ? [next] : [];
    });
    return { ...p, items, total: Math.max(0, p.total - (p.items.length - items.length)) };
  };
  if (isInfinite(data)) return { ...data, pages: data.pages.map(mapPage) };
  if (isPage(data)) return mapPage(data);
  return fn(data) ?? data;
}

export function patchTaskInCaches(qc: QueryClient, id: string, changes: Partial<Task>) {
  qc.setQueriesData<Cached>({ queryKey: TASKS_KEY }, (d) => mapCached(d, (t) => (t.id === id ? { ...t, ...changes } : t)));
}

export function removeTaskFromCaches(qc: QueryClient, id: string) {
  qc.setQueriesData<Cached>({ queryKey: TASKS_KEY }, (d) => mapCached(d, (t) => (t.id === id ? null : t)));
}

export function findTaskInCaches(qc: QueryClient, id: string): Task | undefined {
  for (const [, data] of qc.getQueriesData<Cached>({ queryKey: TASKS_KEY })) {
    if (!data) continue;
    if (isInfinite(data)) {
      for (const p of data.pages) {
        const hit = p.items.find((t) => t.id === id);
        if (hit) return hit;
      }
    } else if (isPage(data)) {
      const hit = data.items.find((t) => t.id === id);
      if (hit) return hit;
    } else if (data.id === id) return data;
  }
  return undefined;
}

export type Snapshot = ReturnType<QueryClient['getQueriesData']>;

export const takeSnapshot = (qc: QueryClient): Snapshot => qc.getQueriesData({ queryKey: TASKS_KEY });

export function restoreSnapshot(qc: QueryClient, snapshot: Snapshot | undefined) {
  snapshot?.forEach(([key, data]) => qc.setQueryData(key, data));
}
