// Colours for a column and for the status lozenges that name it. The three classic columns keep their familiar
// colours; every column the user adds gets a stable colour picked from its key, so it looks the same everywhere.
export interface Tone {
  bg: string;
  fg: string;
  /** Stripe on cards and dot on the column header. Absent for the plain columns. */
  accent?: string;
}

const NEUTRAL: Tone = { bg: '#dcdfe4', fg: '#44546f' };
const PROGRESS: Tone = { bg: '#cce0ff', fg: '#0055cc' };
const DONE: Tone = { bg: '#baf3db', fg: '#216e4e' };

const KNOWN: Record<string, Tone> = {
  todo: NEUTRAL,
  in_progress: PROGRESS,
  done: DONE,
  issue: { bg: '#ffd5d2', fg: '#ae2e24', accent: '#e2483d' },
  rework: { bg: '#dfd8fd', fg: '#5e4db2', accent: '#8270db' },
};

const PALETTE: Tone[] = [
  { bg: '#c6edfb', fg: '#206a83', accent: '#2898bd' },
  { bg: '#fce4a6', fg: '#7f5f01', accent: '#cf9f02' },
  { bg: '#fdd0ec', fg: '#943d73', accent: '#ae4787' },
  { bg: '#d3f1a7', fg: '#4c6b1f', accent: '#82b536' },
  { bg: '#fedec8', fg: '#a54800', accent: '#e56910' },
  { bg: '#cfe1fd', fg: '#1558bc', accent: '#388bff' },
];

export function toneFor(key: string, isDone: boolean): Tone {
  const known = KNOWN[key];
  if (known) return known;
  if (isDone) return { ...DONE, accent: '#4bce97' };
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}
