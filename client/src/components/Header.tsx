import { useSignOut } from '../api/auth';
import type { User } from '../api/types';

export function Header({ user }: { user: User }) {
  const signOut = useSignOut();
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          ✓
        </span>
        <span>Task Manager</span>
      </div>
      <div className="topbar-user">
        <span className="muted" title={user.email}>
          {user.name}
        </span>
        <button type="button" className="btn btn-ghost" onClick={() => signOut.mutate()} disabled={signOut.isPending}>
          Sign out
        </button>
      </div>
    </header>
  );
}
