import { describe, expect, it } from 'vitest';
import { verseIndex } from '../../../src/test-utils/fixtures.ts';
import { importSeptuagint } from './septuagint.ts';

const OPTIONS = {
  license: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
  attribution: 'Septuagint.',
  provenance: {
    url: 'https://example.org/lxx.js',
    sha256: 'a'.repeat(64),
    retrievedAt: '2026-10-17',
  },
};

const WORD_LIST = `greekWordList = ${JSON.stringify({
  αλφα: { lemma: 'ἄλφα', strong: '1001', pos: 'N', def: 'first' },
  βητα: { lemma: 'βῆτα', strong: '1002', pos: 'N', def: 'second' },
  γαμμα: { lemma: 'γάμμα', pos: 'V', def: 'third' },
  και: { lemma: 'καί', strong: '2532', pos: 'C', def: 'and' },
})};`;

/**
 * Obadiah, made up: the Greek numbers its verses one higher than the Hebrew (as the Septuagint's
 * Psalms do), uses γάμμα (which no seed knows) wherever the Hebrew has H3003, and puts καί
 * everywhere, as a function word would be.
 */
const hebrew = new Map<string, Set<number>>([
  ['H1001', new Set([1, 2, 3, 4, 5, 6].map((v) => verseIndex('Obad', 1, v)))],
  ['H2002', new Set([1, 2, 3, 4, 5, 6].map((v) => verseIndex('Obad', 1, v)))],
  ['H3003', new Set([2, 3, 4, 5].map((v) => verseIndex('Obad', 1, v)))],
]);
const verse = (words: readonly string[]) => words.map((key) => ({ key, lemma: key }));
const greek: Record<string, ReturnType<typeof verse>> = {};
for (let v = 1; v <= 6; v += 1) {
  greek[`Obad.1.${String(v + 1)}`] = verse([
    'αλφα',
    'βητα',
    'και',
    ...(v >= 2 && v <= 5 ? ['γαμμα'] : []),
  ]);
}

describe('importSeptuagint', () => {
  const file = importSeptuagint(
    {
      books: [{ file: 'Obad', books: ['Obad'], text: JSON.stringify(greek) }],
      greekWordList: WORD_LIST,
      hebrewVerses: hebrew,
      seeds: new Map([
        ['G1001', new Set(['H1001'])],
        ['G1002', new Set(['H2002'])],
      ]),
      hebrewFunctionWords: new Set(),
    },
    OPTIONS,
  );
  const greekAt = (key: string) => file.greek.key.indexOf(key);

  it('lines the Greek verses up with the Hebrew ones despite the numbering', () => {
    const at = file.alignment.greek.indexOf('Obad.1.3');
    expect(file.alignment.verses[at]).toBe(verseIndex('Obad', 1, 2));
    expect(file.alignment.greek).toHaveLength(6);
  });

  it('pairs a word no seed knows, from the verses it shares', () => {
    const pairs = file.pairs.hebrew
      .map((hebrewWord, at) => [hebrewWord, file.greek.key[file.pairs.greek[at] ?? -1]] as const)
      .filter(([, greekWord]) => greekWord === 'γαμμα');
    expect(pairs).toContainEqual(['H3003', 'γαμμα']);
  });

  it('never pairs a function word', () => {
    expect(file.pairs.greek).not.toContain(greekAt('και'));
  });

  it('lists where the Septuagint uses each word, as KJV verses', () => {
    const at = greekAt('γαμμα');
    const verses = file.greek.verses.slice(
      file.greek.verseOffsets[at],
      file.greek.verseOffsets[at + 1],
    );
    expect(verses).toEqual([2, 3, 4, 5].map((v) => verseIndex('Obad', 1, v)));
    expect(file.greek.strongs[greekAt('αλφα')]).toBe('G1001');
  });
});
