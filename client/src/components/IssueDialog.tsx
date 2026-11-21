import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/http';
import { useDeleteTask, useTask, useUpdateTask } from '../api/tasks';
import { useColumnLookup } from '../api/columns';
import { usePriorities } from '../api/priorities';
import { useMembers } from '../api/team';
import { useWorkspace } from '../api/workspace';
import { useAuth } from '../api/auth';
import { todayLocal } from '../lib/dates';
import type { Task, TaskInput } from '../api/types';
import { toneFor } from '../lib/tone';
import { AssigneePicker } from './AssigneePicker';
import { DueBadge } from './DueBadge';
import { AttachmentGallery } from './AttachmentGallery';
import { ColorPicker } from './ColorPicker';
import { DateTimeField } from './DateTimeField';
import { NoteEditor } from './NoteEditor';
import { CloseIcon, TrashIcon } from './Icons';
import { PriorityIcon } from './PriorityIcon';
import { useToast } from './Toast';

interface Props {
  id: string | null;
  onClose: () => void;
}

const when = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export function IssueDialog({ id, onClose }: Props) {
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
      {shown && <IssueBody key={shown} id={shown} onClose={onClose} />}
    </dialog>
  );
}

function IssueBody({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: task, isError, error, isPending } = useTask(id);
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const { notify } = useToast();
  const { columns, isDone, colorOf } = useColumnLookup();
  const { data: priorities = [] } = usePriorities();
  const [confirming, setConfirming] = useState(false);
  const { user } = useAuth();
  const { can } = useWorkspace();
  const members = useMembers().data?.members ?? [];
  // What this person may do on this board decides which fields they can change.
  const canEdit = can('task.edit');
  const canDelete = can('task.delete');
  const canAssign = can('task.assign');

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
          {!canDelete ? null : confirming ? (
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
          <EditableTitle task={task} readOnly={!canEdit} onSave={(title) => save({ title })} />
          <EditableNote task={task} readOnly={!canEdit} onSave={(description) => save({ description })} />
          <AttachmentGallery task={task} canEdit={canEdit} />
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
                disabled={!canEdit}
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
              <select className="select select-plain" value={task.priority} aria-label="Priority" disabled={!canEdit} onChange={(e) => save({ priority: e.target.value })}>
                {priorities.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.name}
                  </option>
                ))}
              </select>
            </dd>

            <dt>Due date</dt>
            <dd>
              {canEdit ? (
                <DateTimeField label="Due date" value={{ date: task.dueDate, startTime: task.startTime, time: task.dueTime }} align="right" onChange={(v) => save({ dueDate: v.date, dueTime: v.time, startTime: v.startTime })} />
              ) : task.dueDate ? (
                <DueBadge due={task.dueDate} time={task.dueTime} startTime={task.startTime} done={isDone(task.status)} today={todayLocal()} />
              ) : (
                <span className="muted">None</span>
              )}
            </dd>

            {canEdit && (
              <>
                <dt>Card colour</dt>
                <dd className="color-dd">
                  <ColorPicker label="Card colour" value={task.color} allowDefault onChange={(color) => save({ color })} />
                </dd>
              </>
            )}

            <dt>Assignees</dt>
            <dd>
              <AssigneePicker
                members={members}
                value={task.assignees.map((a) => a.id)}
                meId={user?.id}
                disabled={!canAssign}
                onChange={(ids) => save({ assignees: ids })}
              />
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

function EditableTitle({ task, onSave, readOnly }: { task: Task; onSave: (title: string) => void; readOnly: boolean }) {
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
      readOnly={readOnly}
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

/** The task's notepad. It saves by itself a moment after you stop typing, and when you click away. */
function EditableNote({ task, onSave, readOnly }: { task: Task; onSave: (html: string) => void; readOnly: boolean }) {
  const [html, setHtml] = useState(task.description);
  const [state, setState] = useState<'saved' | 'saving' | 'editing'>('saved');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(task.description);

  // Another copy of the task changed (a refetch): follow it, unless there are edits waiting to be saved.
  useEffect(() => {
    if (state === 'saved' && task.description !== html) {
      setHtml(task.description);
      latest.current = task.description;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.description]);

  const flush = (next: string) => {
    clearTimeout(timer.current);
    if (next === latest.current) return setState('saved');
    latest.current = next;
    setState('saving');
    onSave(next);
    setTimeout(() => setState('saved'), 600);
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <section className="issue-desc">
      <h3>
        Notes {!readOnly && <span className={`save-state save-${state}`}>{state === 'saved' ? 'Saved' : state === 'saving' ? 'Saving…' : 'Editing…'}</span>}
      </h3>
      <NoteEditor
        label="Notes"
        readOnly={readOnly}
        value={html}
        placeholder="Write your notes here: headings, lists, colours, fonts…"
        minHeight={200}
        onChange={(next) => {
          setHtml(next);
          setState('editing');
          clearTimeout(timer.current);
          timer.current = setTimeout(() => flush(next), 1200);
        }}
        onBlur={() => flush(html)}
      />
    </section>
  );
}
