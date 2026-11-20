import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../api/workspace';
import { ROLE_LABEL } from '../lib/permissions';
import { CheckIcon, ChevronDownIcon } from './Icons';

const initials = (name: string) =>
  name
    .replace(/'s tasks$/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('') || 'TM';

/** The board on screen, and a menu to move to another one (your own, or one you were invited to). */
export function BoardSwitcher() {
  const { current, all, isShared, switchTo } = useWorkspace();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const several = all.length > 1;

  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const face = (
    <>
      <span className={`project-icon ${isShared ? 'project-icon-shared' : ''}`} aria-hidden="true">
        {initials(current.name)}
      </span>
      <span className="project-text">
        <strong>{current.name}</strong>
        <span className="muted">{isShared ? `Shared · ${ROLE_LABEL[current.role]}` : 'Your board'}</span>
      </span>
    </>
  );

  if (!several) return <div className="project">{face}</div>;

  return (
    <div className="project-switch" ref={wrap}>
      <button type="button" className="project project-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {face}
        <ChevronDownIcon size={14} />
      </button>
      {open && (
        <div className="menu menu-left" role="menu" aria-label="Boards">
          {all.map((w) => (
            <button
              key={w.id}
              type="button"
              role="menuitemradio"
              aria-checked={w.id === current.id}
              className="menu-item menu-board"
              onClick={() => {
                setOpen(false);
                switchTo(w.id);
              }}
            >
              <span className="board-check">{w.id === current.id && <CheckIcon size={13} />}</span>
              <span className="project-text">
                <strong>{w.name}</strong>
                <span className="muted">{w.role === 'owner' ? 'Your board' : ROLE_LABEL[w.role]}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
