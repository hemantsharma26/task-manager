import { useState } from 'react';
import { NavLink, Outlet, useLocation, useOutletContext } from 'react-router-dom';
import { useAuth, useSignOut } from '../api/auth';
import { useCreateTask, useStats } from '../api/tasks';
import { useSelectedIssue, useTaskFilters } from '../hooks/useTaskFilters';
import { Avatar } from './Avatar';
import { CreateDialog } from './CreateDialog';
import { BoardIcon, FlagIcon, ListIcon, PlusIcon } from './Icons';
import { IssueDialog } from './IssueDialog';
import { useToast } from './Toast';

export interface ShellContext {
  openIssue: (id: string) => void;
}
export const useShell = () => useOutletContext<ShellContext>();

export function AppShell() {
  const { user } = useAuth();
  const signOut = useSignOut();
  const { selected, select } = useSelectedIssue();
  const [creating, setCreating] = useState(false);
  const create = useCreateTask();
  const { notify } = useToast();
  const { search } = useLocation();
  const { filters, update, reset } = useTaskFilters();
  const { data: stats } = useStats();
  const [menu, setMenu] = useState(false);

  if (!user) return null;

  const quick: { label: string; count?: number; active: boolean; apply: () => void; icon?: boolean }[] = [
    { label: 'All issues', count: stats?.total, active: !filters.priority && !filters.due, apply: () => reset() },
    { label: 'Overdue', count: stats?.overdue, active: filters.due === 'overdue', apply: () => update({ due: 'overdue', priority: undefined }) },
    { label: 'Due this week', active: filters.due === 'week', apply: () => update({ due: 'week', priority: undefined }) },
    { label: 'High priority', active: filters.priority === 'high', icon: true, apply: () => update({ priority: 'high', due: undefined }) },
  ];

  return (
    <div className="shell">
      <header className="topnav">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">✓</span>
          <span className="brand-name">Task Manager</span>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          <PlusIcon /> Create
        </button>

        <div className="topnav-right">
          <div className="usermenu">
            <button type="button" className="avatar-btn" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)} aria-label="Account menu">
              <Avatar name={user.name} size={30} />
            </button>
            {menu && (
              <div className="menu" role="menu" onMouseLeave={() => setMenu(false)}>
                <div className="menu-who">
                  <strong>{user.name}</strong>
                  <span className="muted">{user.email}</span>
                </div>
                <button type="button" role="menuitem" className="menu-item" onClick={() => signOut.mutate()} disabled={signOut.isPending}>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="shell-body">
        <aside className="sidebar" aria-label="Sidebar">
          <div className="project">
            <span className="project-icon" aria-hidden="true">TM</span>
            <div>
              <strong>My tasks</strong>
              <span className="muted">Personal project</span>
            </div>
          </div>

          <nav className="side-nav" aria-label="Views">
            <NavLink to={{ pathname: '/board', search }} className="side-link">
              <BoardIcon /> Board
            </NavLink>
            <NavLink to={{ pathname: '/list', search }} className="side-link">
              <ListIcon /> List
            </NavLink>
          </nav>

          <p className="side-label">Quick filters</p>
          <div className="side-nav">
            {quick.map((q) => (
              <button key={q.label} type="button" className={`side-link side-btn ${q.active ? 'active' : ''}`} onClick={q.apply} aria-pressed={q.active}>
                {q.icon ? <FlagIcon /> : null}
                <span>{q.label}</span>
                {q.count !== undefined && <span className={`count ${q.label === 'Overdue' && q.count > 0 ? 'count-danger' : ''}`}>{q.count}</span>}
              </button>
            ))}
          </div>
        </aside>

        <main className="main">
          <Outlet context={{ openIssue: select } satisfies ShellContext} />
        </main>
      </div>

      <CreateDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSubmit={async (input) => {
          const res = await create.mutateAsync(input);
          notify('success', `${res.task.key} created`);
        }}
      />
      <IssueDialog id={selected} owner={user.name} onClose={() => select(null)} />
    </div>
  );
}
