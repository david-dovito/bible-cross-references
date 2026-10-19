import { describe, expect, it } from 'vitest';
import { EVIDENCE_KINDS } from '../../../src/core/datasets/formats.ts';
import { verseIndex } from '../../../src/test-utils/fixtures.ts';
import { importEvidence, type EvidenceSources } from './evidence.ts';

const OPTIONS = {
  license: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
  attribution: 'Evidence.',
  provenance: { url: 'derived', sha256: '', retrievedAt: '2026-10-18' },
};

const habakkuk = verseIndex('Hab', 2, 4);
const romans = verseIndex('Rom', 1, 17);
const isaiah = verseIndex('Isa', 40, 3);
const matthew = verseIndex('Matt', 3, 3);
const genesis = verseIndex('Gen', 1, 1);
const john = verseIndex('John', 1, 1);

/** Background verses, so a rare word is rare: each with common words only. */
const background = Array.from({ length: 40 }, (_, at) => verseIndex('Ps', 119, at + 1));

function sources(overrides: Partial<EvidenceSources> = {}): EvidenceSources {
  const terms = new Map<number, Set<string>>([
    [habakkuk, new Set(['G1342', 'G4102', 'G2198', 'H6662'])],
    [romans, new Set(['G1342', 'G4102', 'G2198', 'G1343'])],
    [isaiah, new Set(['G5456', 'G994', 'G2048', 'G3598'])],
    [matthew, new Set(['G5456', 'G994', 'G2048', 'G3598'])],
    [genesis, new Set(['G746', 'G3772'])],
    [john, new Set(['G746', 'G3056'])],
  ]);
  for (const verse of background) {
    terms.set(verse, new Set(['G2316', 'G2962']));
  }
  return {
    terms,
    newTestament: new Map([
      [romans, ['G1342', 'G1537', 'G4102', 'G2198']],
      [matthew, ['G5456', 'G994', 'G1722', 'G2048', 'G2090', 'G3598', 'G2962']],
    ]),
    septuagint: new Map([
      [habakkuk, ['G1342', 'G1537', 'G4102', 'G2198']],
      [isaiah, ['G5456', 'G994', 'G1722', 'G2048', 'G2090', 'G3598', 'G2962']],
    ]),
    functionWords: new Set(['G1537', 'G1722']),
    crossReferences: [[matthew, isaiah, isaiah]],
    similar: null,
    ...overrides,
  };
}

describe('importEvidence', () => {
  const pairAt = (file: ReturnType<typeof importEvidence>, a: number, b: number) => {
    const [first, second] = a < b ? [a, b] : [b, a];
    const at = file.pairs.first.findIndex(
      (value, index) => value === first && file.pairs.second[index] === second,
    );
    return at === -1
      ? null
      : { kinds: file.pairs.kinds[at] ?? 0, quotation: file.pairs.quotation[at] ?? 0 };
  };

  it('pairs verses that share rare words, across the testaments through the Septuagint', () => {
    const file = importEvidence(sources(), OPTIONS);
    expect((pairAt(file, romans, habakkuk)?.kinds ?? 0) & EVIDENCE_KINDS.words).toBeTruthy();
  });

  it('finds a quotation from shared runs of content words, function words skipped', () => {
    const file = importEvidence(sources(), OPTIONS);
    const quote = pairAt(file, matthew, isaiah);
    expect((quote?.kinds ?? 0) & EVIDENCE_KINDS.quotation).toBeTruthy();
    expect(quote?.quotation).toBeGreaterThanOrEqual(2);
  });

  it('takes one distinctive run as a quotation only where the words agree too', () => {
    const withWords = importEvidence(sources(), OPTIONS);
    expect(
      (pairAt(withWords, romans, habakkuk)?.kinds ?? 0) & EVIDENCE_KINDS.quotation,
    ).toBeTruthy();
    const terms = new Map(sources().terms);
    terms.set(romans, new Set(['G1343']));
    const withoutWords = importEvidence(sources({ terms }), OPTIONS);
    expect((pairAt(withoutWords, romans, habakkuk)?.kinds ?? 0) & EVIDENCE_KINDS.quotation).toBe(0);
  });

  it('marks a cross-reference only where another kind agrees', () => {
    const file = importEvidence(sources(), OPTIONS);
    expect(
      (pairAt(file, matthew, isaiah)?.kinds ?? 0) & EVIDENCE_KINDS.crossReference,
    ).toBeTruthy();
  });

  it("adds the model's neighbours above the bar, and not the ones below", () => {
    const verses = new Array<number>(31102 * 2).fill(-1);
    const scores = new Array<number>(31102 * 2).fill(0);
    verses[genesis * 2] = john;
    scores[genesis * 2] = 870;
    verses[genesis * 2 + 1] = matthew;
    scores[genesis * 2 + 1] = 500;
    const file = importEvidence(sources({ similar: { neighbours: 2, verses, scores } }), OPTIONS);
    expect((pairAt(file, genesis, john)?.kinds ?? 0) & EVIDENCE_KINDS.meaning).toBeTruthy();
    expect(pairAt(file, genesis, matthew)).toBeNull();
  });
});
