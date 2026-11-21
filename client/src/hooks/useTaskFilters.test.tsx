import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { useTaskFilters } from './useTaskFilters';

const wrap = (url: string) => ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>;

describe('useTaskFilters', () => {
  it('reads filters from the URL', () => {
    const { result } = renderHook(() => useTaskFilters(), { wrapper: wrap('/board?priority=high&due=overdue&q=rent&sort=dueDate&order=asc&page=3') });
    expect(result.current.filters).toMatchObject({ priority: 'high', due: 'overdue', q: 'rent', sort: 'dueDate', order: 'asc', page: 3 });
    expect(result.current.isFiltered).toBe(true);
  });

  it('falls back to defaults for junk in the URL instead of passing it on', () => {
    const { result } = renderHook(() => useTaskFilters(), { wrapper: wrap('/board?due=never&sort=password&page=-4&order=sideways') });
    expect(result.current.filters).toMatchObject({ due: undefined, sort: 'createdAt', order: 'desc', page: 1 });
    expect(result.current.isFiltered).toBe(false);
  });

  it('keeps a priority key from the URL as is (priorities are the user\'s own), but caps its length', () => {
    const { result } = renderHook(() => useTaskFilters(), { wrapper: wrap(`/board?priority=blocker_2`) });
    expect(result.current.filters.priority).toBe('blocker_2');
    const long = renderHook(() => useTaskFilters(), { wrapper: wrap(`/board?priority=${'x'.repeat(100)}`) });
    expect(long.result.current.filters.priority).toHaveLength(40);
  });

  it('goes back to page 1 when a filter changes, and keeps unrelated params like the open issue', () => {
    const { result } = renderHook(() => useTaskFilters(), { wrapper: wrap('/list?page=4&selected=abc') });
    act(() => result.current.update({ priority: 'low' }));
    expect(result.current.filters.page).toBe(1);
    expect(result.current.filters.priority).toBe('low');
  });

  it('reset clears only the filter params', () => {
    const { result } = renderHook(() => useTaskFilters(), { wrapper: wrap('/list?priority=high&q=x&selected=abc') });
    act(() => result.current.reset());
    expect(result.current.isFiltered).toBe(false);
  });
});
