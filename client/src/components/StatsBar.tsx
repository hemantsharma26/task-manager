import { useStats } from '../api/tasks';
import type { TaskFilters, TaskStatus } from '../api/types';

interface Props {
  filters: TaskFilters;
  onStatus: (s: TaskStatus | undefined) => void;
  onOverdue: () => void;
}

/** The counts double as quick filters: click "In progress" to see only those tasks. */
export function StatsBar({ filters, onStatus, onOverdue }: Props) {
  const { data } = useStats();

  const cards: { key: string; label: string; value: number | undefined; active: boolean; onClick: () => void; tone?: string }[] = [
    { key: 'all', label: 'All tasks', value: data?.total, active: !filters.status && !filters.due, onClick: () => onStatus(undefined) },
    { key: 'todo', label: 'To do', value: data?.todo, active: filters.status === 'todo', onClick: () => onStatus('todo') },
    { key: 'in_progress', label: 'In progress', value: data?.in_progress, active: filters.status === 'in_progress', onClick: () => onStatus('in_progress') },
    { key: 'done', label: 'Done', value: data?.done, active: filters.status === 'done', onClick: () => onStatus('done') },
    { key: 'overdue', label: 'Overdue', value: data?.overdue, active: filters.due === 'overdue', onClick: onOverdue, tone: data && data.overdue > 0 ? 'danger' : undefined },
  ];

  return (
    <section className="stats" aria-label="Task summary">
      {cards.map((c) => (
        <button
          key={c.key}
          type="button"
          className={`stat ${c.active ? 'stat-active' : ''} ${c.tone ? `stat-${c.tone}` : ''}`}
          aria-pressed={c.active}
          onClick={c.onClick}
        >
          <span className="stat-value">{c.value ?? '–'}</span>
          <span className="stat-label">{c.label}</span>
        </button>
      ))}
    </section>
  );
}
