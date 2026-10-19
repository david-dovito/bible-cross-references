import type { VersificationId } from '../bible/versification.ts';
import {
  expectArrayOf,
  expectInteger,
  expectIntegerArray,
  expectNullableString,
  expectOneOf,
  expectRecord,
  expectString,
  expectStringArray,
} from '../lib/validation.ts';
import type { CrossReferenceSourceId, TranslationId, WordSourceId } from './ids.ts';
import type { LicenseInfo } from './metadata.ts';

/**
 * File formats of the generated datasets, shared by the data pipeline (which writes them) and the
 * app (which validates them when loading). Bump `DATASET_SCHEMA_VERSION` on any breaking change.
 */
export const DATASET_SCHEMA_VERSION = 1;

/** Where a dataset came from, so that every number shown in the app can be traced back. */
export interface DatasetProvenance {
  /** URL the raw source file was downloaded from. */
  readonly url: string;
  /** SHA-256 of the raw source file (hex). */
  readonly sha256: string;
  /** Date (YYYY-MM-DD) on which the pinned raw file was retrieved. */
  readonly retrievedAt: string;
  /** Date (YYYY-MM-DD) of the upstream snapshot, if the source publishes one. */
  readonly snapshotDate: string | null;
}

/** Something the importer noticed or changed while converting the raw source. */
export interface ImportNotice {
  readonly level: 'info' | 'warning';
  readonly message: string;
  readonly count: number;
  /** A few affected items (e.g. verse IDs), for debugging. */
  readonly examples: readonly string[];
}

interface DatasetFileBase<Format extends string> {
  readonly format: Format;
  readonly schemaVersion: typeof DATASET_SCHEMA_VERSION;
  readonly versification: VersificationId;
  readonly provenance: DatasetProvenance;
  readonly notices: readonly ImportNotice[];
}

export interface TranslationTextFile extends DatasetFileBase<'translation-text'> {
  readonly translationId: TranslationId;
  /** Verse texts in canonical order. An empty string marks a verse the translation omits. */
  readonly verses: readonly string[];
}

/**
 * Cross-reference links in columnar, compressed-sparse-row (CSR) layout, grouped by source verse:
 * the links of source verse `v` occupy positions `offsets[v]` to `offsets[v + 1] - 1` of the
 * other columns. Targets are inclusive verse-index ranges (`targetStart === targetEnd` for a
 * single verse).
 */
export interface CrossReferenceColumns {
  readonly offsets: readonly number[];
  readonly targetStart: readonly number[];
  readonly targetEnd: readonly number[];
  readonly votes: readonly number[];
}

export interface CrossReferencesFile extends DatasetFileBase<'cross-references'> {
  readonly sourceId: CrossReferenceSourceId;
  /** Number of data rows in the raw source file. */
  readonly sourceRowCount: number;
  readonly links: CrossReferenceColumns;
}

/**
 * Words of the original languages, one entry per dictionary form, in the same columnar layout as
 * the links: the verses of word `w` occupy positions `offsets[w]` to `offsets[w + 1] - 1` of
 * `verses`. Only the dictionary form is kept, never the text of a verse.
 */
export interface OriginalWordColumns {
  /** Extended Strong's number, e.g. `G4128`. Sorted, so a word can be found by binary search. */
  readonly strongs: readonly string[];
  /** Dictionary form in its own script, e.g. `πλῆθος`. */
  readonly lemma: readonly string[];
  readonly transliteration: readonly string[];
  /** A few words of English, e.g. `multitude`. */
  readonly gloss: readonly string[];
  readonly offsets: readonly number[];
  readonly verses: readonly number[];
}

export interface OriginalWordsFile extends DatasetFileBase<'original-words'> {
  readonly sourceId: WordSourceId;
  /** Carried in the file itself: it is served on its own, and a copy should say what it is. */
  readonly license: LicenseInfo;
  readonly attribution: string;
  /**
   * Words used in more verses than this are left out. A word that appears everywhere says
   * nothing about the verse it is in, and the pairs for it outweigh all the rest together.
   */
  readonly maxVerses: number;
  readonly words: OriginalWordColumns;
}

/**
 * The meaning behind the original-language words: one entry per Strong's number (`G5046`), with
 * its definition, its family (the words sharing its root), and, for a Greek word, the Hebrew the
 * Septuagint used it for. `family` and `equivalents` hold positions in these same columns, read
 * through their offsets (CSR), as in `OriginalWordColumns`.
 */
