import { STATUS_LABEL, type TaskStatus } from '../api/types';

export function StatusLozenge({ status }: { status: TaskStatus }) {
  return <span className={`lozenge lozenge-${status}`}>{STATUS_LABEL[status]}</span>;
}
