import { useColumnLookup } from '../api/columns';
import { toneFor } from '../lib/tone';

export function StatusLozenge({ status }: { status: string }) {
  const { nameOf, isDone } = useColumnLookup();
  const tone = toneFor(status, isDone(status));
  return (
    <span className="lozenge" style={{ background: tone.bg, color: tone.fg }}>
      {nameOf(status)}
    </span>
  );
}
