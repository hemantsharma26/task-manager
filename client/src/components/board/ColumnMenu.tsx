import { useEffect, useRef, useState } from 'react';
import type { Column } from '../../api/types';
import { ColorPicker } from '../ColorPicker';
import { CheckIcon, DotsIcon } from '../Icons';

interface Props {
  column: Column;
  index: number;
  count: number;
  onRename: () => void;
  onMove: (direction: -1 | 1) => void;
  onToggleDone: () => void;
  onColor: (color: string | null) => void;
  onDelete: () => void;
}

/** The "..." in a column header: rename, move, mark as a finished column, delete. */
export function ColumnMenu({ column, index, count, onRename, onMove, onToggleDone, onColor, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [colouring, setColouring] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !root.current?.contains(e.target as Node)) {
        setOpen(false);
        setColouring(false);
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className="colmenu" ref={root}>
      <button type="button" className="icon-btn colmenu-btn" aria-haspopup="menu" aria-expanded={open} aria-label={`${column.name} column options`} onClick={() => setOpen((o) => !o)}>
        <DotsIcon />
      </button>
      {open && (
        <div className="menu colmenu-list" role="menu">
          <button type="button" role="menuitem" className="menu-item" onClick={run(onRename)}>
            Rename
          </button>
          <button type="button" role="menuitem" className="menu-item" disabled={index === 0} onClick={run(() => onMove(-1))}>
            Move left
          </button>
          <button type="button" role="menuitem" className="menu-item" disabled={index === count - 1} onClick={run(() => onMove(1))}>
            Move right
          </button>
          <button type="button" role="menuitemcheckbox" aria-checked={column.isDone} className="menu-item menu-check" onClick={run(onToggleDone)}>
            <span>Counts as done</span>
            {column.isDone && <CheckIcon size={14} />}
          </button>
          <button type="button" role="menuitem" className="menu-item menu-check" aria-expanded={colouring} onClick={() => setColouring((c) => !c)}>
            <span>Colour</span>
            <span className="menu-dot" style={{ background: column.color ?? '#b3b9c4' }} />
          </button>
          {colouring && (
            <div className="menu-color">
              <ColorPicker label={`Colour of ${column.name}`} value={column.color} allowDefault onChange={onColor} />
            </div>
          )}
          <div className="menu-sep" />
          <button type="button" role="menuitem" className="menu-item menu-danger" disabled={count <= 1} onClick={run(onDelete)}>
            Delete column…
          </button>
        </div>
      )}
    </div>
  );
}
