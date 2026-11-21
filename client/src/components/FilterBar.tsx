import { useEffect, useRef, useState } from 'react';
import { useColumns } from '../api/columns';
import { usePriorities } from '../api/priorities';
import { useMembers } from '../api/team';
import type { DueFilter, ListFilters } from '../api/types';
import { useDebounced } from '../hooks/useDebounced';

interface Props {
  filters: ListFilters;
  onChange: (patch: Partial<ListFilters>) => void;
  onReset: () => void;
  isFiltered: boolean;
  /** The board's columns are the statuses, so only the list view offers a status filter. */
  showStatus?: boolean;
}

const DUE_OPTIONS: { value: DueFilter | ''; label: string }[] = [
  { value: '', label: 'Due date' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due today' },
  { value: 'week', label: 'Next 7 days' },
  { value: 'none', label: 'No due date' },
];

export function FilterBar({ filters, onChange, onReset, isFiltered, showStatus }: Props) {
  const { data: columns = [] } = useColumns();
  const { data: priorities = [] } = usePriorities();
  const members = useMembers().data?.members ?? [];
  // The input is edited locally and pushed to the URL after a pause, so we don't fire a request (and a
  // history entry) on every keystroke. lastSent stops the two effects below from echoing each other and
  // overwriting what the user is still typing.
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
    <div className="filterbar" role="search">
      <label className="search">
        <span className="sr-only">Search tasks</span>
        <input type="search" placeholder="Search tasks" value={text} maxLength={100} onChange={(e) => setText(e.target.value)} />
      </label>

      {showStatus && (
        <label>
          <span className="sr-only">Status</span>
          <select className="select" value={filters.status ?? ''} onChange={(e) => onChange({ status: e.target.value || undefined })}>
            <option value="">Status</option>
            {columns.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label>
        <span className="sr-only">Priority</span>
        <select className="select" value={filters.priority ?? ''} onChange={(e) => onChange({ priority: e.target.value || undefined })}>
          <option value="">Priority</option>
          {priorities.map((p) => (
            <option key={p.key} value={p.key}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className="sr-only">Assignee</span>
        <select className="select" value={filters.assignee ?? ''} onChange={(e) => onChange({ assignee: e.target.value || undefined })}>
          <option value="">Assignee</option>
          <option value="me">Assigned to me</option>
          <option value="unassigned">Unassigned</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className="sr-only">Due date</span>
        <select className="select" value={filters.due ?? ''} onChange={(e) => onChange({ due: (e.target.value || undefined) as DueFilter | undefined })}>
          {DUE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {isFiltered && (
        <button type="button" className="btn btn-subtle" onClick={onReset}>
          Clear filters
        </button>
      )}
    </div>
  );
}
