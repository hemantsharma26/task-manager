import { useColumnLookup } from '../api/columns';
import { toneFor } from '../lib/tone';

export function StatusLozenge({ status }: { status: string }) {
  const { nameOf, isDone, colorOf } = useColumnLookup();
  const tone = toneFor(status, isDone(status), colorOf(status));
  return (
    <span className="lozenge" style={{ background: tone.bg, color: tone.fg }}>
      {nameOf(status)}
    </span>
  );
}
