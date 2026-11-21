import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useChangePassword, useRevokeSession, useSessions, useSignOut, useSignOutEverywhere, useSignOutOthers, type DeviceSession } from '../api/auth';
import { ApiError } from '../api/http';
import { passwordChangeProblems } from '../lib/password';
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
  const signOut = useSignOut();
  const everywhere = useSignOutEverywhere();
  const others = useSignOutOthers();
  const revoke = useRevokeSession();
  const sessions = useSessions(open);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState({ current: false, next: false, confirm: false });
  const [error, setError] = useState('');

  const problems = passwordChangeProblems({ current, next, confirm });
  const otherDevices = (sessions.data ?? []).filter((s) => !s.current).length;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      setCurrent('');
      setNext('');
      setConfirm('');
      setTouched({ current: false, next: false, confirm: false });
      setError('');
      change.reset();
      el.showModal();
    }
    if (!open && el.open) el.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function submit(e: FormEvent) {
    e.preventDefault();
    setTouched({ current: true, next: true, confirm: true });
    setError('');
    if (!problems.valid) return;
    change.mutate(
      { currentPassword: current, newPassword: next },
      {
        onSuccess: () => {
          notify('success', 'Password changed. Your other devices were signed out.');
          setCurrent('');
          setNext('');
          setConfirm('');
          setTouched({ current: false, next: false, confirm: false });
        },
        onError: (err) => setError(err instanceof ApiError ? (err.fields[0]?.message ?? err.message) : 'Could not change the password'),
      },
    );
  }

  const touch = (field: keyof typeof touched) => setTouched((t) => ({ ...t, [field]: true }));

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
          <div onBlur={() => touch('current')}>
            <PasswordField label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />
            {touched.current && problems.current && <small className="field-error">{problems.current}</small>}
          </div>
          <div onBlur={() => touch('next')}>
            <PasswordField label="New password" value={next} onChange={setNext} autoComplete="new-password" showRules />
            {touched.next && problems.next && <small className="field-error">{problems.next}</small>}
          </div>
          <div onBlur={() => touch('confirm')}>
            <PasswordField label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
            {(touched.confirm || (confirm && confirm.length >= next.length)) && problems.confirm && <small className="field-error">{problems.confirm}</small>}
          </div>
          <button type="submit" className="btn btn-primary" disabled={change.isPending || !problems.valid}>
            {change.isPending ? 'Changing…' : 'Change password'}
          </button>
          <small className="muted">Changing it signs out all your other devices.</small>
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

          <div className="signout-options">
            <button type="button" className="btn" disabled={signOut.isPending} onClick={() => signOut.mutate()}>
              {signOut.isPending ? 'Signing out…' : 'Sign out of this device'}
            </button>
            <button
              type="button"
              className="btn"
              disabled={others.isPending || otherDevices === 0}
              onClick={() => others.mutate(undefined, { onSuccess: () => notify('success', 'All your other devices were signed out'), onError: (e) => notify('error', e.message) })}
            >
              {others.isPending ? 'Signing out…' : `Sign out of other devices${otherDevices ? ` (${otherDevices})` : ''}`}
            </button>
            <button type="button" className="btn btn-danger" disabled={everywhere.isPending} onClick={() => everywhere.mutate()}>
              {everywhere.isPending ? 'Signing out…' : 'Sign out of all devices'}
            </button>
          </div>
          <small className="muted">“All devices” signs you out here too. Use it if you lost a device or think someone else has your password.</small>
        </section>
      </div>
    </dialog>
  );
}
