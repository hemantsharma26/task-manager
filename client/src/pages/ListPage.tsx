import { useAuth } from '../api/auth';
import { FilterBar } from '../components/FilterBar';
import { ListView } from '../components/ListView';
import { useShell } from '../components/AppShell';
import { useTaskFilters } from '../hooks/useTaskFilters';
import { PageHeader } from './PageHeader';

export function ListPage() {
  const { user } = useAuth();
  const { openIssue } = useShell();
  const { filters, update, reset, isFiltered } = useTaskFilters();
  if (!user) return null;

  return (
    <>
      <PageHeader title="List" />
      <FilterBar filters={filters} onChange={update} onReset={reset} isFiltered={isFiltered} showStatus />
      <ListView filters={filters} isFiltered={isFiltered} onChange={update} onReset={reset} onOpen={openIssue} />
    </>
  );
}