export interface LexiconColumns {
  readonly strongs: readonly string[];
  readonly lemma: readonly string[];
  readonly transliteration: readonly string[];
  /** Strong's definition. */
  readonly definition: readonly string[];
  /** How the KJV renders it. */
  readonly renderings: readonly string[];
  /** Its senses: Abbott-Smith's for Greek, Brown-Driver-Briggs's outline for Hebrew. */
  readonly senses: readonly string[];
  /** How the KJV translates it, with counts: `perfect (17), man (1)`. */
  readonly translations: readonly string[];
  /** How many times the KJV translates it, all told. */
  readonly occurrences: readonly number[];
  readonly familyOffsets: readonly number[];
  readonly family: readonly number[];
  readonly equivalentOffsets: readonly number[];
  readonly equivalents: readonly number[];
}

export interface LexiconFile extends DatasetFileBase<'lexicon'> {
  /** Carried in the file itself, like the words': it is served on its own. */
  readonly license: LicenseInfo;
  readonly attribution: string;
  readonly entries: LexiconColumns;
}

/** The Greek words of the Septuagint, where each is used (as KJV verses), and their families. */
export interface SeptuagintGreekColumns {
  /** Key in Open Scriptures' Greek Word List (unaccented, e.g. `τελειος`). */
  readonly key: readonly string[];
  readonly lemma: readonly string[];
  /** Plain Strong's number for a word the New Testament shares (`G5046`), else empty. */
  readonly strongs: readonly string[];
  /** A few words of English, from the Word List. */
  readonly gloss: readonly string[];
  readonly verseOffsets: readonly number[];
  readonly verses: readonly number[];
  readonly familyOffsets: readonly number[];
  readonly family: readonly number[];
}

/**
 * Hebrew and Greek words the Septuagint pairs: in how many lined-up verses both occur, out of how
 * many each is in, and how much of each the word model credits to the other (in thousandths).
 */
export interface SeptuagintPairColumns {
  /** Plain Strong's number (`H8549`). */
  readonly hebrew: readonly string[];
  /** Position in the Greek columns. */
  readonly greek: readonly number[];
  readonly count: readonly number[];
  readonly hebrewVerses: readonly number[];
  readonly greekVerses: readonly number[];
  readonly toGreek: readonly number[];
  readonly toHebrew: readonly number[];
}

/** Thayer's Greek-English Lexicon (1889): one entry per Strong's number, as running text. */
export interface ThayerFile extends DatasetFileBase<'thayer'> {
  readonly license: LicenseInfo;
  readonly attribution: string;
  /** Plain Strong's numbers (`G907`), each with the entry's text at the same position. */
  readonly strongs: readonly string[];
  readonly text: readonly string[];
}

export interface SeptuagintFile extends DatasetFileBase<'septuagint'> {
  readonly license: LicenseInfo;
  readonly attribution: string;
  readonly greek: SeptuagintGreekColumns;
  readonly pairs: SeptuagintPairColumns;
  /** Which Septuagint verse (`Ps.50.3`) was lined up with which KJV verse. */
  readonly alignment: { readonly greek: readonly string[]; readonly verses: readonly number[] };
}

/** What links a pair of verses, one bit each (see `scripts/data/importers/evidence.ts`). */
export const EVIDENCE_KINDS = {
  crossReference: 1,
  words: 2,
  quotation: 4,
  meaning: 8,
} as const;

/** Verse pairs and what links them, each pair once (`first` < `second`). */
export interface EvidenceColumns {
  readonly first: readonly number[];
  readonly second: readonly number[];
  /** `EVIDENCE_KINDS` bits. */
  readonly kinds: readonly number[];
  /** Shared-word cosine similarity, in thousandths. */
  readonly words: readonly number[];
  /** Shared Greek three-word runs. */
  readonly quotation: readonly number[];
  /** The model's similarity, in thousandths. */
  readonly meaning: readonly number[];
}

export interface EvidenceFile extends DatasetFileBase<'evidence'> {
  readonly license: LicenseInfo;
  readonly attribution: string;
  readonly pairs: EvidenceColumns;
}

