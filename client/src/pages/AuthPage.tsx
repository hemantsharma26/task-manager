import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth, useSignIn } from '../api/auth';
import { ApiError } from '../api/http';
import { PasswordField } from '../components/PasswordField';
import { meetsPasswordRules } from '../lib/password';

const minutes = (seconds: number) => Math.max(1, Math.ceil(seconds / 60));

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user } = useAuth();
  const location = useLocation();
  const signIn = useSignIn(mode);
  // Coming from an invitation link, the address it was sent to is already filled in.
  const invitedEmail = (location.state as { email?: string } | null)?.email ?? '';
  const [form, setForm] = useState({ name: '', email: invitedEmail, password: '' });
  const [localError, setLocalError] = useState('');

  // Switching between the two pages starts clean: no leftover errors, and never a leftover password.
  useEffect(() => {
    setForm({ name: '', email: invitedEmail, password: '' });
    setLocalError('');
    signIn.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  if (user) return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/board'} replace />;

  const isRegister = mode === 'register';
  const error = signIn.error instanceof ApiError ? signIn.error : null;
  const locked = error?.status === 429;

  function submit(e: FormEvent) {
    e.preventDefault();
    setLocalError('');
    if (isRegister && !meetsPasswordRules(form.password)) return setLocalError('Choose a longer or more varied password. The checklist shows what is missing.');
    signIn.mutate(isRegister ? { name: form.name, email: form.email.trim(), password: form.password } : { email: form.email.trim(), password: form.password });
  }

  const set = (key: 'name' | 'email') => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <main className="auth">
      <form className="auth-card" onSubmit={submit} noValidate>
        <div className="brand brand-lg">
          <span className="brand-mark" aria-hidden="true">
            ✓
          </span>
          <span>Task Manager</span>
        </div>
        <h1>{isRegister ? 'Create your account' : 'Welcome back'}</h1>
        <p className="muted">{isRegister ? 'Keep track of everything you need to get done.' : 'Sign in to see your tasks.'}</p>

        <div aria-live="assertive">
          {locked && (
            <p className="form-error" role="alert">
              {error.message}
              {error.retryAfterSeconds ? ` Try again in about ${minutes(error.retryAfterSeconds)} ${minutes(error.retryAfterSeconds) === 1 ? 'minute' : 'minutes'}.` : ''}
            </p>
          )}
          {!locked && (error ? !error.fields.length : false) && (
            <p className="form-error" role="alert">
              {error!.message}
            </p>
          )}
          {localError && (
            <p className="form-error" role="alert">
              {localError}
            </p>
          )}
        </div>

        {isRegister && (
          <label className="field">
            <span>Name</span>
            <input value={form.name} onChange={set('name')} autoComplete="name" required maxLength={80} aria-invalid={!!error?.fieldMessage('name')} />
            {error?.fieldMessage('name') && <small className="field-error">{error.fieldMessage('name')}</small>}
          </label>
        )}

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={set('email')}
            autoComplete={isRegister ? 'email' : 'username'}
            autoCapitalize="none"
            spellCheck={false}
            inputMode="email"
            required
            maxLength={254}
            aria-invalid={!!error?.fieldMessage('email')}
          />
          {error?.fieldMessage('email') && <small className="field-error">{error.fieldMessage('email')}</small>}
        </label>

        <PasswordField
          label="Password"
          value={form.password}
          onChange={(password) => setForm((f) => ({ ...f, password }))}
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          showRules={isRegister}
          error={error?.fieldMessage('password')}
        />

        <button type="submit" className="btn btn-primary btn-block" disabled={signIn.isPending}>
          {signIn.isPending ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
        </button>

        <p className="auth-switch muted">
          {isRegister ? (
            <>
              Already have an account? <Link to="/login">Sign in</Link>
            </>
          ) : (
            <>
              New here? <Link to="/register">Create an account</Link>
            </>
          )}
        </p>
      </form>
    </main>
  );
}
