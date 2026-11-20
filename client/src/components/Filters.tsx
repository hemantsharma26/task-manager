import { useEffect, useRef, useState } from 'react';
import { PRIORITIES, PRIORITY_LABEL, type DueFilter, type SortField, type TaskFilters, type TaskPriority } from '../api/types';
import { useDebounced } from '../hooks/useDebounced';

interface Props {
  filters: TaskFilters;
  onChange: (patch: Partial<TaskFilters>) => void;
  onReset: () => void;
  isFiltered: boolean;
}

const DUE_OPTIONS: { value: DueFilter | ''; label: string }[] = [
  { value: '', label: 'Any due date' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due today' },
  { value: 'week', label: 'Next 7 days' },
  { value: 'none', label: 'No due date' },
];

const SORT_OPTIONS: { value: string; label: string; sort: SortField; order: 'asc' | 'desc' }[] = [
  { value: 'createdAt:desc', label: 'Newest first', sort: 'createdAt', order: 'desc' },
  { value: 'createdAt:asc', label: 'Oldest first', sort: 'createdAt', order: 'asc' },
  { value: 'dueDate:asc', label: 'Due soonest', sort: 'dueDate', order: 'asc' },
  { value: 'priority:desc', label: 'Highest priority', sort: 'priority', order: 'desc' },
  { value: 'title:asc', label: 'Title A–Z', sort: 'title', order: 'asc' },
];

export function Filters({ filters, onChange, onReset, isFiltered }: Props) {
  // The input is edited locally and pushed to the URL after a pause, so we don't fire a
  // request (and a history entry) on every keystroke. lastSent stops the two effects below
  // from echoing each other and overwriting what the user is still typing.
  const [text, setText] = useState(filters.q);
  const lastSent = useRef(filters.q);
  const debounced = useDebounced(text, 300);

  useEffect(() => {
    if (debounced === lastSent.current) return;
    lastSent.current = debounced;
    onChange({ q: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // Pick up changes made elsewhere: "Clear filters", the back button, a pasted URL.
  useEffect(() => {
    if (filters.q === lastSent.current) return;
    lastSent.current = filters.q;
    setText(filters.q);
  }, [filters.q]);

  return (
    <section className="filters" aria-label="Filter tasks">
      <label className="field field-grow">
        <span className="sr-only">Search tasks</span>
        <input
          type="search"
          placeholder="Search title or description…"
          value={text}
          maxLength={100}
          onChange={(e) => setText(e.target.value)}
        />
      </label>

      <label className="field">
        <span className="sr-only">Priority</span>
        <select
          value={filters.priority ?? ''}
          onChange={(e) => onChange({ priority: (e.target.value || undefined) as TaskPriority | undefined })}
        >
          <option value="">Any priority</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]} priority
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="sr-only">Due date</span>
        <select value={filters.due ?? ''} onChange={(e) => onChange({ due: (e.target.value || undefined) as DueFilter | undefined })}>
          {DUE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="sr-only">Sort by</span>
        <select
          value={`${filters.sort}:${filters.order}`}
          onChange={(e) => {
            const opt = SORT_OPTIONS.find((o) => o.value === e.target.value);
            if (opt) onChange({ sort: opt.sort, order: opt.order });
          }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {isFiltered && (
        <button type="button" className="btn btn-ghost" onClick={onReset}>
          Clear filters
        </button>
      )}
    </section>
  );
}
