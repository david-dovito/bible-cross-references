import { describe, expect, it } from 'vitest';
import { EVIDENCE_KINDS } from '../core/datasets/formats.ts';
import { countKinds, Evidence } from './evidence.ts';

const { crossReference, words, quotation, meaning } = EVIDENCE_KINDS;

const evidence = new Evidence(
  {
    first: [1, 1, 2],
    second: [5, 7, 7],
    kinds: [crossReference | words | quotation, meaning, crossReference],
    words: [400, 0, 0],
    quotation: [3, 0, 0],
    meaning: [0, 850, 0],
  },
  10,
);

describe('Evidence', () => {
  it('reads a pair from either verse, the most agreed on first', () => {
    expect(evidence.linksOf(1).map((link) => [link.other, link.agreement])).toEqual([
      [5, 3],
      [7, 1],
    ]);
    expect(evidence.linksOf(5).map((link) => link.other)).toEqual([1]);
    expect(countKinds(crossReference | meaning)).toBe(2);
  });

  it('says whether something besides the cross-reference links a verse to a range', () => {
    expect(evidence.agrees(1, 4, 6)).toBe(true);
    expect(evidence.agrees(2, 7, 7)).toBe(false);
    expect(evidence.agrees(1, 8, 9)).toBe(false);
  });
});
