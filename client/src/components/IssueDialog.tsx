import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/http';
import { useDeleteTask, useTask, useUpdateTask } from '../api/tasks';
import { useColumnLookup } from '../api/columns';
import { usePriorities } from '../api/priorities';
import type { Task, TaskInput } from '../api/types';
import { toneFor } from '../lib/tone';
import { Avatar } from './Avatar';
import { DateTimeField } from './DateTimeField';
import { CloseIcon, TrashIcon } from './Icons';
import { PriorityIcon } from './PriorityIcon';
import { useToast } from './Toast';

interface Props {
  id: string | null;
  owner: string;
  onClose: () => void;
}

const when = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export function IssueDialog({ id, owner, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = !!id;
  // Keep showing the last issue while the dialog fades out, so its content does not vanish mid-animation.
  const lastId = useRef(id);
  if (id) lastId.current = id;
  const shown = id ?? lastId.current;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog ref={ref} className="dialog dialog-lg" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      {/* key: switching to another issue starts with fresh local edit state */}
      {shown && <IssueBody key={shown} id={shown} owner={owner} onClose={onClose} />}
    </dialog>
  );
}

function IssueBody({ id, owner, onClose }: { id: string; owner: string; onClose: () => void }) {
  const { data: task, isError, error, isPending } = useTask(id);
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const { notify } = useToast();
  const { columns, isDone, colorOf } = useColumnLookup();
  const { data: priorities = [] } = usePriorities();
  const [confirming, setConfirming] = useState(false);

  const save = (changes: Partial<TaskInput>) =>
    update.mutate({ id, changes }, { onError: (e) => notify('error', e instanceof ApiError ? (e.fields[0]?.message ?? e.message) : 'Could not save the change') });

  if (isPending) return <div className="dialog-body"><div className="skeleton-line" /><div className="skeleton-line" /></div>;

  if (isError || !task) {
    return (
      <div className="dialog-body" role="alert">
        <p>{error instanceof ApiError && error.status === 404 ? 'This task no longer exists.' : 'Could not load this task.'}</p>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="issue">
      <header className="issue-head">
        <span className="issue-crumb">
          <span className="issue-type" aria-hidden="true">✓</span> {task.key}
        </span>
        <div className="issue-head-actions">
          {confirming ? (
            <>
              <span className="muted">Delete {task.key}?</span>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => {
                  onClose();
                  remove.mutate(id, { onError: (e) => notify('error', e.message), onSuccess: () => notify('success', `${task.key} deleted`) });
                }}
              >
                Delete
              </button>
              <button type="button" className="btn btn-subtle btn-sm" onClick={() => setConfirming(false)} autoFocus>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className="icon-btn" aria-label={`Delete ${task.key}`} title="Delete" onClick={() => setConfirming(true)}>
              <TrashIcon />
            </button>
          )}
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
      </header>

      <div className="issue-grid">
        <div className="issue-main">
          <EditableTitle task={task} onSave={(title) => save({ title })} />
          <EditableDescription task={task} onSave={(description) => save({ description })} />
        </div>

        <aside className="issue-side" aria-label="Details">
          <h3>Details</h3>
          <dl>
            <dt>Status</dt>
            <dd>
              <select
                className="select select-status"
                style={{ background: toneFor(task.status, isDone(task.status), colorOf(task.status)).bg, color: toneFor(task.status, isDone(task.status), colorOf(task.status)).fg }}
                value={task.status}
                aria-label="Status"
                onChange={(e) => save({ status: e.target.value })}
              >
                {columns.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name}
                  </option>
                ))}
              </select>
            </dd>

            <dt>Priority</dt>
            <dd className="with-icon">
              <PriorityIcon priority={task.priority} />
              <select className="select select-plain" value={task.priority} aria-label="Priority" onChange={(e) => save({ priority: e.target.value })}>
                {priorities.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.name}
                  </option>
                ))}
              </select>
            </dd>

            <dt>Due date</dt>
            <dd>
              <DateTimeField label="Due date" value={{ date: task.dueDate, time: task.dueTime }} align="right" onChange={(v) => save({ dueDate: v.date, dueTime: v.time })} />
            </dd>

            <dt>Owner</dt>
            <dd className="with-icon">
              <Avatar name={owner} size={22} /> {owner}
            </dd>
          </dl>

          <div className="issue-dates muted">
            <p>Created {when.format(new Date(task.createdAt))}</p>
            <p>Updated {when.format(new Date(task.updatedAt))}</p>
            {task.completedAt && <p>Completed {when.format(new Date(task.completedAt))}</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}

function EditableTitle({ task, onSave }: { task: Task; onSave: (title: string) => void }) {
  const [value, setValue] = useState(task.title);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Follow changes that arrive from elsewhere, but never while the user is typing here.
  useEffect(() => {
    if (document.activeElement !== ref.current) setValue(task.title);
  }, [task.title]);

  const commit = () => {
    const next = value.trim();
    if (!next || next.length > 120) return setValue(task.title); // an empty or over-long title is not saved
    if (next !== task.title) onSave(next);
    setValue(next);
  };

  return (
    <textarea
      ref={ref}
      className="issue-title"
      rows={1}
      value={value}
      maxLength={120}
      aria-label="Title"
      onChange={(e) => setValue(e.target.value.replace(/\n/g, ' '))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === 'Escape') {
          e.stopPropagation();
          setValue(task.title);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

function EditableDescription({ task, onSave }: { task: Task; onSave: (description: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.description);

  useEffect(() => {
    if (!editing) setValue(task.description);
  }, [task.description, editing]);

  const commit = () => {
    setEditing(false);
    const next = value.trim();
    if (next.length <= 2000 && next !== task.description) onSave(next);
  };

  return (
    <section className="issue-desc">
      <h3>Description</h3>
      {editing ? (
        <>
          <textarea
            autoFocus
            rows={7}
            value={value}
            maxLength={2000}
            aria-label="Description"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                setValue(task.description);
                setEditing(false);
              }
            }}
          />
          <div className="quick-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={commit}>
              Save
            </button>
            <button type="button" className="btn btn-subtle btn-sm" onClick={() => { setValue(task.description); setEditing(false); }}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <button type="button" className={`desc-view ${task.description ? '' : 'desc-empty'}`} onClick={() => setEditing(true)}>
          {task.description || 'Add a description…'}
        </button>
      )}
    </section>
  );
}
