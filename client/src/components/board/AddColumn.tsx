import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MAX_COLUMNS, useAddColumn } from '../../api/columns';
import { ApiError } from '../../api/http';
import { ColorPicker } from '../ColorPicker';
import { PlusIcon } from '../Icons';
import { useToast } from '../Toast';

/** "+ Add column" at the right end of the board. */
export function AddColumn({ count, disabled, onAdded }: { count: number; disabled?: boolean; onAdded: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [isDone, setIsDone] = useState(false);
  const [color, setColor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const add = useAddColumn();
  const { notify } = useToast();

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    setName('');
    setIsDone(false);
    setColor(null);
    setError('');
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError('Give the column a name');
    add.mutate(
      { name: trimmed, isDone, color },
      {
        onSuccess: () => {
          notify('success', `Column "${trimmed}" added`);
          onAdded(trimmed);
          close();
        },
        onError: (err) => setError(err instanceof ApiError ? (err.fieldMessage('name') ?? err.message) : 'Could not add the column'),
      },
    );
  };

  if (count >= MAX_COLUMNS) {
    return (
      <div className="add-column">
        <p className="muted add-limit">You can have up to {MAX_COLUMNS} columns.</p>
      </div>
    );
  }

  return (
    <div className="add-column">
      {open ? (
        <form className="add-form" onSubmit={submit} noValidate onKeyDown={(e) => e.key === 'Escape' && close()}>
          <label className="sr-only" htmlFor="new-column-name">
            Column name
          </label>
          <input
            id="new-column-name"
            ref={input}
            value={name}
            maxLength={30}
            placeholder="Column name, e.g. QA review"
            aria-invalid={!!error}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
          />
          <label className="check">
            <input type="checkbox" checked={isDone} onChange={(e) => setIsDone(e.target.checked)} />
            <span>Counts as done</span>
          </label>
          <ColorPicker label="Column colour" value={color} allowDefault onChange={setColor} />
          {error && (
            <small className="field-error" role="alert">
              {error}
            </small>
          )}
          <div className="quick-actions">
            <button type="submit" className="btn btn-primary btn-sm" disabled={add.isPending}>
              {add.isPending ? 'Adding…' : 'Add column'}
            </button>
            <button type="button" className="btn btn-subtle btn-sm" onClick={close}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="add-open" disabled={disabled} onClick={() => setOpen(true)}>
          <PlusIcon /> Add column
        </button>
      )}
    </div>
  );
}
