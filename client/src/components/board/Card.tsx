import { memo, type CSSProperties, type KeyboardEvent, type TouchEventHandler } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { isTempId } from '../../api/cache';
import { useColumnLookup } from '../../api/columns';
import { toneFor } from '../../lib/tone';
import type { Task } from '../../api/types';
import { Avatar } from '../Avatar';
import { DueBadge } from '../DueBadge';
import { mix } from '../../lib/color';
import { CheckIcon, GripIcon, PaperclipIcon } from '../Icons';
import { PriorityIcon } from '../PriorityIcon';

interface CardBodyProps {
  task: Task;
  today: string;
  owner: string;
}

/** The card face. Also used (without the sortable wrapper) as the floating copy while dragging. */
export function CardBody({ task, today, owner }: CardBodyProps) {
  const { isDone } = useColumnLookup();
  const done = isDone(task.status);
  return (
    <>
      <p className="card-title">{task.title}</p>
      {task.dueDate && (
        <div className="card-due">
          <DueBadge due={task.dueDate} time={task.dueTime} done={done} today={today} />
        </div>
      )}
      <div className="card-foot">
        <span className="card-meta">
          {done ? (
            <span className="card-done" title="Done">
              <CheckIcon size={14} />
            </span>
          ) : (
            <span title={`${task.priority} priority`}>
              <PriorityIcon priority={task.priority} />
            </span>
          )}
          <span className="card-key">{task.key}</span>
          {task.attachments?.length > 0 && (
            <span className="card-clip" title={`${task.attachments.length} ${task.attachments.length === 1 ? 'attachment' : 'attachments'}`}>
              <PaperclipIcon size={13} /> {task.attachments.length}
            </span>
          )}
        </span>
        <Avatar name={owner} size={22} />
      </div>
    </>
  );
}

interface CardProps extends CardBodyProps {
  onOpen: (id: string) => void;
  /** How the card appears when it first mounts. Cards that move between columns never animate in. */
  enter?: 'stagger' | 'pop';
  index: number;
}

// memo: during a drag the board re-renders on every pointer move, and only the cards that actually
// changed (their task object) should pay for it.
export const Card = memo(function Card({ task, today, owner, onOpen, enter, index }: CardProps) {
  // A card that is still being saved has no real id yet, so it can be neither opened nor dragged.
  const pending = isTempId(task.id);
  const { isDone, colorOf } = useColumnLookup();
  const done = isDone(task.status);
  const accent = toneFor(task.status, done, colorOf(task.status)).accent;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: pending,
    // The other cards slide out of the way on the same curve the floating card lands with.
    transition: { duration: 200, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
  });

  // Touch is deliberately NOT attached to the whole card. A touch listener on every card makes the browser wait
  // for JavaScript before it may start scrolling, which is what makes swiping the board feel sticky. Instead, touch
  // dragging starts from the grip handle (the only element with touch-action: none), and swiping anywhere else on
  // the card is pure native scrolling. Mouse and keyboard still work from the whole card.
  const { onTouchStart, ...cardListeners } = listeners ?? {};

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ['--i' as string]: Math.min(index, 8),
    ['--accent' as string]: accent,
    // A colour chosen for this task tints the whole card and its edge.
    ...(task.color ? { ['--task-color' as string]: task.color, ['--task-tint' as string]: mix(task.color, '#ffffff', 0.88) } : {}),
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    cardListeners.onKeyDown?.(e);
    if (e.key === 'Enter' && !e.defaultPrevented && !pending) onOpen(task.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-accent={accent ? '' : undefined}
      data-colored={task.color ? '' : undefined}
      className={`card ${enter ? `card-enter-${enter}` : ''} ${isDragging ? 'card-ghost' : ''} ${pending ? 'card-pending' : ''} ${done ? 'card-is-done' : ''}`}
      {...attributes}
      {...cardListeners}
      onKeyDown={onKeyDown}
      onClick={() => !pending && onOpen(task.id)}
      aria-label={`${task.key} ${task.title}`}
    >
      {!pending && (
        <span
          className="card-handle"
          aria-hidden="true"
          onTouchStart={onTouchStart as TouchEventHandler<HTMLSpanElement> | undefined}
          onClick={(e) => e.stopPropagation()}
        >
          <GripIcon />
        </span>
      )}
      <CardBody task={task} today={today} owner={owner} />
    </div>
  );
});
