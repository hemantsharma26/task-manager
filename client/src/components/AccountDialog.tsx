import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useChangePassword, useRevokeSession, useSessions, useSignOutEverywhere, type DeviceSession } from '../api/auth';
import { ApiError } from '../api/http';
import { meetsPasswordRules } from '../lib/password';
import { CloseIcon } from './Icons';
import { PasswordField } from './PasswordField';
import { useToast } from './Toast';

const when = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** A readable name for a device, from its user agent: "Chrome on macOS". */
function deviceName(userAgent: string) {
  const browser = /Edg\//.test(userAgent) ? 'Edge' : /Chrome\//.test(userAgent) ? 'Chrome' : /Firefox\//.test(userAgent) ? 'Firefox' : /Safari\//.test(userAgent) ? 'Safari' : 'Browser';
  const os = /Android/.test(userAgent) ? 'Android' : /iPhone|iPad/.test(userAgent) ? 'iOS' : /Mac OS X/.test(userAgent) ? 'macOS' : /Windows/.test(userAgent) ? 'Windows' : /Linux/.test(userAgent) ? 'Linux' : 'unknown device';
  return `${browser} on ${os}`;
}

export function AccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { notify } = useToast();
  const change = useChangePassword();
  const everywhere = useSignOutEverywhere();
  const revoke = useRevokeSession();
  const sessions = useSessions(open);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      setCurrent('');
      setNext('');
      setError('');
      change.reset();
      el.showModal();
    }
    if (!open && el.open) el.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!meetsPasswordRules(next)) return setError('The new password does not meet the rules yet.');
    change.mutate(
      { currentPassword: current, newPassword: next },
      {
        onSuccess: () => {
          notify('success', 'Password changed. Your other devices were signed out.');
          setCurrent('');
          setNext('');
        },
        onError: (err) => setError(err instanceof ApiError ? (err.fields[0]?.message ?? err.message) : 'Could not change the password'),
      },
    );
  }

  return (
    <dialog ref={ref} className="dialog dialog-sm" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <div className="dialog-body">
        <div className="dialog-head">
          <h2>Account security</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={submit} className="stack" noValidate>
          <h3>Change password</h3>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <PasswordField label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />
          <PasswordField label="New password" value={next} onChange={setNext} autoComplete="new-password" showRules />
          <button type="submit" className="btn btn-primary" disabled={change.isPending || !current || !next}>
            {change.isPending ? 'Changing…' : 'Change password'}
          </button>
        </form>

        <section className="stack">
          <h3>Where you are signed in</h3>
          {sessions.isPending && <div className="skeleton-line" />}
          {sessions.isError && <p className="muted">Could not load your devices.</p>}
          <ul className="device-list">
            {(sessions.data ?? []).map((s: DeviceSession) => (
              <li key={s.id}>
                <div>
                  <strong>{deviceName(s.userAgent)}</strong> {s.current && <span className="badge-current">This device</span>}
                  <div className="muted device-meta">
                    {s.ip || 'unknown address'} · last active {when.format(new Date(s.lastUsedAt))}
                  </div>
                </div>
                {!s.current && (
                  <button type="button" className="btn btn-subtle btn-sm" disabled={revoke.isPending} onClick={() => revoke.mutate(s.id, { onSuccess: () => notify('success', 'Device signed out') })}>
                    Sign out
                  </button>
                )}
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-danger" disabled={everywhere.isPending} onClick={() => everywhere.mutate()}>
            {everywhere.isPending ? 'Signing out…' : 'Sign out of all devices'}
          </button>
          <small className="muted">This signs you out here too. Use it if you lost a device or think someone else has your password.</small>
        </section>
      </div>
    </dialog>
  );
}
