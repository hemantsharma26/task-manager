import { useAuth } from '../api/auth';
import { FilterBar } from '../components/FilterBar';
import { Board } from '../components/board/Board';
import { useShell } from '../components/AppShell';
import { useTaskFilters } from '../hooks/useTaskFilters';
import { PageHeader } from './PageHeader';

export function BoardPage() {
  const { user } = useAuth();
  const { openIssue } = useShell();
  const { filters, update, reset, isFiltered } = useTaskFilters();
  if (!user) return null;

  return (
    <>
      <PageHeader title="Board" />
      <FilterBar filters={filters} onChange={update} onReset={reset} isFiltered={isFiltered} />
      {/* Only the filters the board understands. Status and sort do not apply to its columns. */}
      <Board filters={{ q: filters.q, priority: filters.priority, due: filters.due }} owner={user.name} onOpen={openIssue} />
    </>
  );
}
