import { useState } from 'react';
import { PRIORITY_LABEL, STATUS_LABEL, type Task } from '../api/types';
import { describeDue, isOverdue } from '../lib/dates';
import { AlertIcon, CalendarIcon } from './Icons';

interface Props {
  task: Task;
  today: string;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

export function TaskItem({ task, today, onToggle, onEdit, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false);
  const done = task.status === 'done';
  const overdue = isOverdue(task.dueDate, done, today);

  return (
    <li className={`task ${done ? 'task-done' : ''}`}>
      <input
        type="checkbox"
        className="task-check"
        checked={done}
        onChange={() => onToggle(task)}
        aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
      />

      <div className="task-main">
        <div className="task-title-row">
          <h3 className="task-title">{task.title}</h3>
          <span className={`badge badge-${task.priority}`}>{PRIORITY_LABEL[task.priority]}</span>
          {task.status === 'in_progress' && <span className="badge badge-progress">{STATUS_LABEL.in_progress}</span>}
        </div>
        {task.description && <p className="task-desc">{task.description}</p>}
        {task.dueDate && (
          <p className={`task-due ${overdue ? 'task-due-overdue' : ''}`}>
            {overdue ? <AlertIcon /> : <CalendarIcon />}
            {describeDue(task.dueDate, done, today)}
          </p>
        )}
      </div>

      <div className="task-actions">
        {confirming ? (
          <>
            <span className="muted">Delete?</span>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => onDelete(task)}>
              Yes, delete
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)} autoFocus>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit(task)} aria-label={`Edit "${task.title}"`}>
              Edit
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(true)} aria-label={`Delete "${task.title}"`}>
              Delete
            </button>
          </>
        )}
      </div>
    </li>
  );
}
