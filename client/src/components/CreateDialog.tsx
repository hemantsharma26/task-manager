import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../api/http';
import { useColumns } from '../api/columns';
import { useAuth } from '../api/auth';
import { usePriorities } from '../api/priorities';
import { useMembers } from '../api/team';
import { useWorkspace } from '../api/workspace';
import type { TaskInput } from '../api/types';
import { AssigneePicker } from './AssigneePicker';
import { ColorPicker } from './ColorPicker';
import { DateTimeField } from './DateTimeField';
import { FilePicker } from './FilePicker';
import { NoteEditor } from './NoteEditor';
import { CloseIcon } from './Icons';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with the new task's fields and the files chosen to go with it. */
  onSubmit: (input: TaskInput, files: File[]) => Promise<unknown>;
}

const EMPTY: TaskInput = { title: '', description: '', status: 'todo', priority: 'medium', dueDate: null, dueTime: null, startTime: null, color: null, assignees: [] };

type Errors = Partial<Record<keyof TaskInput | 'form', string>>;

function validate(v: TaskInput): Errors {
  const errors: Errors = {};
  const title = v.title.trim();
  if (!title) errors.title = 'Give the task a title';
  else if (title.length > 120) errors.title = 'Keep the title under 120 characters';
  if (v.description.replace(/<[^>]*>/g, '').length > 5000) errors.description = 'Keep the notes under 5000 characters';
  return errors;
}

export function CreateDialog({ open, onClose, onSubmit }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const { data: columns = [] } = useColumns();
  const { data: priorities = [] } = usePriorities();
  const { user } = useAuth();
  const { can } = useWorkspace();
  const members = useMembers().data?.members ?? [];
  const [values, setValues] = useState<TaskInput>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  // Native <dialog>: focus trapping, Escape-to-close and the backdrop come for free.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      // New tasks start in the first column of the board.
      // New tasks start in the first column, with Medium (or the middle priority if Medium was deleted).
      const middle = priorities.find((p) => p.key === 'medium') ?? priorities[Math.floor(priorities.length / 2)];
      setValues({ ...EMPTY, status: columns[0]?.key ?? 'todo', priority: middle?.key ?? 'medium' });
      setErrors({});
      setSaving(false);
      setFiles([]);
      el.showModal();
    }
    if (!open && el.open) el.close();
  }, [open]);

  const set = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validate(values);
    if (Object.keys(found).length) return setErrors(found);

    setSaving(true);
    try {
      await onSubmit({ ...values, title: values.title.trim() }, files);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        const fromServer: Errors = {};
        for (const f of err.fields) fromServer[f.field as keyof TaskInput] = f.message;
        setErrors(Object.keys(fromServer).length ? fromServer : { form: err.message });
      } else {
        setErrors({ form: 'Could not save the task. Please try again.' });
      }
      setSaving(false);
    }
  }

  return (
    <dialog ref={ref} className="dialog dialog-sm" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <form onSubmit={handleSubmit} noValidate className="dialog-body">
        <div className="dialog-head">
          <h2>Create task</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        {errors.form && (
          <p className="form-error" role="alert">
            {errors.form}
          </p>
        )}

        <label className="field">
          <span>Summary</span>
          <input
            value={values.title}
            onChange={(e) => set('title', e.target.value)}
            maxLength={130}
            autoFocus
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? 'err-title' : undefined}
            placeholder="What needs to be done?"
          />
          {errors.title && (
            <small id="err-title" className="field-error">
              {errors.title}
            </small>
          )}
        </label>

        <div className="field">
          <span>
            Notes <span className="muted">(optional)</span>
          </span>
          <NoteEditor label="Notes" value={values.description} onChange={(html) => set('description', html)} minHeight={120} />
          {errors.description && <small className="field-error">{errors.description}</small>}
        </div>

        <FilePicker files={files} onChange={setFiles} />

        <div className="field">
          <span>
            Card colour <span className="muted">(optional)</span>
          </span>
          <ColorPicker label="Card colour" value={values.color} allowDefault onChange={(color) => set('color', color)} />
        </div>

        {can('task.assign') && (
          <div className="field">
            <span>
              Assignees <span className="muted">(optional)</span>
            </span>
            <AssigneePicker members={members} value={values.assignees} meId={user?.id} onChange={(ids) => set('assignees', ids)} />
          </div>
        )}

        <div className="field-row">
          <label className="field">
            <span>Priority</span>
            <select value={values.priority} onChange={(e) => set('priority', e.target.value)}>
              {priorities.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Status</span>
            <select value={values.status} onChange={(e) => set('status', e.target.value)}>
              {columns.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <div className="field">
            <span>Due date</span>
            <DateTimeField label="Due date" value={{ date: values.dueDate, startTime: values.startTime, time: values.dueTime }} align="right" onChange={(v) => setValues((cur) => ({ ...cur, dueDate: v.date, startTime: v.startTime, dueTime: v.time }))} />
            {errors.dueDate && <small className="field-error">{errors.dueDate}</small>}
          </div>
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn btn-subtle" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? (files.length ? 'Creating and uploading…' : 'Creating…') : 'Create'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
