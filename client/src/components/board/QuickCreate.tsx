import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useCreateTask } from '../../api/tasks';
import type { TaskStatus } from '../../api/types';
import { PlusIcon } from '../Icons';
import { useToast } from '../Toast';

/** "+ Create" at the bottom of a column. Enter adds the card and keeps the box open for the next one. */
export function QuickCreate({ status }: { status: TaskStatus }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  const create = useCreateTask();
  const { notify } = useToast();

  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);

  const submit = () => {
    const text = title.trim();
    if (!text || create.isPending) return;
    create.mutate(
      { title: text, status },
      {
        onSuccess: () => setTitle(''),
        onError: (e) => notify('error', e.message),
      },
    );
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
    if (e.key === 'Escape') {
      setOpen(false);
      setTitle('');
    }
  };

  if (!open) {
    return (
      <button type="button" className="quick-open" onClick={() => setOpen(true)}>
        <PlusIcon /> Create
      </button>
    );
  }

  return (
    <div className="quick-form">
      <textarea
        ref={ref}
        rows={2}
        value={title}
        maxLength={120}
        placeholder="What needs to be done?"
        aria-label="Task title"
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => !title.trim() && setOpen(false)}
      />
      <div className="quick-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={submit} disabled={!title.trim() || create.isPending}>
          {create.isPending ? 'Adding…' : 'Add'}
        </button>
        <button type="button" className="btn btn-subtle btn-sm" onMouseDown={(e) => e.preventDefault()} onClick={() => { setOpen(false); setTitle(''); }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
