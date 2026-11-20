import { QueryClient, type InfiniteData } from '@tanstack/react-query';
import { findTaskInCaches, patchTaskInCaches, removeTaskFromCaches, restoreSnapshot, takeSnapshot } from './cache';
import type { Task, TaskPage } from './types';

const task = (n: number, over: Partial<Task> = {}): Task => ({
  id: `id${n}`,
  number: n,
  key: `TM-${n}`,
  title: `Task ${n}`,
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: null,
  completedAt: null,
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
  ...over,
});

const page = (items: Task[], total = items.length): TaskPage => ({ items, page: 1, limit: 20, total, totalPages: 1 });

function setup() {
  const qc = new QueryClient();
  const infinite: InfiniteData<TaskPage> = { pages: [page([task(1), task(2)], 5)], pageParams: [1] };
  qc.setQueryData(['tasks', 'column', 'todo', {}, 'today'], infinite);
  qc.setQueryData(['tasks', 'list', {}, 'today'], page([task(1), task(3)]));
  qc.setQueryData(['tasks', 'detail', 'id1'], task(1));
  return qc;
}

describe('task cache helpers', () => {
  it('patches a task in a column, a list page and the detail copy at once', () => {
    const qc = setup();
    patchTaskInCaches(qc, 'id1', { title: 'Renamed', priority: 'high' });

    const column = qc.getQueryData<InfiniteData<TaskPage>>(['tasks', 'column', 'todo', {}, 'today'])!;
    expect(column.pages[0]!.items[0]).toMatchObject({ title: 'Renamed', priority: 'high' });
    expect(column.pages[0]!.items[1]!.title).toBe('Task 2');
    expect(qc.getQueryData<TaskPage>(['tasks', 'list', {}, 'today'])!.items[0]!.title).toBe('Renamed');
    expect(qc.getQueryData<Task>(['tasks', 'detail', 'id1'])!.title).toBe('Renamed');
  });

  it('removes a task from lists and lowers their totals, leaving other tasks alone', () => {
    const qc = setup();
    removeTaskFromCaches(qc, 'id1');

    const column = qc.getQueryData<InfiniteData<TaskPage>>(['tasks', 'column', 'todo', {}, 'today'])!;
    expect(column.pages[0]!.items.map((t) => t.id)).toEqual(['id2']);
    expect(column.pages[0]!.total).toBe(4);
    expect(qc.getQueryData<TaskPage>(['tasks', 'list', {}, 'today'])!.items.map((t) => t.id)).toEqual(['id3']);
  });

  it('finds a task in any cached shape, and returns undefined for an unknown id', () => {
    const qc = setup();
    expect(findTaskInCaches(qc, 'id3')?.key).toBe('TM-3');
    expect(findTaskInCaches(qc, 'id2')?.key).toBe('TM-2');
    expect(findTaskInCaches(qc, 'nope')).toBeUndefined();
  });

  it('restores a snapshot after a failed optimistic change', () => {
    const qc = setup();
    const snapshot = takeSnapshot(qc);
    patchTaskInCaches(qc, 'id1', { title: 'Optimistic' });
    removeTaskFromCaches(qc, 'id2');

    restoreSnapshot(qc, snapshot);
    const column = qc.getQueryData<InfiniteData<TaskPage>>(['tasks', 'column', 'todo', {}, 'today'])!;
    expect(column.pages[0]!.items.map((t) => t.title)).toEqual(['Task 1', 'Task 2']);
    expect(column.pages[0]!.total).toBe(5);
  });

  it('does not touch caches that are not task data', () => {
    const qc = setup();
    qc.setQueryData(['stats', 'today'], { total: 3 });
    patchTaskInCaches(qc, 'id1', { title: 'x' });
    expect(qc.getQueryData(['stats', 'today'])).toEqual({ total: 3 });
  });
});
