import { QueryClient, type InfiniteData } from '@tanstack/react-query';
import { appendToColumnCaches, findTaskInCaches, isTempId, moveTaskBetweenColumnCaches, patchTaskInCaches, removeTaskFromCaches, restoreSnapshot, takeSnapshot } from './cache';
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

describe('optimistic column helpers', () => {
  const columnKey = (status: string, filters: object = {}) => ['tasks', 'column', status, filters, 'today'];
  const columnOf = (qc: QueryClient, status: string, filters: object = {}) =>
    qc.getQueryData<InfiniteData<TaskPage>>(columnKey(status, filters))!;

  const withColumns = () => {
    const qc = new QueryClient();
    qc.setQueryData(columnKey('todo'), { pages: [page([task(1), task(2)], 2)], pageParams: [1] });
    qc.setQueryData(columnKey('done'), { pages: [page([task(9, { status: 'done' })], 1)], pageParams: [1] });
    return qc;
  };

  it('moves a card to the bottom of another column and fixes both counts', () => {
    const qc = withColumns();
    moveTaskBetweenColumnCaches(qc, task(1), 'done');

    expect(columnOf(qc, 'todo').pages[0]!.items.map((t) => t.id)).toEqual(['id2']);
    expect(columnOf(qc, 'todo').pages[0]!.total).toBe(1);
    expect(columnOf(qc, 'done').pages[0]!.items.map((t) => [t.id, t.status])).toEqual([['id9', 'done'], ['id1', 'done']]);
    expect(columnOf(qc, 'done').pages[0]!.total).toBe(2);
  });

  it('only changes the count when the target column has more pages not loaded yet', () => {
    const qc = withColumns();
    qc.setQueryData(columnKey('done'), { pages: [{ ...page([task(9, { status: 'done' })], 40), totalPages: 2 }], pageParams: [1] });
    moveTaskBetweenColumnCaches(qc, task(1), 'done');
    expect(columnOf(qc, 'done').pages[0]!.items).toHaveLength(1);
    expect(columnOf(qc, 'done').pages[0]!.total).toBe(41);
  });

  it('appends a pending card to the right column, marked as temporary', () => {
    const qc = withColumns();
    appendToColumnCaches(qc, 'todo', task(0, { id: 'temp-1', key: 'TM-…' }));
    expect(columnOf(qc, 'todo').pages[0]!.items.map((t) => t.id)).toEqual(['id1', 'id2', 'temp-1']);
    expect(columnOf(qc, 'done').pages[0]!.items).toHaveLength(1);
    expect(isTempId('temp-1')).toBe(true);
    expect(isTempId('6b005e75d5c09c1fe734f406')).toBe(false);
  });

  it('skips filtered columns, because the new card might not match the filter', () => {
    const qc = new QueryClient();
    qc.setQueryData(columnKey('todo', { q: 'rent' }), { pages: [page([task(1)], 1)], pageParams: [1] });
    appendToColumnCaches(qc, 'todo', task(0, { id: 'temp-1' }));
    expect(columnOf(qc, 'todo', { q: 'rent' }).pages[0]!.items).toHaveLength(1);
  });
});