function parseProvenance(value: unknown, path: string): DatasetProvenance {
  const record = expectRecord(value, path);
  return {
    url: expectString(record['url'], `${path}.url`),
    sha256: expectString(record['sha256'], `${path}.sha256`),
    retrievedAt: expectString(record['retrievedAt'], `${path}.retrievedAt`),
    snapshotDate: expectNullableString(record['snapshotDate'], `${path}.snapshotDate`),
  };
}

function parseNotice(value: unknown, path: string): ImportNotice {
  const record = expectRecord(value, path);
  return {
    level: expectOneOf(record['level'], ['info', 'warning'], `${path}.level`),
    message: expectString(record['message'], `${path}.message`),
    count: expectInteger(record['count'], `${path}.count`),
    examples: expectStringArray(record['examples'], `${path}.examples`),
  };
}

function parseFileBase<const Format extends string>(
  json: unknown,
  format: Format,
  versification: VersificationId,
): { record: Readonly<Record<string, unknown>>; base: DatasetFileBase<Format> } {
  const record = expectRecord(json, 'file');
  return {
    record,
    base: {
      format: expectOneOf(record['format'], [format], 'format'),
      schemaVersion: expectOneOf(
        record['schemaVersion'],
        [DATASET_SCHEMA_VERSION],
        'schemaVersion',
      ),
      // Mapping between versifications is not supported yet, so a dataset must use the expected one.
      versification: expectOneOf(record['versification'], [versification], 'versification'),
      provenance: parseProvenance(record['provenance'], 'provenance'),
      notices: expectArrayOf(record['notices'], 'notices', parseNotice),
    },
  };
}

/** What a dataset file must be, as declared by the manifest of the plugin that loads it. */
export interface ExpectedDataset<Id extends string> {
  readonly id: Id;
  readonly versification: VersificationId;
}

export function parseTranslationTextFile(
  json: unknown,
  expected: ExpectedDataset<TranslationId>,
): TranslationTextFile {
  const { record, base } = parseFileBase(json, 'translation-text', expected.versification);
  return {
    ...base,
    translationId: expectOneOf(record['translationId'], [expected.id], 'translationId'),
    verses: expectStringArray(record['verses'], 'verses'),
  };
}

export function parseCrossReferencesFile(
  json: unknown,
  expected: ExpectedDataset<CrossReferenceSourceId>,
): CrossReferencesFile {
  const { record, base } = parseFileBase(json, 'cross-references', expected.versification);
  const links = expectRecord(record['links'], 'links');
  return {
    ...base,
    sourceId: expectOneOf(record['sourceId'], [expected.id], 'sourceId'),
    sourceRowCount: expectInteger(record['sourceRowCount'], 'sourceRowCount'),
    links: {
      offsets: expectIntegerArray(links['offsets'], 'links.offsets'),
      targetStart: expectIntegerArray(links['targetStart'], 'links.targetStart'),
      targetEnd: expectIntegerArray(links['targetEnd'], 'links.targetEnd'),
      votes: expectIntegerArray(links['votes'], 'links.votes'),
    },
  };
}

export function parseOriginalWordsFile(
  json: unknown,
  expected: ExpectedDataset<WordSourceId>,
): OriginalWordsFile {
  const { record, base } = parseFileBase(json, 'original-words', expected.versification);
  const words = expectRecord(record['words'], 'words');
  const license = expectRecord(record['license'], 'license');
  return {
    ...base,
    sourceId: expectOneOf(record['sourceId'], [expected.id], 'sourceId'),
    license: {
      name: expectString(license['name'], 'license.name'),
      url: expectString(license['url'], 'license.url'),
    },
    attribution: expectString(record['attribution'], 'attribution'),
    maxVerses: expectInteger(record['maxVerses'], 'maxVerses'),
    words: {
      strongs: expectStringArray(words['strongs'], 'words.strongs'),
      lemma: expectStringArray(words['lemma'], 'words.lemma'),
      transliteration: expectStringArray(words['transliteration'], 'words.transliteration'),
      gloss: expectStringArray(words['gloss'], 'words.gloss'),
      offsets: expectIntegerArray(words['offsets'], 'words.offsets'),
      verses: expectIntegerArray(words['verses'], 'words.verses'),
    },
  };
}

