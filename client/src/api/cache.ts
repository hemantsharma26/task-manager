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

const isColumnKey = (key: readonly unknown[], status?: string) => key[0] === 'tasks' && key[1] === 'column' && (status === undefined || key[2] === status);

/**
 * Optimistically moves a task to another column: out of the old column's cache, onto the bottom of the new one.
 * The server decides the real position, and a refetch right after fixes anything this guessed wrong, but for the
 * moment in between the card is already where the user expects it, so nothing jumps.
 */
export function moveTaskBetweenColumnCaches(qc: QueryClient, task: Task, to: Task['status']) {
  const moved: Task = { ...task, status: to };

  for (const [key, data] of qc.getQueriesData<InfiniteData<TaskPage>>({ predicate: (q) => isColumnKey(q.queryKey) })) {
    if (!data || !isInfinite(data)) continue;
    const status = key[2];
    if (status === task.status && task.status !== to) {
      qc.setQueryData(key, {
        ...data,
        pages: data.pages.map((p) => {
          const items = p.items.filter((t) => t.id !== task.id);
          return { ...p, items, total: Math.max(0, p.total - (p.items.length - items.length)) };
        }),
      });
    } else if (status === to && task.status !== to) {
      const last = data.pages.length - 1;
      const hasMore = (data.pages[last]?.page ?? 1) < (data.pages[last]?.totalPages ?? 1);
      qc.setQueryData(key, {
        ...data,
        pages: data.pages.map((p, i) => ({
          ...p,
          total: p.total + 1,
          // If more pages are still on the server, the bottom of the column is not loaded yet, so only the count moves.
          items: i === last && !hasMore ? [...p.items, moved] : p.items,
        })),
      });
    }
  }
}

/** Adds a not-yet-saved card to the bottom of one column's cache. Used for instant "Create". */
export function appendToColumnCaches(qc: QueryClient, status: Task['status'], temp: Task) {
  for (const [key, data] of qc.getQueriesData<InfiniteData<TaskPage>>({ predicate: (q) => isColumnKey(q.queryKey, status) })) {
    if (!data || !isInfinite(data)) continue;
    // A column that is filtered might not be allowed to show the new card, so leave those to the refetch.
    const f = key[3] as { q?: string; priority?: string; due?: string } | undefined;
    if (f?.q || f?.priority || f?.due) continue;
    const last = data.pages.length - 1;
    const hasMore = (data.pages[last]?.page ?? 1) < (data.pages[last]?.totalPages ?? 1);
    qc.setQueryData(key, {
      ...data,
      pages: data.pages.map((p, i) => ({ ...p, total: p.total + 1, items: i === last && !hasMore ? [...p.items, temp] : p.items })),
    });
  }
}

export const isTempId = (id: string) => id.startsWith('temp-');
