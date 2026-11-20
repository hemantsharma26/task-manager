const COLORS = ['#0C66E4', '#6E5DC6', '#1F845A', '#C25100', '#CF9F02', '#AE4787', '#2898BD'];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('') || '?';

// The same name always gets the same colour, so the avatar is recognisable at a glance.
function colorFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length]!;
}

export function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <span
      className="avatar"
      title={name}
      style={{ width: size, height: size, background: colorFor(name), fontSize: Math.round(size * 0.42) }}
    >
      {initials(name)}
    </span>
  );
}
