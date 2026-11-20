import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth, useSignIn } from '../api/auth';
import { ApiError } from '../api/http';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user } = useAuth();
  const location = useLocation();
  const signIn = useSignIn(mode);
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  if (user) return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />;

  const isRegister = mode === 'register';
  const error = signIn.error instanceof ApiError ? signIn.error : null;

  function submit(e: FormEvent) {
    e.preventDefault();
    signIn.mutate(isRegister ? form : { email: form.email, password: form.password });
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <main className="auth">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand brand-lg">
          <span className="brand-mark" aria-hidden="true">
            ✓
          </span>
          <span>Task Manager</span>
        </div>
        <h1>{isRegister ? 'Create your account' : 'Welcome back'}</h1>
        <p className="muted">{isRegister ? 'Keep track of everything you need to get done.' : 'Sign in to see your tasks.'}</p>

        {error && !error.fields.length && (
          <p className="form-error" role="alert">
            {error.message}
          </p>
        )}

        {isRegister && (
          <label className="field">
            <span>Name</span>
            <input value={form.name} onChange={set('name')} autoComplete="name" required maxLength={80} />
            {error?.fieldMessage('name') && <small className="field-error">{error.fieldMessage('name')}</small>}
          </label>
        )}

        <label className="field">
          <span>Email</span>
          <input type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
          {error?.fieldMessage('email') && <small className="field-error">{error.fieldMessage('email')}</small>}
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            required
            minLength={isRegister ? 8 : undefined}
            maxLength={72}
          />
          {isRegister && !error?.fieldMessage('password') && <small className="muted">At least 8 characters.</small>}
          {error?.fieldMessage('password') && <small className="field-error">{error.fieldMessage('password')}</small>}
        </label>

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
