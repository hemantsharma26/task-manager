import { useEffect, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useMoveColumn, useUpdateColumn } from '../../api/columns';
import type { Column as ColumnModel, Task } from '../../api/types';
import { toneFor } from '../../lib/tone';
import { useToast } from '../Toast';
import { Card } from './Card';
import { ColumnMenu } from './ColumnMenu';
import { QuickCreate } from './QuickCreate';

interface Props {
  column: ColumnModel;
  index: number;
  columns: ColumnModel[];
  /** False until the real column list has loaded (until then the ids are placeholders). */
  editable: boolean;
  tasks: Task[];
  total: number;
  loading: boolean;
  /** Showing the previous filter's cards while the new ones load. */
  stale?: boolean;
  error?: string;
  onRetry: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  today: string;
  owner: string;
  /** True only while this column is first loading, so its cards ease in once and never again on refetches or drops. */
  staggerIn: boolean;
  onOpen: (id: string) => void;
  onLoadMore: () => void;
  onDelete: (column: ColumnModel) => void;
}

export function Column({ column, index, columns, editable, tasks, total, loading, stale, error, onRetry, hasMore, loadingMore, today, owner, staggerIn, onOpen, onLoadMore, onDelete }: Props) {
  // The column itself is a drop target too, so a card can be dropped into an empty column.
  const { setNodeRef, isOver } = useDroppable({ id: column.key });
  const remaining = Math.max(0, total - tasks.length);
  const accent = toneFor(column.key, column.isDone, column.color).accent;

  return (
    <section className="column" data-status={column.key} data-accent={accent ? '' : undefined} style={{ ['--accent' as string]: accent }} aria-label={column.name}>
      <ColumnHeader column={column} index={index} columns={columns} total={total} editable={editable} onDelete={onDelete} />

      <div ref={setNodeRef} className={`column-body ${isOver ? 'column-over' : ''} ${stale ? 'is-stale' : ''}`}>
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {loading && !error ? (
            <>
              <div className="card card-skeleton" />
              <div className="card card-skeleton" />
            </>
          ) : (
            tasks.map((t, i) => (
              <Card key={t.id} task={t} today={today} owner={owner} onOpen={onOpen} index={i} enter={t.id.startsWith('temp-') ? 'pop' : staggerIn ? 'stagger' : undefined} />
            ))
          )}
        </SortableContext>

        {error && (
          <div className="column-empty" role="alert">
            <p>{error}</p>
            <button type="button" className="btn btn-sm" onClick={onRetry}>
              Try again
            </button>
          </div>
        )}

        {!loading && !error && tasks.length === 0 && <p className="column-empty">No issues</p>}

        {hasMore && (
          <button type="button" className="btn btn-subtle btn-block" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : `Show ${remaining} more`}
          </button>
        )}
      </div>

      <QuickCreate status={column.key} />
    </section>
  );
}

function ColumnHeader({ column, index, columns, total, editable, onDelete }: Pick<Props, 'column' | 'index' | 'columns' | 'total' | 'editable' | 'onDelete'>) {
  const update = useUpdateColumn();
  const move = useMoveColumn();
  const { notify } = useToast();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(column.name);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) {
      input.current?.focus();
      input.current?.select();
    }
  }, [renaming]);
  useEffect(() => {
    if (!renaming) setName(column.name);
  }, [column.name, renaming]);

  const fail = (e: Error) => notify('error', e.message);

  const commitRename = () => {
    setRenaming(false);
    const next = name.trim();
    if (!next || next === column.name) return setName(column.name);
    update.mutate({ id: column.id, changes: { name: next } }, { onError: (e) => { setName(column.name); fail(e); } });
  };

  const moveBy = (direction: -1 | 1) => {
    // "Directly after" this column: two to the left when moving left, one to the right when moving right.
    const afterId = direction === -1 ? (columns[index - 2]?.id ?? null) : (columns[index + 1]?.id ?? null);
    move.mutate({ id: column.id, afterId }, { onError: fail });
  };

  return (
    <header className="column-head">
      {renaming ? (
        <input
          ref={input}
          className="column-rename"
          value={name}
          maxLength={30}
          aria-label="Column name"
          onChange={(e) => setName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              setName(column.name);
              setRenaming(false);
            }
          }}
        />
      ) : (
        <h2 title={column.isDone ? 'Tasks here count as done' : undefined}>{column.name}</h2>
      )}
      <span className="count">{total}</span>
      {column.isDone && !renaming && (
        <span className="done-flag" title="Counts as done">
          ✓
        </span>
      )}
      {editable && (
        <ColumnMenu
          column={column}
          index={index}
          count={columns.length}
          onRename={() => setRenaming(true)}
          onMove={moveBy}
          onToggleDone={() => update.mutate({ id: column.id, changes: { isDone: !column.isDone } }, { onError: fail })}
          onColor={(color) => update.mutate({ id: column.id, changes: { color } }, { onError: fail })}
          onDelete={() => onDelete(column)}
        />
      )}
    </header>
  );
}
