import { stat } from 'node:fs/promises';
import { strFromU8, unzipSync } from 'fflate';
import type {
  CrossReferencesFile,
  EvidenceFile,
  LexiconFile,
  SeptuagintFile,
  OriginalWordsFile,
  TranslationTextFile,
} from '../../src/core/datasets/formats.ts';
import type {
  CrossReferenceSourceId,
  TranslationId,
  WordSourceId,
} from '../../src/core/datasets/ids.ts';
import {
  crossReferencesDatasetPath,
  evidenceDatasetPath,
  lexiconDatasetPath,
  septuagintDatasetPath,
  originalWordsDatasetPath,
  translationDatasetPath,
} from '../../src/core/datasets/paths.ts';
import { importBsbText } from './importers/bsb.ts';
import { importEbibleVerseLines, type VerseRenumbering } from './importers/ebible-vpl.ts';
import { importLicensedVerseLines } from './importers/licensed-vpl.ts';
import { plainStrongs } from '../../src/words/lexicon.ts';
import { importLexicon } from './importers/lexicon.ts';
import { importOpenBibleCrossReferences } from './importers/openbible.ts';
import { importEvidence } from './importers/evidence.ts';
import {
  greekFunctionStrongs,
  importSeptuagint,
  SEPTUAGINT_BOOKS,
  septuagintSequences,
  type SeptuagintBook,
} from './importers/septuagint.ts';
import { getWordSourceManifest } from '../../src/words/registry.ts';
import {
  importStepBibleWords,
  readTaggedWords,
  type TaggedLanguage,
} from './importers/stepbible.ts';
import { extractZipTextEntry, readFileIfExists, sha256Hex, today } from './lib/files.ts';
import { privateFilePath, REPO_ROOT } from './lib/paths.ts';
import { resolve } from 'node:path';
import type { VerseIndex } from '../../src/core/bible/verse-ref.ts';
import type { RawSource } from './lib/sources.ts';

export interface RawSourceContent {
  readonly source: RawSource;
  readonly content: Buffer;
}

/** Reads a verified raw source file by its ID in `data/sources.json`. */
export type RawSourceReader = (sourceId: string) => Promise<RawSourceContent>;

export interface DatasetBuilder {
  /** Output path relative to the site root (written under `public/`). */
  readonly outputPath: string;
  /** `null` when an optional source isn't there (a licensed text David hasn't supplied). */
  readonly build: (
    readSource: RawSourceReader,
  ) => Promise<
    | TranslationTextFile
    | CrossReferencesFile
    | OriginalWordsFile
    | LexiconFile
    | SeptuagintFile
    | EvidenceFile
    | null
  >;
}

function provenanceOf({ url, sha256, retrievedAt }: RawSource) {
  return { url, sha256, retrievedAt };
}

/** A translation from eBible.org's verse-per-line ZIP, pinned in `data/sources.json` by its ID. */
function ebibleTranslation(
  id: TranslationId,
  ebibleId: string,
  renumbering: VerseRenumbering = {},
): DatasetBuilder {
  return {
    outputPath: translationDatasetPath(id),
    build: async (readSource) => {
      const { source, content } = await readSource(id);
      const text = extractZipTextEntry(content, `${ebibleId}_vpl.txt`);
      return importEbibleVerseLines(
        text,
        id,
        { ...provenanceOf(source), snapshotDate: null },
        renumbering,
      );
    },
  };
}

/**
 * A licensed translation, from the file David supplies at `data/private/<id>.txt`. Without
 * the file the translation is skipped and everything else builds as before. The file is
 * git-ignored and never fetched; its checksum and date stand in for a pin in the provenance.
 */
function licensedTranslation(id: TranslationId): DatasetBuilder {
  return {
    outputPath: translationDatasetPath(id),
    build: async () => {
      const path = privateFilePath(`${id}.txt`);
      const content = await readFileIfExists(path);
      if (content === undefined) {
        return null;
      }
      const { mtime } = await stat(path);
      return importLicensedVerseLines(content.toString('utf8'), id, {
        url: `data/private/${id}.txt`,
        sha256: sha256Hex(content),
        retrievedAt: mtime.toISOString().slice(0, 10),
        snapshotDate: null,
      });
    },
  };
}

