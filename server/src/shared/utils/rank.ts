import { RANK_MIN_GAP, RANK_STEP } from '../../constants/index.js';

// Ordering inside a board column uses sparse numeric ranks (1000, 2000, 3000, ...).
// Dropping a card between two others gives it the midpoint, so a drag is a single
// write instead of renumbering the column. When two ranks get too close to split, the
// caller renumbers that one column (rare) and tries again.

/**
 * Rank for an item that goes between `prev` and `next`.
 * Pass undefined for "nothing there" (top or bottom of the column).
 * Returns null when there is no room left between the two and the column needs renumbering.
 */
export function rankBetween(prev: number | undefined, next: number | undefined): number | null {
  if (prev === undefined && next === undefined) return RANK_STEP;
  if (prev === undefined) return (next as number) - RANK_STEP;
  if (next === undefined) return prev + RANK_STEP;
  if (next - prev < RANK_MIN_GAP) return null;
  return prev + (next - prev) / 2;
}
