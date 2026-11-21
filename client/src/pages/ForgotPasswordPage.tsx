import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useForgotPassword } from '../api/auth';
import { ApiError } from '../api/http';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Step one of getting back in: say which address, and a link is emailed to it (if it has an account). */
export function ForgotPasswordPage() {
  const forgot = useForgotPassword();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL.test(value)) return setError('Enter the email address of your account');
    setError('');
    forgot.mutate(value, {
      onSuccess: () => setSentTo(value),
      onError: (err) => setError(err instanceof ApiError ? (err.status === 429 ? 'Too many attempts. Please wait a few minutes and try again.' : err.message) : 'Something went wrong. Please try again.'),
    });
  }

  return (
    <main className="auth">
      <div className="auth-card">
        <div className="brand brand-lg">
          <span className="brand-mark" aria-hidden="true">
            ✓
          </span>
          <span>Task Manager</span>
        </div>

        {sentTo ? (
          <>
            <h1>Check your email</h1>
            <p className="muted">
              If there is an account for <strong>{sentTo}</strong>, we have sent a link to choose a new password. It works once and for 30 minutes.
            </p>
            <p className="muted">Nothing there? Look in spam, or check that you typed the address you registered with.</p>
            <button type="button" className="btn btn-block" onClick={() => setSentTo('')}>
              Use a different address
            </button>
            <p className="auth-switch muted">
              <Link to="/login">Back to sign in</Link>
            </p>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            <h1>Forgot your password?</h1>
            <p className="muted">Enter your email and we will send you a link to choose a new one.</p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <label className="field">
              <span>Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} inputMode="email" maxLength={254} autoFocus required aria-invalid={!!error} />
            </label>
            <button type="submit" className="btn btn-primary btn-block" disabled={forgot.isPending}>
              {forgot.isPending ? 'Sending…' : 'Send reset link'}
            </button>
            <p className="auth-switch muted">
              <Link to="/login">Back to sign in</Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