export function parseLexiconFile(json: unknown, versification: VersificationId): LexiconFile {
  const { record, base } = parseFileBase(json, 'lexicon', versification);
  const entries = expectRecord(record['entries'], 'entries');
  const license = expectRecord(record['license'], 'license');
  const strings = (key: string) => expectStringArray(entries[key], `entries.${key}`);
  const integers = (key: string) => expectIntegerArray(entries[key], `entries.${key}`);
  return {
    ...base,
    license: {
      name: expectString(license['name'], 'license.name'),
      url: expectString(license['url'], 'license.url'),
    },
    attribution: expectString(record['attribution'], 'attribution'),
    entries: {
      strongs: strings('strongs'),
      lemma: strings('lemma'),
      transliteration: strings('transliteration'),
      definition: strings('definition'),
      renderings: strings('renderings'),
      senses: strings('senses'),
      translations: strings('translations'),
      occurrences: integers('occurrences'),
      familyOffsets: integers('familyOffsets'),
      family: integers('family'),
      equivalentOffsets: integers('equivalentOffsets'),
      equivalents: integers('equivalents'),
    },
  };
}

export function parseThayerFile(json: unknown, versification: VersificationId): ThayerFile {
  const { record, base } = parseFileBase(json, 'thayer', versification);
  const license = expectRecord(record['license'], 'license');
  return {
    ...base,
    license: {
      name: expectString(license['name'], 'license.name'),
      url: expectString(license['url'], 'license.url'),
    },
    attribution: expectString(record['attribution'], 'attribution'),
    strongs: expectStringArray(record['strongs'], 'strongs'),
    text: expectStringArray(record['text'], 'text'),
  };
}

export function parseSeptuagintFile(json: unknown, versification: VersificationId): SeptuagintFile {
  const { record, base } = parseFileBase(json, 'septuagint', versification);
  const license = expectRecord(record['license'], 'license');
  const greek = expectRecord(record['greek'], 'greek');
  const pairs = expectRecord(record['pairs'], 'pairs');
  const alignment = expectRecord(record['alignment'], 'alignment');
  const strings = (from: Readonly<Record<string, unknown>>, path: string, key: string) =>
    expectStringArray(from[key], `${path}.${key}`);
  const integers = (from: Readonly<Record<string, unknown>>, path: string, key: string) =>
    expectIntegerArray(from[key], `${path}.${key}`);
  return {
    ...base,
    license: {
      name: expectString(license['name'], 'license.name'),
      url: expectString(license['url'], 'license.url'),
    },
    attribution: expectString(record['attribution'], 'attribution'),
    greek: {
      key: strings(greek, 'greek', 'key'),
      lemma: strings(greek, 'greek', 'lemma'),
      strongs: strings(greek, 'greek', 'strongs'),
      gloss: strings(greek, 'greek', 'gloss'),
      verseOffsets: integers(greek, 'greek', 'verseOffsets'),
      verses: integers(greek, 'greek', 'verses'),
      familyOffsets: integers(greek, 'greek', 'familyOffsets'),
      family: integers(greek, 'greek', 'family'),
    },
    pairs: {
      hebrew: strings(pairs, 'pairs', 'hebrew'),
      greek: integers(pairs, 'pairs', 'greek'),
      count: integers(pairs, 'pairs', 'count'),
      hebrewVerses: integers(pairs, 'pairs', 'hebrewVerses'),
      greekVerses: integers(pairs, 'pairs', 'greekVerses'),
      toGreek: integers(pairs, 'pairs', 'toGreek'),
      toHebrew: integers(pairs, 'pairs', 'toHebrew'),
    },
    alignment: {
      greek: strings(alignment, 'alignment', 'greek'),
      verses: integers(alignment, 'alignment', 'verses'),
    },
  };
}

export function parseEvidenceFile(json: unknown, versification: VersificationId): EvidenceFile {
  const { record, base } = parseFileBase(json, 'evidence', versification);
  const license = expectRecord(record['license'], 'license');
  const pairs = expectRecord(record['pairs'], 'pairs');
  const integers = (key: string) => expectIntegerArray(pairs[key], `pairs.${key}`);
  return {
    ...base,
    license: {
      name: expectString(license['name'], 'license.name'),
      url: expectString(license['url'], 'license.url'),
    },
    attribution: expectString(record['attribution'], 'attribution'),
    pairs: {
      first: integers('first'),
      second: integers('second'),
      kinds: integers('kinds'),
      words: integers('words'),
      quotation: integers('quotation'),
      meaning: integers('meaning'),
    },
  };
}
