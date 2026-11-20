import { describeDue, isOverdue } from '../lib/dates';
import { AlertIcon, CalendarIcon } from './Icons';

interface Props {
  due: string | null;
  /** End of the window (the deadline time). */
  time?: string | null;
  startTime?: string | null;
  done: boolean;
  today: string;
}

/** Turns red once the END of the window has passed. */
export function DueBadge({ due, time = null, startTime = null, done, today }: Props) {
  if (!due) return null;
  const overdue = isOverdue(due, done, today, time);
  return (
    <span className={`due ${overdue ? 'due-overdue' : ''} ${due === today && !done && !overdue ? 'due-today' : ''}`}>
      {overdue ? <AlertIcon size={12} /> : <CalendarIcon size={12} />}
      {describeDue(due, done, today, time, undefined, startTime)}
    </span>
  );
}
