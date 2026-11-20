import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { STATUS_LABEL, type Task, type TaskStatus } from '../../api/types';
import { Card } from './Card';
import { QuickCreate } from './QuickCreate';

interface Props {
  status: TaskStatus;
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
  onOpen: (id: string) => void;
  onLoadMore: () => void;
}

export function Column({ status, tasks, total, loading, stale, error, onRetry, hasMore, loadingMore, today, owner, onOpen, onLoadMore }: Props) {
  // The column itself is a drop target too, so a card can be dropped into an empty column.
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const remaining = Math.max(0, total - tasks.length);

  return (
    <section className="column" aria-label={STATUS_LABEL[status]}>
      <header className="column-head">
        <h2>{STATUS_LABEL[status]}</h2>
        <span className="count">{total}</span>
      </header>

      <div ref={setNodeRef} className={`column-body ${isOver ? 'column-over' : ''} ${stale ? 'is-stale' : ''}`}>
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {loading && !error ? (
            <>
              <div className="card card-skeleton" />
              <div className="card card-skeleton" />
            </>
          ) : (
            tasks.map((t) => <Card key={t.id} task={t} today={today} owner={owner} onOpen={onOpen} />)
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

      <QuickCreate status={status} />
    </section>
  );
}
