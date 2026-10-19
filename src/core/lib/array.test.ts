import { describe, expect, it } from 'vitest';
import { elementAt } from './array.ts';

describe('elementAt', () => {
  it('returns the element', () => {
    expect(elementAt(['a', 'b'], 1)).toBe('b');
    expect(elementAt(Int32Array.of(7, 8), 0)).toBe(7);
  });

  it('throws rather than passing on an absent element', () => {
    expect(() => elementAt(['a'], 5)).toThrow(RangeError);
    expect(() => elementAt([], 0)).toThrow(/out of bounds \(length 0\)/);
    expect(() => elementAt(['a'], -1)).toThrow(RangeError);
  });

  it('throws for a hole in a sparse array, which is the invariant it guards', () => {
    expect(() => elementAt<string>(Array.from({ length: 3 }), 1)).toThrow(RangeError);
  });
});
