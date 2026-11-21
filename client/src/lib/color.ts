export const HEX = /^#[0-9a-fA-F]{6}$/;
export const isHex = (value: string) => HEX.test(value);

const channels = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const toHex = (c: [number, number, number]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** `amount` (0..1) of the way from `hex` towards `other`. */
export function mix(hex: string, other: string, amount: number): string {
  const a = channels(hex);
  const b = channels(other);
  return toHex(a.map((v, i) => v + (b[i]! - v) * amount) as [number, number, number]);
}

/** Black or white, whichever reads better on top of `hex`. */
export function readableOn(hex: string): '#ffffff' | '#172b4d' {
  const [r, g, b] = channels(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#172b4d' : '#ffffff';
}

/** The colours offered in every colour picker. */
export const PALETTE = [
  '#c9372c', '#e56910', '#cf9f02', '#22a06b', '#1f845a', '#2898bd',
  '#0c66e4', '#1d7afc', '#6e5dc6', '#8270db', '#ae4787', '#626f86',
] as const;
