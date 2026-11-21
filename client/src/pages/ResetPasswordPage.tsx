import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useResetPassword } from '../api/auth';
import { ApiError } from '../api/http';
import { PasswordField } from '../components/PasswordField';
import { passwordChangeProblems } from '../lib/password';

/** Where the link in the reset email lands: choose a new password twice. Every device is signed out afterwards. */
export function ResetPasswordPage() {
  const { token = '' } = useParams();
  const reset = useResetPassword();
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');
  const [linkDead, setLinkDead] = useState(false);
  const [done, setDone] = useState(false);

  const problems = passwordChangeProblems({ next, confirm });

  function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!problems.valid) return;
    setError('');
    reset.mutate(
      { token, newPassword: next },
      {
        onSuccess: () => setDone(true),
        onError: (err) => {
          // A field-level complaint (too common, contains your name) is fixable here; a dead link is not.
          if (err instanceof ApiError && err.fields.length) return setError(err.fields[0]!.message);
          if (err instanceof ApiError && err.status === 400) return setLinkDead(true);
          setError(err instanceof ApiError && err.status === 429 ? 'Too many attempts. Please wait a few minutes and try again.' : 'Something went wrong. Please try again.');
        },
      },
    );
  }

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

  if (done) {
    return shell(
      <>
        <h1>Password changed</h1>
        <p className="muted">You were signed out everywhere. Sign in with your new password.</p>
        <Link className="btn btn-primary btn-block" to="/login">
          Sign in
        </Link>
      </>,
    );
  }

  if (linkDead) {
    return shell(
      <>
        <h1>This link no longer works</h1>
        <p className="muted">Reset links work once and for 30 minutes, and only the newest one you asked for. Request a new one.</p>
        <Link className="btn btn-primary btn-block" to="/forgot-password">
          Request a new link
        </Link>
      </>,
    );
  }

  return shell(
    <form onSubmit={submit} noValidate>
      <h1>Choose a new password</h1>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <PasswordField label="New password" value={next} onChange={setNext} autoComplete="new-password" showRules autoFocus />
      {touched && problems.next && <small className="field-error">{problems.next}</small>}
      <PasswordField label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      {(touched || confirm) && problems.confirm && <small className="field-error">{problems.confirm}</small>}
      <button type="submit" className="btn btn-primary btn-block" disabled={reset.isPending || !problems.valid}>
        {reset.isPending ? 'Saving…' : 'Change password'}
      </button>
    </form>,
  );
}
