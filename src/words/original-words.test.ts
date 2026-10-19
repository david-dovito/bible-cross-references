import { describe, expect, it } from 'vitest';
import type { OriginalWordColumns } from '../core/datasets/formats.ts';
import { OriginalWordIndex } from './original-words.ts';

/** Three words over six verses: one rare, one middling, one shared with the rare one. */
function columns(overrides: Partial<OriginalWordColumns> = {}): OriginalWordColumns {
  return {
    strongs: ['G0001', 'G0002', 'G0003'],
    lemma: ['ἄλφα', 'βῆτα', 'γάμμα'],
    transliteration: ['alpha', 'bēta', 'gamma'],
    gloss: ['first', 'second', 'third'],
    //            G0001        G0002           G0003
    offsets: [0, 2, 5, 6],
    verses: [1, 4, 0, 1, 2, 5],
    ...overrides,
  };
}

const VERSES = 6;

describe('OriginalWordIndex', () => {
  it('reports how many words it holds', () => {
    expect(new OriginalWordIndex(columns(), VERSES).wordCount).toBe(3);
  });

  it('lists the verses of a word in canonical order', () => {
    const index = new OriginalWordIndex(columns(), VERSES);
    expect(index.versesOf(0)).toEqual([1, 4]);
    expect(index.versesOf(1)).toEqual([0, 1, 2]);
    expect(index.versesOf(2)).toEqual([5]);
  });

  it('turns the index inside out to answer "which words are in this verse"', () => {
    const index = new OriginalWordIndex(columns(), VERSES);
    expect(index.wordsOf(1).map((word) => word.strongs)).toEqual(['G0001', 'G0002']);
    expect(index.wordsOf(0).map((word) => word.strongs)).toEqual(['G0002']);
    expect(index.wordsOf(5).map((word) => word.strongs)).toEqual(['G0003']);
  });

  it('puts the least common word first, so the most telling one leads', () => {
    // Verse 1 has G0001 (2 verses) and G0002 (3 verses).
    const [first, second] = new OriginalWordIndex(columns(), VERSES).wordsOf(1);
    expect(first?.strongs).toBe('G0001');
    expect(first?.verseCount).toBe(2);
    expect(second?.verseCount).toBe(3);
  });

  it('breaks a tie by the number, so the order never wobbles', () => {
    const tied = columns({ offsets: [0, 1, 2, 3], verses: [0, 0, 0] });
    expect(new OriginalWordIndex(tied, VERSES).wordsOf(0).map((w) => w.strongs)).toEqual([
      'G0001',
      'G0002',
      'G0003',
    ]);
  });

  it('carries every field of a word through', () => {
    const [word] = new OriginalWordIndex(columns(), VERSES).wordsOf(5);
    expect(word).toEqual({
      index: 2,
      strongs: 'G0003',
      lemma: 'γάμμα',
      transliteration: 'gamma',
      gloss: 'third',
      verseCount: 1,
    });
  });

  it('answers with nothing for a verse that uses none of them', () => {
    expect(new OriginalWordIndex(columns(), VERSES).wordsOf(3)).toEqual([]);
  });

  it('answers with nothing beyond the end rather than throwing', () => {
    expect(new OriginalWordIndex(columns(), VERSES).wordsOf(99)).toEqual([]);
  });

  it('refuses a verse outside the versification instead of filing it under the first', () => {
    const broken = columns({ offsets: [0, 1, 2, 3], verses: [0, VERSES, 1] });
    expect(() => new OriginalWordIndex(broken, VERSES)).toThrow(/outside the versification/);
    const negative = columns({ offsets: [0, 1, 2, 3], verses: [0, -1, 1] });
    expect(() => new OriginalWordIndex(negative, VERSES)).toThrow(/outside the versification/);
  });

  it('refuses offsets that do not describe its words', () => {
    expect(() => new OriginalWordIndex(columns({ offsets: [0, 2, 5] }), VERSES)).toThrow(
      /one offset per word/,
    );
  });

  it('holds an empty dataset without complaint', () => {
    const empty = new OriginalWordIndex(
      { strongs: [], lemma: [], transliteration: [], gloss: [], offsets: [0], verses: [] },
      VERSES,
    );
    expect(empty.wordCount).toBe(0);
    expect(empty.wordsOf(0)).toEqual([]);
  });
});
