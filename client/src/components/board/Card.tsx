import { memo, type CSSProperties, type KeyboardEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { isTempId } from '../../api/cache';
import type { Task } from '../../api/types';
import { Avatar } from '../Avatar';
import { DueBadge } from '../DueBadge';
import { CheckIcon, PriorityIcon } from '../Icons';

interface CardBodyProps {
  task: Task;
  today: string;
  owner: string;
}

/** The card face. Also used (without the sortable wrapper) as the floating copy while dragging. */
export function CardBody({ task, today, owner }: CardBodyProps) {
  const done = task.status === 'done';
  return (
    <>
      <p className="card-title">{task.title}</p>
      {task.dueDate && (
        <div className="card-due">
          <DueBadge due={task.dueDate} done={done} today={today} />
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
        </span>
        <Avatar name={owner} size={22} />
      </div>
    </>
  );
}

interface CardProps extends CardBodyProps {
  onOpen: (id: string) => void;
}

// memo: during a drag the board re-renders on every pointer move, and only the cards that actually
// changed (their task object) should pay for it.
export const Card = memo(function Card({ task, today, owner, onOpen }: CardProps) {
  // A card that is still being saved has no real id yet, so it can be neither opened nor dragged.
  const pending = isTempId(task.id);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: pending });

  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    listeners?.onKeyDown?.(e);
    if (e.key === 'Enter' && !e.defaultPrevented && !pending) onOpen(task.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`card ${isDragging ? 'card-ghost' : ''} ${pending ? 'card-pending' : ''} ${task.status === 'done' ? 'card-is-done' : ''}`}
      {...attributes}
      {...listeners}
      onKeyDown={onKeyDown}
      onClick={() => !pending && onOpen(task.id)}
      aria-label={`${task.key} ${task.title}`}
    >
      <CardBody task={task} today={today} owner={owner} />
    </div>
  );
});
