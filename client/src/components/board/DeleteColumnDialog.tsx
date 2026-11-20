import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../api/http';
import { useDeleteColumn } from '../../api/columns';
import type { Column } from '../../api/types';
import { useToast } from '../Toast';

interface Props {
  column: Column | null;
  /** How many tasks the column holds right now. */
  taskCount: number;
  others: Column[];
  onClose: () => void;
}

export function DeleteColumnDialog({ column, taskCount, others, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const del = useDeleteColumn();
  const { notify } = useToast();
  const [moveTo, setMoveTo] = useState('');
  const [error, setError] = useState('');

  // Keep the last column around while the dialog fades out.
  const last = useRef(column);
  if (column) last.current = column;
  const shown = column ?? last.current;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (column && !el.open) {
      setMoveTo(others[0]?.key ?? '');
      setError('');
      el.showModal();
    }
    if (!column && el.open) el.close();
  }, [column, others]);

  const confirm = () => {
    if (!column) return;
    del.mutate(
      { id: column.id, moveTo: taskCount > 0 ? moveTo : undefined },
      {
        onSuccess: () => {
          notify('success', `Column "${column.name}" deleted`);
          onClose();
        },
        onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not delete the column'),
      },
    );
  };

  return (
    <dialog ref={ref} className="dialog dialog-sm" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <div className="dialog-body">
        <h2>Delete “{shown?.name}”?</h2>
        {taskCount > 0 ? (
          <>
            <p>
              This column has <strong>{taskCount}</strong> {taskCount === 1 ? 'task' : 'tasks'}. Choose where they should go. They keep their order and land below what is already there.
            </p>
            <label className="field">
              <span>Move tasks to</span>
              <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                {others.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name}
                    {c.isDone ? ' (counts as done)' : ''}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <p>The column is empty, so nothing else changes.</p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="btn btn-subtle" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={confirm} disabled={del.isPending || (taskCount > 0 && !moveTo)}>
            {del.isPending ? 'Deleting…' : 'Delete column'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
