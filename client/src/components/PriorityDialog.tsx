import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MAX_PRIORITIES, useAddPriority, useDeletePriority, useMovePriority, usePriorities, useUpdatePriority } from '../api/priorities';
import { ApiError } from '../api/http';
import type { Priority } from '../api/types';
import { ColorPicker } from './ColorPicker';
import { ChevronLeftIcon, CloseIcon, FlagIcon, TrashIcon } from './Icons';
import { useToast } from './Toast';

const messageOf = (e: unknown) => (e instanceof ApiError ? (e.fieldMessage('name') ?? e.fieldMessage('color') ?? e.message) : 'Something went wrong. Please try again.');

/** Create, rename, recolour, reorder and delete your own priorities. */
export function PriorityDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { data: priorities = [] } = usePriorities();
  const add = useAddPriority();
  const move = useMovePriority();
  const { notify } = useToast();
  const [name, setName] = useState('');
  const [color, setColor] = useState<string | null>('#6e5dc6');
  const [error, setError] = useState('');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      setName('');
      setError('');
      el.showModal();
    }
    if (!open && el.open) el.close();
  }, [open]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Give the priority a name');
    add.mutate(
      { name: name.trim(), color: color ?? '#6e5dc6' },
      {
        onSuccess: () => {
          setName('');
          setError('');
          notify('success', 'Priority added');
        },
        onError: (err) => setError(messageOf(err)),
      },
    );
  }

  // "Up" means more important: it goes after the item two places earlier in the (least to most important) list.
  const moveBy = (index: number, direction: -1 | 1) => {
    const afterId = direction === 1 ? (priorities[index + 1]?.id ?? null) : (priorities[index - 2]?.id ?? null);
    move.mutate({ id: priorities[index]!.id, afterId }, { onError: (e) => notify('error', messageOf(e)) });
  };

  return (
    <dialog ref={ref} className="dialog dialog-sm" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <div className="dialog-body">
        <div className="dialog-head">
          <h2>Priorities</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <p className="muted">Make as many as you need. The list runs from least to most important, and that order is what "sort by priority" uses.</p>

        <ul className="prio-list">
          {priorities.map((p, i) => (
            <PriorityRow key={p.id} priority={p} index={i} count={priorities.length} others={priorities.filter((o) => o.key !== p.key)} onMove={(d) => moveBy(i, d)} />
          ))}
        </ul>

        <form className="stack" onSubmit={submit} noValidate>
          <h3>Add a priority</h3>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="add-prio">
            <label className="field grow">
              <span className="sr-only">New priority name</span>
              <input value={name} maxLength={24} placeholder="e.g. Urgent, Blocker, Someday" onChange={(e) => { setName(e.target.value); setError(''); }} />
            </label>
            <button type="submit" className="btn btn-primary" disabled={add.isPending || priorities.length >= MAX_PRIORITIES}>
              Add
            </button>
          </div>
          <ColorPicker label="Colour of the new priority" value={color} onChange={setColor} />
          {priorities.length >= MAX_PRIORITIES && <small className="muted">You have reached the limit of {MAX_PRIORITIES} priorities.</small>}
        </form>
      </div>
    </dialog>
  );
}

function PriorityRow({ priority, index, count, others, onMove }: { priority: Priority; index: number; count: number; others: Priority[]; onMove: (direction: -1 | 1) => void }) {
  const update = useUpdatePriority();
  const del = useDeletePriority();
  const { notify } = useToast();
  const [name, setName] = useState(priority.name);
  const [colouring, setColouring] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [moveTo, setMoveTo] = useState(others[0]?.key ?? '');

  useEffect(() => setName(priority.name), [priority.name]);
  useEffect(() => {
    if (!others.some((o) => o.key === moveTo)) setMoveTo(others[0]?.key ?? '');
  }, [others, moveTo]);

  const rename = () => {
    const next = name.trim();
    if (!next || next === priority.name) return setName(priority.name);
    update.mutate({ id: priority.id, changes: { name: next } }, { onError: (e) => { setName(priority.name); notify('error', messageOf(e)); } });
  };

  return (
    <li className="prio-row">
      <div className="prio-main">
        <button type="button" className="prio-swatch" style={{ color: priority.color }} aria-label={`Change colour of ${priority.name}`} aria-expanded={colouring} onClick={() => setColouring((c) => !c)}>
          <FlagIcon filled />
        </button>
        <input className="prio-name" value={name} maxLength={24} aria-label={`Name of ${priority.name}`} onChange={(e) => setName(e.target.value)} onBlur={rename} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
        <span className="prio-rank muted">{index === 0 ? 'Lowest' : index === count - 1 ? 'Highest' : ''}</span>
        <button type="button" className="icon-btn" aria-label={`Make ${priority.name} less important`} disabled={index === 0} onClick={() => onMove(-1)}>
          <span className="rot-up"><ChevronLeftIcon /></span>
        </button>
        <button type="button" className="icon-btn" aria-label={`Make ${priority.name} more important`} disabled={index === count - 1} onClick={() => onMove(1)}>
          <span className="rot-down"><ChevronLeftIcon /></span>
        </button>
        <button type="button" className="icon-btn" aria-label={`Delete ${priority.name}`} disabled={count <= 1} onClick={() => setDeleting((d) => !d)}>
          <TrashIcon />
        </button>
      </div>
      {colouring && <ColorPicker label={`Colour of ${priority.name}`} value={priority.color} onChange={(c) => c && update.mutate({ id: priority.id, changes: { color: c } })} />}
      {deleting && (
        <div className="prio-delete">
          <label className="field">
            <span>If tasks use it, move them to</span>
            <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
              {others.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <div className="quick-actions">
            <button type="button" className="btn btn-danger btn-sm" disabled={del.isPending} onClick={() => del.mutate({ id: priority.id, moveTo }, { onSuccess: () => notify('success', `${priority.name} deleted`), onError: (e) => notify('error', messageOf(e)) })}>
              Delete
            </button>
            <button type="button" className="btn btn-subtle btn-sm" onClick={() => setDeleting(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
