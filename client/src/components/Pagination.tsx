interface Props {
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
}

export function Pagination({ page, totalPages, total, onPage }: Props) {
  if (totalPages <= 1) return <p className="muted pager-note">{total} {total === 1 ? 'task' : 'tasks'}</p>;
  return (
    <nav className="pager" aria-label="Pagination">
      <button type="button" className="btn btn-ghost" onClick={() => onPage(page - 1)} disabled={page <= 1}>
        ← Previous
      </button>
      <span className="muted">
        Page {page} of {totalPages} · {total} tasks
      </span>
      <button type="button" className="btn btn-ghost" onClick={() => onPage(page + 1)} disabled={page >= totalPages}>
        Next →
      </button>
    </nav>
  );
}
