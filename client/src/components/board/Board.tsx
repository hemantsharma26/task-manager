import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  closestCorners,
  defaultDropAnimationSideEffects,
  DndContext,
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
import { useColumnLookup } from '../../api/columns';
import { useWorkspace } from '../../api/workspace';
import { readColumnItems, useColumn, useMoveTask, useStats } from '../../api/tasks';
import type { Column as ColumnModel, CommonFilters, Task } from '../../api/types';
import { todayLocal } from '../../lib/dates';
import { useToast } from '../Toast';
import { AddColumn } from './AddColumn';
import { CardBody } from './Card';
import { Column } from './Column';
import { DeleteColumnDialog } from './DeleteColumnDialog';

/** Cards per column key. */
type Columns = Record<string, Task[]>;

function containerOf(columns: Columns, id: string | number): string | undefined {
  const key = String(id);
  if (key in columns) return key;
  return Object.keys(columns).find((k) => columns[k]!.some((t) => t.id === key));
}

interface Props {
  filters: CommonFilters;
  onOpen: (id: string) => void;
}

export function Board({ filters, onOpen }: Props) {
  const { can } = useWorkspace();
  const today = todayLocal();
  const qc = useQueryClient();
  const { notify } = useToast();
  const move = useMoveTask();
  const { columns, loaded } = useColumnLookup();
  const { data: stats } = useStats();
  const boardRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  // While a card is being dragged (and until the server has confirmed the drop) the board shows this local
  // copy, so the UI never waits on the network and never jumps back to a stale order. `fromServer` is what
  // each column had on screen when the drag started.
  const [draft, setDraft] = useState<Columns | null>(null);
  const fromServer = useRef<Columns>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ColumnModel | null>(null);
  const [deletingCount, setDeletingCount] = useState(0);

  const activeTask = activeId && draft ? Object.values(draft).flat().find((t) => t.id === activeId) : undefined;

  const sensors = useSensors(
    // A small distance threshold lets a plain click open the card instead of starting a drag.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Touch starts from the grip handle only (see Card), so it can begin right away.
    useSensor(TouchSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  );

  const onDragStart = ({ active }: DragStartEvent) => {
    const snapshot = Object.fromEntries(columns.map((c) => [c.key, readColumnItems(qc, c.key, filters, today)]));
    fromServer.current = snapshot;
    setActiveId(String(active.id));
    setDraft(snapshot);
  };

  // Moving across columns happens while dragging, so the card previews where it will land.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || !draft) return;
    const from = containerOf(draft, active.id);
    const to = containerOf(draft, over.id);
    if (!from || !to || from === to) return;

    const moving = draft[from]!.find((t) => t.id === active.id);
    if (!moving) return;

    const overIndex = draft[to]!.findIndex((t) => t.id === over.id);
    const translated = active.rect.current.translated;
    const below = !!translated && translated.top > over.rect.top + over.rect.height / 2;
    const index = overIndex >= 0 ? overIndex + (below ? 1 : 0) : draft[to]!.length;

    setDraft({
      ...draft,
      [from]: draft[from]!.filter((t) => t.id !== active.id),
      [to]: [...draft[to]!.slice(0, index), { ...moving, status: to }, ...draft[to]!.slice(index)],
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
    if (to === overContainer && !(String(over.id) in draft)) {
      const from = draft[to]!.findIndex((t) => t.id === id);
      const target = draft[to]!.findIndex((t) => t.id === over.id);
      if (from !== target) next = { ...draft, [to]: arrayMove(draft[to]!, from, target) };
    }

    const index = next[to]!.findIndex((t) => t.id === id);
    const afterId = index > 0 ? next[to]![index - 1]!.id : null;

    // Dropped back where it started: nothing to save.
    const original = fromServer.current[to] ?? [];
    const originalIndex = original.findIndex((t) => t.id === id);
    const originalAfter = originalIndex > 0 ? original[originalIndex - 1]!.id : null;
    if (originalIndex !== -1 && originalAfter === afterId) return setDraft(null);

    const from = containerOf(fromServer.current, id) ?? to;
    setDraft(next);
    move.mutate(
      { id, status: to, afterId, from },
      {
        onError: (e) => notify('error', e.message),
        onSettled: () => setDraft(null),
      },
    );
  };

  // Which column is in view, for the phone's column tabs.
  const [visible, setVisible] = useState<string>('');
  const columnCount = columns.length;
  useEffect(() => {
    const root = boardRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        const best = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const status = best?.target.getAttribute('data-status');
        if (status) setVisible(status);
      },
      { root, threshold: [0.5, 0.75, 1] },
    );
    root.querySelectorAll('.column').forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [columnCount]);
  const activeTab = visible || columns[0]?.key || '';

  // Keep the highlighted tab in view inside the tab bar as the board is swiped.
  useEffect(() => {
    const bar = tabsRef.current;
    const tab = bar?.querySelector<HTMLElement>('.column-tab.active');
    if (bar && tab) bar.scrollTo({ left: tab.offsetLeft - (bar.clientWidth - tab.offsetWidth) / 2, behavior: 'smooth' });
  }, [activeTab]);

  const scrollToColumn = useCallback((status: string) => {
    const root = boardRef.current;
    const col = root?.querySelector<HTMLElement>(`.column[data-status="${CSS.escape(status)}"]`);
    if (root && col) root.scrollTo({ left: col.offsetLeft - root.offsetLeft, behavior: 'smooth' });
  }, []);

  const scrollToEnd = useCallback(() => {
    // After adding a column, bring the new one into view.
    requestAnimationFrame(() => requestAnimationFrame(() => boardRef.current?.scrollTo({ left: boardRef.current.scrollWidth, behavior: 'smooth' })));
  }, []);

  const others = deleting ? columns.filter((c) => c.key !== deleting.key) : [];

  return (
    <DndContext
      // With no sensors nothing can be picked up, which is how read-only people get a board that cannot be dragged.
      sensors={can('task.edit') ? sensors : []}
      collisionDetection={closestCorners}
      // Dragging near the edge of the board scrolls it sideways, which matters with many columns.
      autoScroll={{ threshold: { x: 0.12, y: 0.15 }, acceleration: 14 }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setDraft(null);
      }}
    >
      <div ref={tabsRef} className="column-tabs" role="tablist" aria-label="Columns">
        {columns.map((c) => (
          <button key={c.key} type="button" role="tab" aria-selected={activeTab === c.key} className={`column-tab ${activeTab === c.key ? 'active' : ''}`} onClick={() => scrollToColumn(c.key)}>
            {c.name} <span className="count">{stats?.byStatus[c.key] ?? '–'}</span>
          </button>
        ))}
      </div>

      <div ref={boardRef} className={`board ${activeId ? 'is-dragging' : ''}`}>
        {columns.map((column, index) => (
          <ColumnContainer
            key={column.key}
            column={column}
            index={index}
            columns={columns}
            editable={loaded}
            filters={filters}
            today={today}
            draftItems={draft?.[column.key]}
            draftBase={fromServer.current[column.key]?.length ?? 0}
            onOpen={onOpen}
            onDelete={(c, count) => {
              setDeletingCount(count);
              setDeleting(c);
            }}
          />
        ))}
        {can('board.manage') && <AddColumn count={columns.length} disabled={!loaded} onAdded={scrollToEnd} />}
      </div>

      <DeleteColumnDialog column={deleting} taskCount={deletingCount} others={others} onClose={() => setDeleting(null)} />

      {/* The floating card glides into its slot when dropped instead of snapping. */}
      <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.2, 0, 0, 1)', sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) }}>
        {activeTask && (
          <div className="card card-overlay">
            <CardBody task={activeTask} today={today} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

interface ContainerProps {
  column: ColumnModel;
  index: number;
  columns: ColumnModel[];
  editable: boolean;
  filters: CommonFilters;
  today: string;
  draftItems: Task[] | undefined;
  /** How many cards this column had when the drag began, to keep its total right while the draft is shown. */
  draftBase: number;
  onOpen: (id: string) => void;
  onDelete: (column: ColumnModel, taskCount: number) => void;
}

/** One column that loads its own cards. Each column is its own query, so any number of them can exist. */
function ColumnContainer({ column, index, columns, editable, filters, today, draftItems, draftBase, onOpen, onDelete }: ContainerProps) {
  const q = useColumn(column.key, filters);

  // Cards ease in (staggered) only while this column first loads. Refetches and drops never replay it.
  const [firstLoad, setFirstLoad] = useState(true);
  useEffect(() => {
    if (!q.isPending) setFirstLoad(false);
  });

  const total = Math.max(0, (q.data?.total ?? 0) + (draftItems ? draftItems.length - draftBase : 0));

  return (
    <Column
      column={column}
      index={index}
      columns={columns}
      editable={editable}
      tasks={draftItems ?? q.data?.items ?? []}
      total={total}
      loading={q.isPending}
      error={q.isError && !q.data ? q.error.message : undefined}
      onRetry={() => void q.refetch()}
      stale={q.isPlaceholderData}
      hasMore={!!q.hasNextPage}
      loadingMore={q.isFetchingNextPage}
      today={today}
      staggerIn={firstLoad}
      onOpen={onOpen}
      onLoadMore={() => void q.fetchNextPage()}
      onDelete={(c) => onDelete(c, total)}
    />
  );
}
