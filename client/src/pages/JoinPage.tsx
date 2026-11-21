import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth, useSignOut } from '../api/auth';
import { ApiError } from '../api/http';
import { useAcceptInvitation, useInvitationInfo } from '../api/team';
import { rememberBoard } from '../api/workspace';
import { ROLE_HINT } from '../lib/permissions';
import { useToast } from '../components/Toast';

/**
 * Where the link in an invitation email lands. Anyone can see what they were invited to; accepting needs the account the invitation
 * was sent to. Signed out: sign in or create that account and come straight back here.
 */
export function JoinPage() {
  const { token = '' } = useParams();
  const { user, loading } = useAuth();
  const info = useInvitationInfo(token);
  const accept = useAcceptInvitation();
  const signOut = useSignOut();
  const navigate = useNavigate();
  const { notify } = useToast();

  const back = { from: `/join/${token}`, email: info.data?.email };

  const shell = (children: React.ReactNode) => (
    <main className="auth">
      <div className="auth-card">
        <div className="brand brand-lg">
          <span className="brand-mark" aria-hidden="true">
            ✓
          </span>
          <span>Task Manager</span>
        </div>
        {children}
      </div>
    </main>
  );

  if (info.isPending || loading) return shell(<div className="splash-inline" role="status" aria-label="Loading" />);

  if (info.isError) {
    const gone = info.error instanceof ApiError && info.error.status === 404;
    return shell(
      <>
        <h1>{gone ? 'This invitation is no longer valid' : 'Could not open this invitation'}</h1>
        <p className="muted">
          {gone ? 'It may already have been used, cancelled, or it has expired (links last 7 days). Ask the person who invited you to send a new one.' : 'Check your connection and try again.'}
        </p>
        <Link className="btn btn-block" to={user ? '/board' : '/login'}>
          {user ? 'Go to my board' : 'Sign in'}
        </Link>
      </>,
    );
  }

  const invite = info.data;
  const heading = (
    <>
      <h1>
        {invite.invitedBy} invited you to <span className="nowrap">{invite.boardName}</span>
      </h1>
      <p className="muted">
        You would join as <strong>{invite.roleLabel}</strong>: {ROLE_HINT[invite.role].toLowerCase()}.
      </p>
    </>
  );

  if (!user) {
    return shell(
      <>
        {heading}
        <p className="muted">
          This invitation is for <strong>{invite.email}</strong>. Sign in with that address, or create an account with it.
        </p>
        <Link className="btn btn-primary btn-block" to="/login" state={back}>
          Sign in
        </Link>
        <Link className="btn btn-block" to="/register" state={back}>
          Create an account
        </Link>
      </>,
    );
  }

  if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return shell(
      <>
        {heading}
        <p className="form-error" role="alert">
          This invitation was sent to <strong>{invite.email}</strong>, but you are signed in as <strong>{user.email}</strong>.
        </p>
        <button type="button" className="btn btn-primary btn-block" onClick={() => signOut.mutate()} disabled={signOut.isPending}>
          Sign out and use {invite.email}
        </button>
        <Link className="btn btn-block" to="/board">
          Stay signed in
        </Link>
      </>,
    );
  }

  return shell(
    <>
      {heading}
      {accept.isError && (
        <p className="form-error" role="alert">
          {accept.error instanceof ApiError ? accept.error.message : 'Could not accept the invitation. Please try again.'}
        </p>
      )}
      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={accept.isPending}
        onClick={() =>
          accept.mutate(token, {
            onSuccess: ({ workspaceId }) => {
              rememberBoard(user.id, workspaceId);
              notify('success', `You joined ${invite.boardName}`);
              navigate('/board', { replace: true });
            },
          })
        }
      >
        {accept.isPending ? 'Joining…' : 'Accept invitation'}
      </button>
      <Link className="btn btn-block" to="/board">
        Not now
      </Link>
    </>,
  );
}
