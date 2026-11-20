import { describeDue, isOverdue } from '../lib/dates';
import { AlertIcon, CalendarIcon } from './Icons';

export function DueBadge({ due, done, today }: { due: string | null; done: boolean; today: string }) {
  if (!due) return null;
  const overdue = isOverdue(due, done, today);
  return (
    <span className={`due ${overdue ? 'due-overdue' : ''} ${due === today && !done ? 'due-today' : ''}`}>
      {overdue ? <AlertIcon size={12} /> : <CalendarIcon size={12} />}
      {describeDue(due, done, today)}
    </span>
  );
}
