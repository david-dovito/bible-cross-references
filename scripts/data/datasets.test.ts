import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { CANONICAL_VERSIFICATION } from '../../src/core/bible/versification.ts';
import { DATASET_BUILDERS, type RawSourceContent } from './datasets.ts';
import { BOOK_CODES as KJV_CODES } from './importers/ebible-vpl.ts';
import type { RawSource } from './lib/sources.ts';

function source(id: string): RawSource {
  return {
    id,
    description: id,
    url: `https://example.org/${id}`,
    fileName: `${id}.txt`,
    sha256: 'a'.repeat(64),
    retrievedAt: '2026-01-01',
    license: 'CC BY 4.0',
    homepage: 'https://example.org/',
  };
}

/** One line per verse of the whole canon, which is what every importer insists on. */
function everyVerse(render: (index: number) => string): string {
  return Array.from({ length: CANONICAL_VERSIFICATION.verseCount }, (_, index) =>
    render(index),
  ).join('\n');
}

const BSB = everyVerse((index) => {
  const ref = CANONICAL_VERSIFICATION.refAt(index);
  const book = CANONICAL_VERSIFICATION.bookAt(index);
  return `${book.name} ${String(ref.chapter)}:${String(ref.verse)}\tVerse ${String(index)}.`;
});

const KJV = everyVerse((index) => {
  const ref = CANONICAL_VERSIFICATION.refAt(index);
  const code = KJV_CODES[CANONICAL_VERSIFICATION.bookAt(index).ordinal] ?? 'GEN';
  return `${code} ${String(ref.chapter)}:${String(ref.verse)} Verse ${String(index)}`;
});

const CONTENT: Readonly<Record<string, string | Uint8Array>> = {
  bsb: `The Holy Bible, Berean Standard Bible\nVerse\tBerean Standard Bible\n${BSB}`,
  kjv: zipSync({ 'eng-kjv2006_vpl.txt': strToU8(KJV) }),
  openbible: zipSync({
    'cross_references.txt': strToU8(
      'From Verse\tTo Verse\tVotes\t# CC-BY 2026-01-01\nGen.1.1\tJohn.1.1\t5',
    ),
  }),
  'stepbible-tagnt-mat-jhn': 'Mat.1.1#01=NKO\tx\ty\tG0976=N-NSF\tz',
  'stepbible-tagnt-act-rev': '',
  'stepbible-tahot-gen-deu': 'Gen.1.1#01=L\tx\ty\tz\t{H7225G}\tHNcfsa',
  'stepbible-tahot-jos-est': '',
  'stepbible-tahot-job-sng': '',
  'stepbible-tahot-isa-mal': '',
  'stepbible-tbesg': ['G0976', 'G0976 =', 'G0976', 'βίβλος', 'biblos', 'G:N-F', 'book', ''].join(
    '\t',
  ),
  'stepbible-tbesh': [
    'H7225',
    'H7225G =',
    'H7225G',
    'רֵאשִׁית',
    're.Shit',
    'N:N-F',
    'beginning',
    '',
  ].join('\t'),
};

const readSource = (id: string): Promise<RawSourceContent> => {
  const content = CONTENT[id];
  if (content === undefined) {
    throw new Error(`The test has no content for "${id}".`);
  }
  return Promise.resolve({
    source: source(id),
    content: Buffer.from(typeof content === 'string' ? strToU8(content) : content),
  });
};

// The sandbox's own datasets (more translations, the lexicon, the Septuagint, the evidence) are
// tested with their importers, on fixtures of their own.
const UPSTREAM_BUILDERS = new Set([
  'data/translations/bsb.json',
  'data/translations/kjv.json',
  'data/cross-references/openbible.json',
  'data/words/stepbible.json',
]);

describe('DATASET_BUILDERS', () => {
  it('has one builder per dataset the app loads', () => {
    expect(DATASET_BUILDERS.map((builder) => builder.outputPath)).toEqual([
      'data/translations/bsb.json',
      'data/translations/kjv.json',
      'data/translations/msb.json',
      'data/translations/asv.json',
      'data/translations/web.json',
      'data/translations/nasb.json',
      'data/translations/nkjv.json',
      'data/cross-references/openbible.json',
      'data/words/stepbible.json',
      'data/words/lexicon.json',
      'data/words/thayer.json',
      'data/words/septuagint.json',
      'data/links/evidence.json',
    ]);
  });

  it('writes every dataset under public/data', () => {
    for (const builder of DATASET_BUILDERS) {
      expect(builder.outputPath.startsWith('data/')).toBe(true);
      expect(builder.outputPath.endsWith('.json')).toBe(true);
    }
  });

  it.each(
    DATASET_BUILDERS.filter((b) => UPSTREAM_BUILDERS.has(b.outputPath)).map(
      (b) => [b.outputPath, b] as const,
    ),
  )('builds %s from its pinned sources', async (_path, builder) => {
    const dataset = await builder.build(readSource);
    if (!dataset) return;
    expect(dataset.versification).toBe('kjv');
    expect(dataset.schemaVersion).toBe(1);
    expect(dataset.provenance.sha256).toHaveLength(64);
    expect(dataset.provenance.url).toContain('https://example.org/');
    expect(Array.isArray(dataset.notices)).toBe(true);
  });

  it('passes the words builder its licence and credit, from one place', async () => {
    const words = DATASET_BUILDERS.find((b) => b.outputPath.includes('words'));
    const dataset = await words?.build(readSource);
    if (dataset?.format !== 'original-words') {
      throw new Error('Expected the words dataset.');
    }
    expect(dataset.license).toEqual({
      name: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/',
    });
    expect(dataset.attribution).toContain('STEP Bible');
  });
});
