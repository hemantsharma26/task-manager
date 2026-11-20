import { useMemo, useState } from 'react';
import {
  closestCorners,
  DndContext,
  defaultDropAnimationSideEffects,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useColumn, useMoveTask } from '../../api/tasks';
import { STATUSES, type CommonFilters, type Task, type TaskStatus } from '../../api/types';
import { todayLocal } from '../../lib/dates';
import { useToast } from '../Toast';
import { CardBody } from './Card';
import { Column } from './Column';

type Columns = Record<TaskStatus, Task[]>;

const isStatus = (id: unknown): id is TaskStatus => STATUSES.includes(id as TaskStatus);

function containerOf(columns: Columns, id: string | number): TaskStatus | undefined {
  if (isStatus(id)) return id;
  return STATUSES.find((s) => columns[s].some((t) => t.id === id));
}

interface Props {
  filters: CommonFilters;
  owner: string;
  onOpen: (id: string) => void;
}

export function Board({ filters, owner, onOpen }: Props) {
  const today = todayLocal();
  const { notify } = useToast();
  const move = useMoveTask();

  const todo = useColumn('todo', filters);
  const inProgress = useColumn('in_progress', filters);
  const done = useColumn('done', filters);
  const queries: Record<TaskStatus, typeof todo> = { todo, in_progress: inProgress, done };

  const fromServer = useMemo<Columns>(
    () => ({ todo: todo.data?.items ?? [], in_progress: inProgress.data?.items ?? [], done: done.data?.items ?? [] }),
    [todo.data, inProgress.data, done.data],
  );

  // While a card is being dragged (and until the server has confirmed the drop) the board shows this local
  // copy, so the UI never waits on the network and never jumps back to a stale order.
  const [draft, setDraft] = useState<Columns | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const columns = draft ?? fromServer;
  const activeTask = activeId ? STATUSES.flatMap((s) => columns[s]).find((t) => t.id === activeId) : undefined;

  const sensors = useSensors(
    // A small distance threshold lets a plain click open the card instead of starting a drag.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // On touch screens a drag starts only after a short press-and-hold, so swiping still scrolls the board.
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  );

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    setDraft(fromServer);
  };

  // Moving across columns happens while dragging, so the card previews where it will land.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || !draft) return;
    const from = containerOf(draft, active.id);
    const to = containerOf(draft, over.id);
    if (!from || !to || from === to) return;

    const moving = draft[from].find((t) => t.id === active.id);
    if (!moving) return;

    const overIndex = draft[to].findIndex((t) => t.id === over.id);
    const translated = active.rect.current.translated;
    const below = !!translated && translated.top > over.rect.top + over.rect.height / 2;
    const index = overIndex >= 0 ? overIndex + (below ? 1 : 0) : draft[to].length;

    setDraft({
      ...draft,
      [from]: draft[from].filter((t) => t.id !== active.id),
      [to]: [...draft[to].slice(0, index), { ...moving, status: to }, ...draft[to].slice(index)],
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || !draft) return setDraft(null);

    const id = String(active.id);
    const to = containerOf(draft, active.id);
    const overContainer = containerOf(draft, over.id);
    if (!to || !overContainer) return setDraft(null);

    let next = draft;
    if (to === overContainer && !isStatus(over.id)) {
      const from = draft[to].findIndex((t) => t.id === id);
      const target = draft[to].findIndex((t) => t.id === over.id);
      if (from !== target) next = { ...draft, [to]: arrayMove(draft[to], from, target) };
    }

    const index = next[to].findIndex((t) => t.id === id);
    const afterId = index > 0 ? next[to][index - 1]!.id : null;

    // Dropped back where it started: nothing to save.
    const original = fromServer[to];
    const originalIndex = original.findIndex((t) => t.id === id);
    const originalAfter = originalIndex > 0 ? original[originalIndex - 1]!.id : null;
    if (originalIndex !== -1 && originalAfter === afterId) return setDraft(null);

    const from = containerOf(fromServer, id) ?? to;
    setDraft(next);
    move.mutate(
      { id, status: to, afterId, from },
      {
        onError: (e) => notify('error', e.message),
        onSettled: () => setDraft(null),
      },
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setDraft(null);
      }}
    >
      <div className="board">
        {STATUSES.map((status) => {
          const q = queries[status];
          // Totals come from the server; while a drop is in flight, adjust them by what the draft changed.
          const delta = draft ? draft[status].length - fromServer[status].length : 0;
          return (
            <Column
              key={status}
              status={status}
              tasks={columns[status]}
              total={Math.max(0, (q.data?.total ?? 0) + delta)}
              loading={q.isPending}
              error={q.isError && !q.data ? q.error.message : undefined}
              onRetry={() => void q.refetch()}
              stale={q.isPlaceholderData}
              hasMore={!!q.hasNextPage}
              loadingMore={q.isFetchingNextPage}
              today={today}
              owner={owner}
              onOpen={onOpen}
              onLoadMore={() => void q.fetchNextPage()}
            />
          );
        })}
      </div>

      {/* The floating card glides into its slot when dropped instead of snapping. */}
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)', sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) }}>
        {activeTask && (
          <div className="card card-overlay">
            <CardBody task={activeTask} today={today} owner={owner} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
