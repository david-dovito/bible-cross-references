import { describe, expect, it } from 'vitest';
import { topPositions } from './top-k.ts';

describe('topPositions', () => {
  it('returns the positions of the largest values, largest first', () => {
    expect(topPositions([3, 9, 1, 7], 2)).toEqual([1, 3]);
  });

  it('breaks a tie by taking the earlier position', () => {
    expect(topPositions([5, 5, 5], 2)).toEqual([0, 1]);
  });

  it('ignores zero and negative values entirely', () => {
    expect(topPositions([0, -4, 2, 0], 10)).toEqual([2]);
  });

  it('returns fewer than asked when there are fewer', () => {
    expect(topPositions([1, 2], 10)).toEqual([1, 0]);
  });

  it('returns nothing for k of zero, or for no values', () => {
    expect(topPositions([1, 2, 3], 0)).toEqual([]);
    expect(topPositions([], 3)).toEqual([]);
    expect(topPositions([0, 0], 3)).toEqual([]);
  });

  it('works on a typed array, which is how the app stores counts', () => {
    expect(topPositions(Int32Array.of(2, 8, 0, 8), 3)).toEqual([1, 3, 0]);
  });
});
