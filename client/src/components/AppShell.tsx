import { useState } from 'react';
import { NavLink, Outlet, useLocation, useOutletContext } from 'react-router-dom';
import { useAuth, useSignOut } from '../api/auth';
import { useMembers } from '../api/team';
import { useWorkspace } from '../api/workspace';
import { useUploadFiles } from '../api/attachments';
import { useCreateTask, useStats } from '../api/tasks';
import { useSelectedIssue, useTaskFilters } from '../hooks/useTaskFilters';
import { Avatar } from './Avatar';
import { BoardSwitcher } from './BoardSwitcher';
import { TeamDialog } from './TeamDialog';
import { AccountDialog } from './AccountDialog';
import { PriorityDialog } from './PriorityDialog';
import { CreateDialog } from './CreateDialog';
import { BoardIcon, FlagIcon, ListIcon, PlusIcon, UserIcon, UsersIcon } from './Icons';
import { IssueDialog } from './IssueDialog';
import { useToast } from './Toast';
import { prefetchListPage } from '../pages/lazy';

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
  const upload = useUploadFiles();
  const { notify } = useToast();
  const { search, pathname } = useLocation();
  const { filters, update, reset } = useTaskFilters();
  const { data: stats } = useStats();
  const [menu, setMenu] = useState(false);
  const [account, setAccount] = useState(false);
  const [priorities, setPriorities] = useState(false);
  const [team, setTeam] = useState(false);
  const { can } = useWorkspace();
  const members = useMembers().data?.members;

  if (!user) return null;

  const quick: { label: string; count?: number; active: boolean; apply: () => void; icon?: boolean; person?: boolean }[] = [
    { label: 'All issues', count: stats?.total, active: !filters.priority && !filters.due && !filters.assignee, apply: () => reset() },
    { label: 'Assigned to me', active: filters.assignee === 'me', person: true, apply: () => update({ assignee: 'me', priority: undefined, due: undefined }) },
    { label: 'Overdue', count: stats?.overdue, active: filters.due === 'overdue', apply: () => update({ due: 'overdue', priority: undefined, assignee: undefined }) },
    { label: 'Due this week', active: filters.due === 'week', apply: () => update({ due: 'week', priority: undefined, assignee: undefined }) },
    { label: 'High priority', active: filters.priority === 'high', icon: true, apply: () => update({ priority: 'high', due: undefined, assignee: undefined }) },
  ];

  return (
    <div className="shell">
      <header className="topnav">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">✓</span>
          <span className="brand-name">Task Manager</span>
        </div>
        {can('task.create') && (
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            <PlusIcon /> Create
          </button>
        )}

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
                <button type="button" role="menuitem" className="menu-item" onClick={() => { setMenu(false); setAccount(true); }}>
                  Account security
                </button>
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
          <BoardSwitcher />

          <nav className="side-nav" aria-label="Views">
            <NavLink to={{ pathname: '/board', search }} className="side-link">
              <BoardIcon /> Board
            </NavLink>
            <NavLink to={{ pathname: '/list', search }} className="side-link" onMouseEnter={prefetchListPage} onFocus={prefetchListPage}>
              <ListIcon /> List
            </NavLink>
          </nav>

          <p className="side-label">Quick filters</p>
          <div className="side-nav">
            {quick.map((q) => (
              <button key={q.label} type="button" className={`side-link side-btn ${q.active ? 'active' : ''}`} onClick={q.apply} aria-pressed={q.active}>
                {q.icon ? <FlagIcon /> : q.person ? <UserIcon /> : null}
                <span>{q.label}</span>
                {q.count !== undefined && <span className={`count ${q.label === 'Overdue' && q.count > 0 ? 'count-danger' : ''}`}>{q.count}</span>}
              </button>
            ))}
          </div>
          <p className="side-label">Customise</p>
          <div className="side-nav">
            <button type="button" className="side-link side-btn" onClick={() => setTeam(true)}>
              <UsersIcon />
              <span>Team</span>
              {members && <span className="count">{members.length}</span>}
            </button>
            {can('board.manage') && (
              <button type="button" className="side-link side-btn" onClick={() => setPriorities(true)}>
                <FlagIcon />
                <span>Priorities</span>
              </button>
            )}
          </div>
        </aside>

        <main className="main">
          {/* keyed by route, so switching between Board and List fades the new page in */}
          <div key={pathname} className="page-enter">
            <Outlet context={{ openIssue: select } satisfies ShellContext} />
          </div>
        </main>
      </div>

      <CreateDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSubmit={async (input, files) => {
          const res = await create.mutateAsync(input);
          if (files.length) {
            // The task exists now, so it is never lost if a file fails: say exactly what did not go up.
            try {
              await upload.mutateAsync({ taskId: res.task.id, files });
            } catch (e) {
              notify('error', `${res.task.key} was created, but the files were not attached: ${e instanceof Error ? e.message : 'upload failed'}`);
              return;
            }
          }
          notify('success', `${res.task.key} created`);
        }}
      />
      <AccountDialog open={account} onClose={() => setAccount(false)} />
      <PriorityDialog open={priorities} onClose={() => setPriorities(false)} />
      <TeamDialog open={team} onClose={() => setTeam(false)} />
      <IssueDialog id={selected} onClose={() => select(null)} />
    </div>
  );
}