/** One builder per translation: the compiler enforces that every translation ID has one. */
const TRANSLATION_BUILDERS: Readonly<Record<TranslationId, DatasetBuilder>> = {
  bsb: {
    outputPath: translationDatasetPath('bsb'),
    build: async (readSource) => {
      const { source, content } = await readSource('bsb');
      return importBsbText(content.toString('utf8'), {
        ...provenanceOf(source),
        snapshotDate: null,
      });
    },
  },
  kjv: {
    outputPath: translationDatasetPath('kjv'),
    build: async (readSource) => {
      const { source, content } = await readSource('kjv');
      const text = extractZipTextEntry(content, 'eng-kjv2006_vpl.txt');
      return importEbibleVerseLines(text, 'kjv', {
        ...provenanceOf(source),
        snapshotDate: null,
      });
    },
  },
  msb: ebibleTranslation('msb', 'engmsb'),
  asv: ebibleTranslation('asv', 'eng-asv'),
  web: ebibleTranslation('web', 'engwebp', {
    // The WEB prints the doxology of Romans at 14:24–26 (and leaves 16:25 empty).
    'Rom.14.24': 'Rom.16.25',
    'Rom.14.25': 'Rom.16.26',
    'Rom.14.26': 'Rom.16.27',
  }),
  nasb: licensedTranslation('nasb'),
};

/** One builder per cross-reference source. */
/** Imported once: the evidence builder reads the links as well. */
let crossReferences: Promise<CrossReferencesFile> | undefined;
function crossReferencesOnce(readSource: RawSourceReader): Promise<CrossReferencesFile> {
  crossReferences ??= (async () => {
    const { source, content } = await readSource('openbible');
    const text = extractZipTextEntry(content, 'cross_references.txt');
    return importOpenBibleCrossReferences(text, provenanceOf(source));
  })();
  return crossReferences;
}

const CROSS_REFERENCE_BUILDERS: Readonly<Record<CrossReferenceSourceId, DatasetBuilder>> = {
  openbible: {
    outputPath: crossReferencesDatasetPath('openbible'),
    build: (readSource) => crossReferencesOnce(readSource),
  },
};

/**
 * The tagged Hebrew and Greek: six files of words and two lexicons, from which only the
 * dictionary forms and the verses they occur in are kept.
 */
const TAGGED_SOURCES: readonly { readonly id: string; readonly language: TaggedLanguage }[] = [
  { id: 'stepbible-tahot-gen-deu', language: 'hebrew' },
  { id: 'stepbible-tahot-jos-est', language: 'hebrew' },
  { id: 'stepbible-tahot-job-sng', language: 'hebrew' },
  { id: 'stepbible-tahot-isa-mal', language: 'hebrew' },
  { id: 'stepbible-tagnt-mat-jhn', language: 'greek' },
  { id: 'stepbible-tagnt-act-rev', language: 'greek' },
];

const LEXICON_SOURCES: readonly { readonly id: string; readonly language: TaggedLanguage }[] = [
  { id: 'stepbible-tbesh', language: 'hebrew' },
  { id: 'stepbible-tbesg', language: 'greek' },
];

/**
 * A word used in more verses than this says nothing about the verse it is in: only the 44
 * commonest are left out, the article, "and", "the LORD" and their like. It was 100 until the
 * lexicon came (2026-10-17): following a word's meaning to where else it is used has to reach
 * words like שָׁלוֹם (about 230 verses) too. The file grew from 540 to 870 KB compressed.
 */
const MAX_VERSES_PER_WORD = 1000;

const WORD_BUILDERS: Readonly<Record<WordSourceId, DatasetBuilder>> = {
  stepbible: {
    outputPath: originalWordsDatasetPath('stepbible'),
    build: async (readSource) => {
      const read = async ({ id, language }: { id: string; language: TaggedLanguage }) => {
        const { source, content } = await readSource(id);
        return { source, language, text: content.toString('utf8') };
      };
      const files = await Promise.all(TAGGED_SOURCES.map(read));
      const lexicons = await Promise.all(LEXICON_SOURCES.map(read));
      const first = files[0];
      if (!first) {
        throw new Error('No tagged sources are configured.');
      }
      const manifest = getWordSourceManifest('stepbible');
      return importStepBibleWords(files, lexicons, {
        maxVerses: MAX_VERSES_PER_WORD,
        license: manifest.license,
        attribution: manifest.attribution,
        // Every file is pinned; the first stands for the set in the dataset's provenance, and
        // the rest are listed beside it in data/sources.json.
        provenance: provenanceOf(first.source),
      });
    },
  },
};

export const LEXICON_ATTRIBUTION =
  "Definitions and word families: Strong's dictionaries (1890), Open Scriptures edition " +
  '(CC BY-SA). Greek senses and Septuagint equivalents: Abbott-Smith, Manual Greek Lexicon ' +
  '(1922, public domain), as edited by STEP Bible, Tyndale House, Cambridge (CC BY 4.0). ' +
  'Hebrew senses: Brown-Driver-Briggs (public domain), Open Scriptures Hebrew Bible Project ' +
  "(CC BY 4.0). KJV translation counts: eBible.org's KJV with Strong's numbers (public domain).";

/**
 * What the words mean: Strong's definitions and derivations (the families), with Abbott-Smith's
 * Greek senses and Septuagint notes from STEPBible's Greek lexicon. Strong's JSON is CC BY-SA, so
 * the file it is built into is too.
 */
