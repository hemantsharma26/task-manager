import { useEffect } from 'react';
import { useTasks } from '../api/tasks';
import type { ListFilters, SortField } from '../api/types';
import { todayLocal } from '../lib/dates';
import { DueBadge } from './DueBadge';
import { PriorityIcon } from './PriorityIcon';
import { usePriorityLookup } from '../api/priorities';
import { Pagination } from './Pagination';
import { StatusLozenge } from './Lozenge';
import { Avatar } from './Avatar';
import { useColumnLookup } from '../api/columns';

interface Props {
  filters: ListFilters;
  owner: string;
  isFiltered: boolean;
  onChange: (patch: Partial<ListFilters>) => void;
  onReset: () => void;
  onOpen: (id: string) => void;
}

const COLUMNS: { label: string; sort?: SortField; defaultOrder?: 'asc' | 'desc' }[] = [
  { label: 'Key', sort: 'createdAt', defaultOrder: 'desc' },
  { label: 'Summary', sort: 'title', defaultOrder: 'asc' },
  { label: 'Status' },
  { label: 'Priority', sort: 'priority', defaultOrder: 'desc' },
  { label: 'Due date', sort: 'dueDate', defaultOrder: 'asc' },
  { label: 'Owner' },
];

export function ListView({ filters, owner, isFiltered, onChange, onReset, onOpen }: Props) {
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useTasks(filters);
  const today = todayLocal();
  const { isDone } = useColumnLookup();
  const { nameOf } = usePriorityLookup();

  // If the last row on a page is deleted, step back to a page that still exists.
  useEffect(() => {
    if (data && filters.page > data.totalPages) onChange({ page: data.totalPages });
  }, [data, filters.page, onChange]);

  const sortBy = (col: (typeof COLUMNS)[number]) => {
    if (!col.sort) return;
    const same = filters.sort === col.sort;
    onChange({ sort: col.sort, order: same ? (filters.order === 'asc' ? 'desc' : 'asc') : (col.defaultOrder ?? 'asc') });
  };

  if (isError && !data)
    return (
      <div className="empty" role="alert">
        <p>{error.message}</p>
        <button type="button" className="btn" onClick={() => void refetch()}>
          Try again
        </button>
      </div>
    );

  return (
    <>
      <div className={`table-wrap ${isPlaceholderData ? 'is-stale' : ''}`}>
        <table className="table">
          <thead>
            <tr>
              {COLUMNS.map((c) => {
                const active = c.sort === filters.sort;
                return (
                  <th key={c.label} aria-sort={active ? (filters.order === 'asc' ? 'ascending' : 'descending') : undefined}>
                    {c.sort ? (
                      <button type="button" className="th-btn" onClick={() => sortBy(c)}>
                        {c.label}
                        {active && <span aria-hidden="true">{filters.order === 'asc' ? ' ↑' : ' ↓'}</span>}
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isPending
              ? [0, 1, 2, 3].map((i) => (
                  <tr key={i} aria-hidden="true">
                    <td colSpan={COLUMNS.length}>
                      <div className="skeleton-line" />
                    </td>
                  </tr>
                ))
              : data?.items.map((t, i) => (
                  <tr key={t.id} className="row" style={{ ['--i' as string]: i }} onClick={() => onOpen(t.id)}>
                    <td className="cell-key">
                      <button type="button" className="link-btn" onClick={(e) => { e.stopPropagation(); onOpen(t.id); }}>
                        {t.key}
                      </button>
                    </td>
                    <td className={`cell-title ${isDone(t.status) ? 'is-done' : ''}`}>{t.title}</td>
                    <td>
                      <StatusLozenge status={t.status} />
                    </td>
                    <td>
                      <span className="prio-cell">
                        <PriorityIcon priority={t.priority} /> {nameOf(t.priority)}
                      </span>
                    </td>
                    <td>{t.dueDate ? <DueBadge due={t.dueDate} time={t.dueTime} done={isDone(t.status)} today={today} /> : <span className="muted">None</span>}</td>
                    <td>
                      <Avatar name={owner} size={22} />
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>

        {data && data.items.length === 0 && (
          <div className="empty">
            {isFiltered ? (
              <>
                <p>No issues match these filters.</p>
                <button type="button" className="btn" onClick={onReset}>
                  Clear filters
                </button>
              </>
            ) : (
              <p>No issues yet. Use Create to add the first one.</p>
            )}
          </div>
        )}
      </div>

      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={(page) => onChange({ page })} />}
    </>
  );
}
