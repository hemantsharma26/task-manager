import { usePriorityLookup } from '../api/priorities';
import { FlagIcon } from './Icons';

/** The coloured flag of a priority: the colour is the one the user chose for it. */
export function PriorityIcon({ priority, size = 16 }: { priority: string; size?: number }) {
  const { colorOf, nameOf } = usePriorityLookup();
  return (
    <span className="prio" style={{ color: colorOf(priority) }} title={`${nameOf(priority)} priority`}>
      <FlagIcon size={size} filled />
    </span>
  );
}