/** The lexicon's sources, read once for both the lexicon and the Septuagint. */
async function lexiconSources(readSource: RawSourceReader) {
  const [greek, hebrew, greekLexicon, hebrewLexicon, bdb, bdbIndex, kjv] = await Promise.all(
    [
      'strongs-greek',
      'strongs-hebrew',
      'stepbible-tbesg',
      'stepbible-tbesh',
      'bdb',
      'bdb-index',
      'kjv-strongs',
    ].map(readSource),
  );
  if (!greek || !hebrew || !greekLexicon || !hebrewLexicon || !bdb || !bdbIndex || !kjv) {
    throw new Error('Lexicon: a source is missing.');
  }
  return {
    source: greek.source,
    texts: {
      strongsGreek: greek.content.toString('utf8'),
      strongsHebrew: hebrew.content.toString('utf8'),
      greekLexicon: greekLexicon.content.toString('utf8'),
      hebrewLexicon: hebrewLexicon.content.toString('utf8'),
      bdb: bdb.content.toString('utf8'),
      bdbIndex: bdbIndex.content.toString('utf8'),
      kjvBooks: Object.entries(unzipSync(kjv.content))
        .filter(([name]) => name.endsWith('.usfm'))
        .map(([, data]) => strFromU8(data)),
    },
  };
}

const LEXICON_LICENSE = {
  name: 'CC BY-SA 4.0',
  url: 'https://creativecommons.org/licenses/by-sa/4.0/',
};

const LEXICON_BUILDER: DatasetBuilder = {
  outputPath: lexiconDatasetPath(),
  build: async (readSource) => {
    const { source, texts } = await lexiconSources(readSource);
    return importLexicon(texts, {
      license: LEXICON_LICENSE,
      attribution: LEXICON_ATTRIBUTION,
      provenance: provenanceOf(source),
    });
  },
};

export const SEPTUAGINT_ATTRIBUTION =
  'Septuagint words: Open Scriptures Septuagint Project, LxxLemmas and Greek Word List (CC BY ' +
  '4.0). Modified: the Greek verses lined up with the Hebrew, and its words paired with the ' +
  "Hebrew's, by this site's own statistical alignment (IBM Model 1) over STEP Bible's tagged " +
  "Hebrew (CC BY 4.0), seeded with Abbott-Smith's Septuagint notes.";

/** TBESH's prepositions, conjunctions, particles and pronouns, by plain Strong's number. */
function hebrewFunctionWords(tbesh: string): Set<string> {
  const found = new Set<string>();
  for (const line of tbesh.split(/\r?\n/)) {
    const [strongs = '', , , , , partOfSpeech = ''] = line.split('\t');
    if (
      /^H\d{4}/.test(strongs) &&
      /^H:(Prep|Conj|Intg|PerP|DemP|Cond|Neg|Part|RelP|IndP)/.test(partOfSpeech)
    ) {
      found.add(plainStrongs(strongs));
    }
  }
  return found;
}

/**
 * The Septuagint: which Greek word renders which Hebrew one, and where the Greek is used, worked
 * out from the Hebrew (all of it, nothing left out) and the Septuagint's lemmas.
 */
/** Imported once: the evidence builder needs its verse alignment and the Greek it lines up. */
let septuagint:
  | Promise<{
      file: SeptuagintFile;
      books: SeptuagintBook[];
      greekWordList: string;
      functionWords: Set<string>;
    }>
  | undefined;
function septuagintOnce(readSource: RawSourceReader) {
  septuagint ??= (async () => {
    const [wordList, ...books] = await Promise.all([
      readSource('lxx-wordlist'),
      ...SEPTUAGINT_BOOKS.map(({ file }) => readSource(`lxx-${file}`)),
    ]);
    const hebrew = await Promise.all(
      TAGGED_SOURCES.filter(({ language }) => language === 'hebrew').map(async ({ id }) => ({
        language: 'hebrew' as const,
        text: (await readSource(id)).content.toString('utf8'),
      })),
    );
    const { texts, source } = await lexiconSources(readSource);
    const lexicon = importLexicon(texts, {
      license: LEXICON_LICENSE,
      attribution: LEXICON_ATTRIBUTION,
      provenance: provenanceOf(source),
    });
    const { entries } = lexicon;
    const seeds = new Map<string, Set<string>>();
    entries.strongs.forEach((strongs, index) => {
      const start = entries.equivalentOffsets[index] ?? 0;
      const end = entries.equivalentOffsets[index + 1] ?? start;
      if (end > start) {
        seeds.set(
          strongs,
          new Set(entries.equivalents.slice(start, end).map((at) => entries.strongs[at] ?? '')),
        );
      }
    });
    const bookTexts = SEPTUAGINT_BOOKS.map((book, index) => ({
      ...book,
      text: books[index]?.content.toString('utf8') ?? '{}',
    }));
    const greekWordList = wordList.content.toString('utf8');
    const file = importSeptuagint(
      {
        books: bookTexts,
        greekWordList,
        hebrewVerses: readTaggedWords(hebrew).versesByWord,
        seeds,
        hebrewFunctionWords: hebrewFunctionWords(texts.hebrewLexicon),
      },
      {
        license: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
        attribution: SEPTUAGINT_ATTRIBUTION,
        provenance: provenanceOf(wordList.source),
      },
    );
    return {
      file,
      books: bookTexts,
      greekWordList,
      functionWords: hebrewFunctionWords(texts.hebrewLexicon),
    };
  })();
  return septuagint;
}

