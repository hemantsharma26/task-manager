import { describe, expect, it } from 'vitest';
import { RANK_STEP } from '../src/constants/index.js';
import { rankBetween } from '../src/shared/utils/rank.js';

describe('rankBetween', () => {
  it('starts an empty column at one step', () => {
    expect(rankBetween(undefined, undefined)).toBe(RANK_STEP);
  });
  it('goes above the first and below the last', () => {
    expect(rankBetween(undefined, 1000)).toBe(0);
    expect(rankBetween(3000, undefined)).toBe(4000);
  });
  it('takes the midpoint between two neighbours', () => {
    expect(rankBetween(1000, 2000)).toBe(1500);
    expect(rankBetween(1000, 1500)).toBe(1250);
  });
  it('asks for a renumber when there is no room left', () => {
    expect(rankBetween(1000, 1000)).toBeNull();
    expect(rankBetween(1000, 1000 + 1e-9)).toBeNull();
  });
});
