import type { Person } from '../api/types';
import { Avatar } from './Avatar';
import { UserIcon } from './Icons';

interface Props {
  people: Person[];
  size?: number;
  /** How many faces to show before "+3". */
  max?: number;
}

/** The people a task is assigned to, as overlapping faces. Nobody assigned shows a dashed, empty one. */
export function AvatarStack({ people, size = 22, max = 3 }: Props) {
  if (people.length === 0) {
    return (
      <span className="avatar avatar-empty" title="Unassigned" style={{ width: size, height: size }}>
        <UserIcon size={Math.round(size * 0.6)} />
      </span>
    );
  }
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="avatar-stack" title={people.map((p) => p.name).join(', ')}>
      {shown.map((p) => (
        <Avatar key={p.id} name={p.name} size={size} />
      ))}
      {extra > 0 && (
        <span className="avatar avatar-more" style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}>
          +{extra}
        </span>
      )}
    </span>
  );
}
