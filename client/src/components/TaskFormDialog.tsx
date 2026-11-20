import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../api/http';
import { PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL, type Task, type TaskInput } from '../api/types';

interface Props {
  /** null = create a new task, a Task = edit it. `undefined` keeps the dialog closed. */
  task: Task | null | undefined;
  onClose: () => void;
  onSubmit: (input: TaskInput) => Promise<unknown>;
}

const EMPTY: TaskInput = { title: '', description: '', status: 'todo', priority: 'medium', dueDate: null };

type Errors = Partial<Record<keyof TaskInput | 'form', string>>;

function validate(v: TaskInput): Errors {
  const errors: Errors = {};
  const title = v.title.trim();
  if (!title) errors.title = 'Give the task a title';
  else if (title.length > 120) errors.title = 'Keep the title under 120 characters';
  if (v.description.length > 2000) errors.description = 'Keep the description under 2000 characters';
  return errors;
}

export function TaskFormDialog({ task, onClose, onSubmit }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = task !== undefined;
  const [values, setValues] = useState<TaskInput>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  // Native <dialog>: gives us focus trapping, Escape-to-close and the backdrop for free.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      setValues(task ? { title: task.title, description: task.description, status: task.status, priority: task.priority, dueDate: task.dueDate } : EMPTY);
      setErrors({});
      setSaving(false);
      el.showModal();
    }
    if (!open && el.open) el.close();
  }, [open, task]);

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
      await onSubmit({ ...values, title: values.title.trim(), description: values.description.trim() });
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
    <dialog ref={ref} className="dialog" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <form onSubmit={handleSubmit} noValidate className="dialog-body">
        <h2>{task ? 'Edit task' : 'New task'}</h2>

        {errors.form && (
          <p className="form-error" role="alert">
            {errors.form}
          </p>
        )}

        <label className="field">
          <span>Title</span>
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

        <label className="field">
          <span>
            Description <span className="muted">(optional)</span>
          </span>
          <textarea rows={3} value={values.description} onChange={(e) => set('description', e.target.value)} aria-invalid={!!errors.description} />
          {errors.description && <small className="field-error">{errors.description}</small>}
        </label>

        <div className="field-row">
          <label className="field">
            <span>Priority</span>
            <select value={values.priority} onChange={(e) => set('priority', e.target.value as TaskInput['priority'])}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Status</span>
            <select value={values.status} onChange={(e) => set('status', e.target.value as TaskInput['status'])}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Due date</span>
            <input type="date" value={values.dueDate ?? ''} onChange={(e) => set('dueDate', e.target.value || null)} aria-invalid={!!errors.dueDate} />
            {errors.dueDate && <small className="field-error">{errors.dueDate}</small>}
          </label>
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : task ? 'Save changes' : 'Add task'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