const SEPTUAGINT_BUILDER: DatasetBuilder = {
  outputPath: septuagintDatasetPath(),
  build: async (readSource) => (await septuagintOnce(readSource)).file,
};

/** The model's verse neighbours, made offline by `tools/similarity` and committed. */
const SIMILAR_FILE = resolve(REPO_ROOT, 'data/derived/similar-bsb.json');

export const EVIDENCE_ATTRIBUTION =
  'Evidence: computed by this site from the datasets above (shared rare words, Septuagint ' +
  'quotations, OpenBible.info cross-references) and from bge-small-en-v1.5 (BAAI, MIT) run over ' +
  'the Berean Standard Bible.';

/**
 * Evidence: verse pairs linked by shared rare words, by quotation, by meaning (the model) and by
 * cross-reference, each pair with what links it (importers/evidence.ts).
 */
const EVIDENCE_BUILDER: DatasetBuilder = {
  outputPath: evidenceDatasetPath(),
  build: async (readSource) => {
    const tagged = await Promise.all(
      TAGGED_SOURCES.map(async ({ id, language }) => ({
        language,
        text: (await readSource(id)).content.toString('utf8'),
      })),
    );
    const { versesByWord, sequences } = readTaggedWords(tagged);
    const lxx = await septuagintOnce(readSource);
    const links = await crossReferencesOnce(readSource);
    const functionWords = new Set([
      ...lxx.functionWords,
      ...greekFunctionStrongs(lxx.greekWordList),
    ]);
    const greekOfOldTestament = septuagintSequences(
      lxx.books,
      lxx.greekWordList,
      lxx.file.alignment,
    );

    const terms = new Map<VerseIndex, Set<string>>();
    const add = (verse: VerseIndex, term: string) => {
      if (functionWords.has(term)) {
        return;
      }
      let set = terms.get(verse);
      if (!set) {
        set = new Set();
        terms.set(verse, set);
      }
      set.add(term);
    };
    for (const [strongs, verses] of versesByWord) {
      const plain = plainStrongs(strongs);
      verses.forEach((verse) => {
        add(verse, plain);
      });
    }
    for (const [verse, sequence] of greekOfOldTestament) {
      sequence.forEach((term) => {
        add(verse, term);
      });
    }
    const newTestament = new Map<VerseIndex, string[]>();
    for (const [verse, sequence] of sequences) {
      if (sequence[0]?.startsWith('G')) {
        newTestament.set(verse, sequence.map(plainStrongs));
      }
    }
    const crossReferenceTriples: [number, number, number][] = [];
    const { offsets, targetStart, targetEnd } = links.links;
    for (let source = 0; source + 1 < offsets.length; source += 1) {
      for (let at = offsets[source] ?? 0; at < (offsets[source + 1] ?? 0); at += 1) {
        crossReferenceTriples.push([source, targetStart[at] ?? 0, targetEnd[at] ?? 0]);
      }
    }
    const similarText = await readFileIfExists(SIMILAR_FILE);
    const similar = similarText
      ? (JSON.parse(similarText.toString('utf8')) as {
          neighbours: number;
          verses: number[];
          scores: number[];
        })
      : null;
    return importEvidence(
      {
        terms,
        newTestament,
        septuagint: greekOfOldTestament,
        functionWords,
        crossReferences: crossReferenceTriples,
        similar,
      },
      {
        license: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
        attribution: EVIDENCE_ATTRIBUTION,
        provenance: {
          url: 'data/derived/similar-bsb.json',
          sha256: similarText ? sha256Hex(similarText) : '',
          retrievedAt: today(),
        },
      },
    );
  },
};

export const DATASET_BUILDERS: readonly DatasetBuilder[] = [
  ...Object.values(TRANSLATION_BUILDERS),
  ...Object.values(CROSS_REFERENCE_BUILDERS),
  ...Object.values(WORD_BUILDERS),
  LEXICON_BUILDER,
  SEPTUAGINT_BUILDER,
  EVIDENCE_BUILDER,
];
