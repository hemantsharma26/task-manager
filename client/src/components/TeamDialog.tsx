import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../api/auth';
import { ApiError } from '../api/http';
import { useChangeRole, useInvitations, useInvite, useMembers, useRemoveMember, useRevokeInvitation } from '../api/team';
import type { Member, MemberRole } from '../api/types';
import { useWorkspace } from '../api/workspace';
import { ROLE_HINT, ROLE_LABEL } from '../lib/permissions';
import { Avatar } from './Avatar';
import { CloseIcon, MailIcon, TrashIcon } from './Icons';
import { useToast } from './Toast';

const ROLES: MemberRole[] = ['admin', 'editor', 'viewer'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const daysLeft = (iso: string) => Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
const messageOf = (e: unknown) => (e instanceof ApiError ? (e.fieldMessage('email') ?? e.fieldMessage('role') ?? e.message) : 'Something went wrong. Please try again.');

/**
 * The people on this board. Anyone can see who is on it; the owner and admins can invite people (an email with a private link),
 * change roles and remove people. A person who is not the owner can leave. Only people who accepted an invitation can be assigned tasks.
 */
export function TeamDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { user } = useAuth();
  const { current, can, switchTo } = useWorkspace();
  const manage = can('team.manage');
  const members = useMembers();
  const invitations = useInvitations(open && manage);
  const invite = useInvite();
  const revoke = useRevokeInvitation();
  const changeRole = useChangeRole();
  const remove = useRemoveMember();
  const { notify } = useToast();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('editor');
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      setEmail('');
      setError('');
      setConfirming(null);
      el.showModal();
    }
    if (!open && el.open) el.close();
  }, [open]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!EMAIL.test(value)) return setError('Enter a valid email address');
    setError('');
    invite.mutate(
      { email: value, role },
      {
        onSuccess: () => {
          setEmail('');
          notify('success', `Invitation sent to ${value}`);
        },
        onError: (err) => setError(messageOf(err)),
      },
    );
  }

  const leave = (m: Member) =>
    remove.mutate(m.userId, {
      onSuccess: () => {
        notify('success', `You left ${current.name}`);
        if (user) switchTo(user.id);
        onClose();
      },
      onError: (err) => notify('error', messageOf(err)),
    });

  const kick = (m: Member) =>
    remove.mutate(m.userId, {
      onSuccess: () => {
        setConfirming(null);
        notify('success', `${m.name} was removed`);
      },
      onError: (err) => notify('error', messageOf(err)),
    });

  return (
    <dialog ref={ref} className="dialog dialog-md" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <div className="dialog-body">
        <div className="dialog-head">
          <h2>Team</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <p className="muted">
          People on <strong>{current.name}</strong>. Once someone accepts their invitation they show up in the assignee list, and a task can have as many assignees as you like.
        </p>

        {members.isError && (
          <p className="form-error" role="alert">
            Could not load the team.
          </p>
        )}

        <ul className="team-list" aria-label="Members">
          {(members.data?.members ?? []).map((m) => {
            const isMe = m.userId === user?.id;
            return (
              <li key={m.userId} className="team-row">
                <Avatar name={m.name} size={32} />
                <span className="team-who">
                  <strong>
                    {m.name}
                    {isMe && <span className="you-tag">You</span>}
                  </strong>
                  <span className="muted">{m.email}</span>
                </span>

                {manage && !m.isOwner ? (
                  <select
                    className="select select-sm"
                    aria-label={`Role of ${m.name}`}
                    value={m.role}
                    onChange={(e) => changeRole.mutate({ userId: m.userId, role: e.target.value as MemberRole }, { onError: (err) => notify('error', messageOf(err)) })}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={`role-badge role-${m.role}`}>{ROLE_LABEL[m.role]}</span>
                )}

                {!m.isOwner && manage && !isMe &&
                  (confirming === m.userId ? (
                    <span className="team-confirm">
                      <button type="button" className="btn btn-danger btn-sm" disabled={remove.isPending} onClick={() => kick(m)}>
                        Remove
                      </button>
                      <button type="button" className="btn btn-subtle btn-sm" onClick={() => setConfirming(null)} autoFocus>
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button type="button" className="icon-btn" aria-label={`Remove ${m.name}`} title="Remove from the team" onClick={() => setConfirming(m.userId)}>
                      <TrashIcon />
                    </button>
                  ))}
                {isMe && !m.isOwner && (
                  <button type="button" className="btn btn-subtle btn-sm" disabled={remove.isPending} onClick={() => leave(m)}>
                    Leave
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {manage ? (
          <>
            <form className="stack" onSubmit={submit} noValidate>
              <h3>Invite someone</h3>
              <p className="muted">They get an email with a private link. It works for 7 days, once, and only for that email address, so they need an account with it (they can create one from the link).</p>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="invite-row">
                <label className="field grow">
                  <span className="sr-only">Email address</span>
                  <input type="email" inputMode="email" autoComplete="off" placeholder="name@company.com" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!error} />
                </label>
                <label className="field">
                  <span className="sr-only">Role</span>
                  <select value={role} onChange={(e) => setRole(e.target.value as MemberRole)} aria-label="Role">
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="btn btn-primary" disabled={invite.isPending}>
                  <MailIcon size={14} /> {invite.isPending ? 'Sending…' : 'Send invite'}
                </button>
              </div>
              <p className="muted role-hint">{ROLE_HINT[role]}</p>
            </form>

            {(invitations.data?.length ?? 0) > 0 && (
              <section className="stack">
                <h3>Waiting to join</h3>
                <ul className="team-list" aria-label="Pending invitations">
                  {invitations.data!.map((i) => (
                    <li key={i.id} className="team-row">
                      <span className="avatar avatar-empty" style={{ width: 32, height: 32 }}>
                        <MailIcon size={16} />
                      </span>
                      <span className="team-who">
                        <strong>{i.email}</strong>
                        <span className="muted">
                          {ROLE_LABEL[i.role]} · expires in {daysLeft(i.expiresAt)} {daysLeft(i.expiresAt) === 1 ? 'day' : 'days'}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="btn btn-subtle btn-sm"
                        disabled={revoke.isPending}
                        onClick={() => revoke.mutate(i.id, { onSuccess: () => notify('success', 'Invitation cancelled'), onError: (err) => notify('error', messageOf(err)) })}
                      >
                        Cancel
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : (
          <p className="muted">You are {current.role === 'viewer' ? 'a viewer' : `an ${current.role}`} on this board, so only the owner and admins can invite people or change roles.</p>
        )}

        <dl className="role-legend">
          {ROLES.map((r) => (
            <div key={r}>
              <dt>
                <span className={`role-badge role-${r}`}>{ROLE_LABEL[r]}</span>
              </dt>
              <dd className="muted">{ROLE_HINT[r]}</dd>
            </div>
          ))}
        </dl>
      </div>
    </dialog>
  );
}
