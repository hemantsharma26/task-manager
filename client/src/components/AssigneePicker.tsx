import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { Member } from '../api/types';
import { Avatar } from './Avatar';
import { AvatarStack } from './AvatarStack';
import { CheckIcon, ChevronDownIcon } from './Icons';

interface Props {
  members: Member[];
  /** Ids of the people currently chosen. */
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  label?: string;
  /** The signed-in person, so "Assign to me" can be offered. */
  meId?: string;
}

const POPOVER_MAX_HEIGHT = 320;
const SEARCH_FROM = 6;

/**
 * Pick any number of people from the board's team. The list is a pop-up placed from the button's position (so a dialog's
 * edge never clips it), it can be searched once the team is big, and it works from the keyboard: arrows move, Space or
 * Enter toggles, Escape closes.
 */
export function AssigneePicker({ members, value, onChange, disabled, label = 'Assignees', meId }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState<CSSProperties>({});
  const button = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const listId = useId();

  const chosen = useMemo(() => members.filter((m) => value.includes(m.userId)), [members, value]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? members.filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)) : members;
  }, [members, query]);

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  const close = (returnFocus = true) => {
    setOpen(false);
    setQuery('');
    if (returnFocus) button.current?.focus();
  };

  // Place the pop-up under the button, or above it when there is no room below.
  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const height = Math.min(POPOVER_MAX_HEIGHT, pop.current?.offsetHeight ?? POPOVER_MAX_HEIGHT);
    const up = below < height + 12 && r.top > below;
    setPlace({
      position: 'fixed',
      left: Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, 280) - 8)),
      width: Math.max(r.width, 280),
      ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
    });
  }, [open, shown.length]);

  // With no search box, the pop-up itself takes focus so the arrow keys work straight away.
  useEffect(() => {
    if (open && members.length <= SEARCH_FROM) pop.current?.focus();
  }, [open, members.length]);

  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!pop.current?.contains(t) && !button.current?.contains(t)) close(false);
    };
    const away = () => close(false);
    document.addEventListener('mousedown', outside);
    window.addEventListener('resize', away);
    return () => {
      document.removeEventListener('mousedown', outside);
      window.removeEventListener('resize', away);
    };
  }, [open]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // do not also close the dialog behind
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(shown.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if ((e.key === 'Enter' || (e.key === ' ' && !query)) && shown[active]) {
      e.preventDefault();
      toggle(shown[active]!.userId);
    }
  };

  return (
    <div className="assignee-picker">
      <button
        ref={button}
        type="button"
        className="assignee-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${chosen.length ? chosen.map((c) => c.name).join(', ') : 'nobody'}`}
        disabled={disabled}
        onClick={() => {
          setActive(0);
          setOpen((o) => !o);
        }}
      >
        <AvatarStack people={chosen.map((m) => ({ id: m.userId, name: m.name, email: m.email }))} size={24} max={4} />
        <span className="assignee-text">{chosen.length === 0 ? 'Unassigned' : chosen.length === 1 ? chosen[0]!.name : `${chosen.length} people`}</span>
        {!disabled && <ChevronDownIcon size={14} />}
      </button>

      {open && (
        <div ref={pop} className="assignee-pop" style={place} tabIndex={-1} onKeyDown={onKey}>
          {members.length > SEARCH_FROM && (
            <input
              className="assignee-search"
              type="search"
              placeholder="Search people"
              aria-label="Search people"
              value={query}
              autoFocus
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
            />
          )}
          <ul id={listId} role="listbox" aria-multiselectable="true" aria-label={label} className="assignee-list">
            {shown.map((m, i) => {
              const on = value.includes(m.userId);
              return (
                <li key={m.userId} role="option" aria-selected={on} className={`assignee-option ${i === active ? 'is-active' : ''}`} onMouseEnter={() => setActive(i)} onClick={() => toggle(m.userId)}>
                  <Avatar name={m.name} size={26} />
                  <span className="assignee-who">
                    <strong>
                      {m.name}
                      {m.userId === meId && <span className="muted"> (you)</span>}
                    </strong>
                    <span className="muted">{m.email}</span>
                  </span>
                  <span className={`assignee-check ${on ? 'is-on' : ''}`} aria-hidden="true">
                    {on && <CheckIcon size={13} />}
                  </span>
                </li>
              );
            })}
            {shown.length === 0 && <li className="assignee-none muted">No one matches “{query}”.</li>}
          </ul>
          <div className="assignee-foot">
            {meId && !value.includes(meId) && members.some((m) => m.userId === meId) ? (
              <button type="button" className="link-btn" onClick={() => toggle(meId)}>
                Assign to me
              </button>
            ) : (
              <span />
            )}
            {value.length > 0 && (
              <button type="button" className="link-btn" onClick={() => onChange([])}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
