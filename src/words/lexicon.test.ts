import { describe, expect, it } from 'vitest';
import { Lexicon, plainStrongs } from './lexicon.ts';
import { Septuagint } from './septuagint.ts';
import type { SeptuagintFile } from '../core/datasets/formats.ts';

const lexicon = new Lexicon({
  strongs: ['G5046', 'G5056', 'H8549'],
  lemma: ['τέλειος', 'τέλος', 'תָּמִים'],
  transliteration: ['teleios', 'telos', 'tamim'],
  definition: ['complete', 'end', 'entire'],
  renderings: ['perfect', 'end', 'perfect'],
  senses: ['mature', '', '1. complete'],
  translations: ['perfect (17)', 'end (35)', 'blemish (44)'],
  occurrences: [17, 35, 91],
  familyOffsets: [0, 1, 2, 2],
  family: [1, 0],
  equivalentOffsets: [0, 1, 1, 1],
  equivalents: [2],
});

describe('Lexicon', () => {
  it('finds an entry by any form of its number', () => {
    expect(plainStrongs('G05046')).toBe('G5046');
    expect(lexicon.find('H8549A')?.lemma).toBe('תָּמִים');
    expect(lexicon.find('G9999')).toBeNull();
  });

  it('reads the Septuagint equivalence both ways', () => {
    const teleios = lexicon.find('G5046');
    const tamim = lexicon.find('H8549');
    expect(teleios && lexicon.equivalentsOf(teleios).map((e) => e.strongs)).toEqual(['H8549']);
    expect(tamim && lexicon.equivalentsOf(tamim).map((e) => e.strongs)).toEqual(['G5046']);
  });

  it('lists the family without the word itself', () => {
    const teleios = lexicon.find('G5046');
    expect(teleios && lexicon.familyOf(teleios).map((e) => e.strongs)).toEqual(['G5056']);
  });
});

const FILE = {
  greek: {
    key: ['αμωμος', 'τελειος'],
    lemma: ['ἄμωμος', 'τέλειος'],
    strongs: ['G299', 'G5046'],
    gloss: ['blameless', 'complete'],
    verseOffsets: [0, 2, 3],
    verses: [10, 20, 30],
    familyOffsets: [0, 0, 0],
    family: [],
  },
  pairs: {
    hebrew: ['H8549', 'H8549'],
    greek: [1, 0],
    count: [4, 61],
    hebrewVerses: [84, 84],
    greekVerses: [17, 70],
    toGreek: [41, 717],
    toHebrew: [193, 600],
  },
  alignment: { greek: ['Ps.50.3'], verses: [14692] },
} as unknown as SeptuagintFile;

describe('Septuagint', () => {
  const septuagint = new Septuagint(FILE);

  it('ranks how a Hebrew word is rendered, the most frequent first', () => {
    expect(septuagint.renderingsOf('H8549').map((pair) => pair.greek.lemma)).toEqual([
      'ἄμωμος',
      'τέλειος',
    ]);
  });

  it('follows a Greek word to its Old Testament verses and its Hebrew', () => {
    const [teleios] = septuagint.wordsWithStrongs('G5046');
    expect(teleios && septuagint.versesOf(teleios)).toEqual([30]);
    expect(teleios && septuagint.sourcesOf(teleios).map((pair) => pair.hebrew)).toEqual(['H8549']);
  });

  it("gives a KJV verse's Septuagint reference", () => {
    expect(septuagint.greekReferenceOf(14692)).toBe('Ps.50.3');
    expect(septuagint.greekReferenceOf(1)).toBeNull();
  });
});
