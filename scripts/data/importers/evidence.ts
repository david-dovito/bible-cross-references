import type { VerseIndex } from '../../../src/core/bible/verse-ref.ts';
import { CANONICAL_VERSIFICATION } from '../../../src/core/bible/versification.ts';
import {
  DATASET_SCHEMA_VERSION,
  EVIDENCE_KINDS,
  type DatasetProvenance,
  type EvidenceFile,
  type ImportNotice,
} from '../../../src/core/datasets/formats.ts';
import type { LicenseInfo } from '../../../src/core/datasets/metadata.ts';
import { createNotice } from '../lib/notices.ts';

/**
 * Evidence: every pair of verses that something other than a cross-reference links, and by what
 * (David, 2026-10-18: "start on 1-4"). Four kinds, each independent of the others:
 *
 * - **Cross-reference** (`EVIDENCE_KINDS.crossReference`): OpenBible.info's links. Only marked
 *   on a pair that another kind also links; the links themselves are their own dataset.
 * - **Shared words**: the two verses share rare dictionary words. Every verse is a set of terms:
 *   its own words (Hebrew or Greek Strong's numbers) and, for an Old Testament verse, the Greek of
 *   its Septuagint verse, so an Old and a New Testament verse can share words too. Terms are
 *   weighted by inverse document frequency (a word in 3 verses says far more than one in 300) and
 *   pairs scored by cosine similarity over those weights. Each verse keeps its best few.
 * - **Quotation**: a New Testament verse and an Old Testament one share runs of Greek content
 *   words, as the New Testament quotes the Septuagint (see below for the rule).
 * - **Meaning**: an embedding model (bge-small-en-v1.5, over the BSB) finds the two verses close
 *   in meaning, whatever their words. Made once on a laptop (`bible/tools/similarity`), committed,
 *   and read here; the only kind a model makes, and labelled as such.
 *
 * Each pair is stored once (lower verse first) with a bit per kind and a score per kind; the app
 * reads them both ways. A pair's agreement is how many kinds link it.
 */

export interface EvidenceSources {
  /** Each verse's terms: its own words, and an Old Testament verse's Septuagint Greek. */
  readonly terms: ReadonlyMap<VerseIndex, ReadonlySet<string>>;
  /** New Testament verses' Greek, in order, as plain Strong's numbers. */
  readonly newTestament: ReadonlyMap<VerseIndex, readonly string[]>;
  /** Old Testament verses' Septuagint Greek, in order (Strong's where it has one). */
  readonly septuagint: ReadonlyMap<VerseIndex, readonly string[]>;
  /** Function words in either language (plain Strong's), never content in a quotation. */
  readonly functionWords: ReadonlySet<string>;
  /** Cross-references as (source, target start, target end). */
  readonly crossReferences: readonly (readonly [number, number, number])[];
  /** The model's nearest neighbours, if made: `neighbours` per verse, flat. */
  readonly similar: {
    readonly neighbours: number;
    readonly verses: readonly number[];
    readonly scores: readonly number[];
  } | null;
}

export interface EvidenceImportOptions {
  readonly license: LicenseInfo;
  readonly attribution: string;
  readonly provenance: Omit<DatasetProvenance, 'snapshotDate'>;
}

/** Shared-word pairs kept per verse, the best first. */
export const WORD_LINKS_PER_VERSE = 8;
/** A shared-word pair must reach this cosine similarity (idf-weighted) to count. */
export const MIN_WORD_SIMILARITY = 0.2;
/** Terms in more verses than this are too common to suggest a pair (they still weigh in it). */
const MAX_CANDIDATE_VERSES = 400;
/** A quotation shares at least this many runs of three content words… */
export const MIN_SHARED_TRIGRAMS = 2;
/**
 * …or one run found in this many Septuagint verses or fewer (one: a phrase only it has), and in no more than
 * `MAX_DISTINCTIVE_NT_VERSES` of the New Testament: a phrase the New Testament quotes more than
 * once (Gen 15:6 in Romans, Galatians and James) is no less a quotation for it.
 */
export const MAX_DISTINCTIVE_VERSES = 1;
const MAX_DISTINCTIVE_NT_VERSES = 10;
/**
 * Model neighbours kept per verse, and the similarity they must reach. bge-small scores run high
 * (a verse's best neighbour scores 0.78 at the median), so the bar is set where the pairs read
 * as related: Ephesians 4:13 and 2 Peter 3:18 ("grow in the grace and knowledge") score 0.76.
 */
export const MEANING_LINKS_PER_VERSE = 5;
export const MIN_MEANING_SIMILARITY = 0.75;
/** Verses this close in the same book are not evidence of anything but being close. */
const NEIGHBOURHOOD = 5;

interface Pair {
  kinds: number;
  words: number;
  quotation: number;
  meaning: number;
}

export function importEvidence(
  sources: EvidenceSources,
  { license, attribution, provenance }: EvidenceImportOptions,
): EvidenceFile {
  const versification = CANONICAL_VERSIFICATION;
  const bookOf = (verse: VerseIndex) => versification.refAt(verse).book;
  const tooClose = (a: VerseIndex, b: VerseIndex) =>
    Math.abs(a - b) <= NEIGHBOURHOOD && bookOf(a) === bookOf(b);
  const pairs = new Map<number, Pair>();
  const key = (a: VerseIndex, b: VerseIndex) =>
    a < b ? a * versification.verseCount + b : b * versification.verseCount + a;
  const pairOf = (a: VerseIndex, b: VerseIndex): Pair => {
    const k = key(a, b);
    let pair = pairs.get(k);
    if (!pair) {
      pair = { kinds: 0, words: 0, quotation: 0, meaning: 0 };
      pairs.set(k, pair);
    }
    return pair;
  };

  // Shared words: idf-weighted cosine, candidates from the rarer terms.
  const documentFrequency = new Map<string, number>();
  for (const terms of sources.terms.values()) {
    for (const term of terms) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }
  const verseTotal = sources.terms.size;
  const weight = (term: string) => Math.log(verseTotal / (documentFrequency.get(term) ?? 1));
  const norm = new Map<VerseIndex, number>();
  for (const [verse, terms] of sources.terms) {
    let sum = 0;
    for (const term of terms) {
      sum += weight(term) ** 2;
    }
    norm.set(verse, Math.sqrt(sum));
  }
  const versesOfTerm = new Map<string, VerseIndex[]>();
  for (const [verse, terms] of sources.terms) {
    for (const term of terms) {
      if ((documentFrequency.get(term) ?? 0) <= MAX_CANDIDATE_VERSES) {
        let list = versesOfTerm.get(term);
        if (!list) {
          list = [];
          versesOfTerm.set(term, list);
        }
        list.push(verse);
      }
    }
  }
  let wordPairs = 0;
  for (const [verse, terms] of sources.terms) {
    const shared = new Map<VerseIndex, number>();
    for (const term of terms) {
      const list = versesOfTerm.get(term);
      if (!list) {
        continue;
      }
      const w = weight(term) ** 2;
      for (const other of list) {
        if (other !== verse) {
          shared.set(other, (shared.get(other) ?? 0) + w);
        }
      }
    }
    const scored: [VerseIndex, number][] = [];
    for (const [other, dot] of shared) {
      if (tooClose(verse, other)) {
        continue;
      }
      // The full dot product: the common terms count too, once a rare one has paired the verses.
      let full = dot;
      const otherTerms = sources.terms.get(other);
      for (const term of terms) {
        if (!versesOfTerm.has(term) && otherTerms?.has(term)) {
          full += weight(term) ** 2;
        }
      }
      const cosine = full / ((norm.get(verse) ?? 1) * (norm.get(other) ?? 1));
      if (cosine >= MIN_WORD_SIMILARITY) {
        scored.push([other, cosine]);
      }
    }
    scored.sort((a, b) => b[1] - a[1]);
    for (const [other, cosine] of scored.slice(0, WORD_LINKS_PER_VERSE)) {
      const pair = pairOf(verse, other);
      if (!(pair.kinds & EVIDENCE_KINDS.words)) {
        wordPairs += 1;
      }
      pair.kinds |= EVIDENCE_KINDS.words;
      pair.words = Math.max(pair.words, cosine);
    }
  }

  // Quotations: shared runs of three Greek content words between a New Testament verse and the
  // Septuagint. Function words are left out of the runs first: the two datasets file pronoun
  // forms differently (μου is G3450 in one and G1473 in the other), and "and he said" quotes
  // nothing. Two shared runs make a quotation; so does one that is distinctive (Hab 2:4's "the
  // righteous by faith shall live" is one run long in Romans 1:17).
  const trigramsOf = (sequence: readonly string[]): Set<string> => {
    const content = sequence.filter((word) => !sources.functionWords.has(word));
    const found = new Set<string>();
    for (let at = 0; at + 2 < content.length; at += 1) {
      found.add(content.slice(at, at + 3).join(' '));
    }
    return found;
  };
  const index = (sequences: ReadonlyMap<VerseIndex, readonly string[]>) => {
    const byTrigram = new Map<string, VerseIndex[]>();
    for (const [verse, sequence] of sequences) {
      for (const trigram of trigramsOf(sequence)) {
        let list = byTrigram.get(trigram);
        if (!list) {
          list = [];
          byTrigram.set(trigram, list);
        }
        list.push(verse);
      }
    }
    return byTrigram;
  };
  const septuagintTrigrams = index(sources.septuagint);
  const newTestamentTrigrams = index(sources.newTestament);
  let quotationPairs = 0;
  const quotationExamples: string[] = [];
  for (const [verse, sequence] of sources.newTestament) {
    const shared = new Map<VerseIndex, { count: number; distinctive: boolean }>();
    for (const trigram of trigramsOf(sequence)) {
      const olds = septuagintTrigrams.get(trigram) ?? [];
      const distinctive =
        olds.length <= MAX_DISTINCTIVE_VERSES &&
        (newTestamentTrigrams.get(trigram)?.length ?? 0) <= MAX_DISTINCTIVE_NT_VERSES;
      for (const other of olds) {
        const found = shared.get(other) ?? { count: 0, distinctive: false };
        found.count += 1;
        found.distinctive ||= distinctive;
        shared.set(other, found);
      }
    }
    for (const [other, { count, distinctive }] of shared) {
      // One run, however distinctive, is too often chance (Joshua 6:10 and Matthew 17:9 share
      // "tell… no one… until"): it counts only where the verses also share rare words. A
      // single-run quotation therefore always agrees with the words; two or more stand alone.
      const sharesWords = ((pairs.get(key(verse, other))?.kinds ?? 0) & EVIDENCE_KINDS.words) !== 0;
      if (count < MIN_SHARED_TRIGRAMS && !(distinctive && sharesWords)) {
        continue;
      }
      const pair = pairOf(verse, other);
      pair.kinds |= EVIDENCE_KINDS.quotation;
      pair.quotation = Math.max(pair.quotation, count);
      quotationPairs += 1;
      if (quotationExamples.length < 5) {
        const at = (v: VerseIndex) => {
          const ref = versification.refAt(v);
          return `${ref.book}.${String(ref.chapter)}.${String(ref.verse)}`;
        };
        quotationExamples.push(`${at(verse)} ← ${at(other)}`);
      }
    }
  }

  // Meaning: the model's neighbours, above the bar.
  let meaningPairs = 0;
  if (sources.similar) {
    const { neighbours, verses, scores } = sources.similar;
    for (let verse = 0; verse * neighbours < verses.length; verse += 1) {
      for (let rank = 0; rank < Math.min(neighbours, MEANING_LINKS_PER_VERSE); rank += 1) {
        const other = verses[verse * neighbours + rank] ?? -1;
        const score = (scores[verse * neighbours + rank] ?? 0) / 1000;
        if (other < 0 || score < MIN_MEANING_SIMILARITY || tooClose(verse, other)) {
          continue;
        }
        const pair = pairOf(verse, other);
        if (!(pair.kinds & EVIDENCE_KINDS.meaning)) {
          meaningPairs += 1;
        }
        pair.kinds |= EVIDENCE_KINDS.meaning;
        pair.meaning = Math.max(pair.meaning, score);
      }
    }
  }

  // Cross-references: marked where another kind already links the pair.
  let agreeing = 0;
  for (const [source, start, end] of sources.crossReferences) {
    for (let target = start; target <= end; target += 1) {
      const pair = pairs.get(key(source, target));
      if (pair && !(pair.kinds & EVIDENCE_KINDS.crossReference)) {
        pair.kinds |= EVIDENCE_KINDS.crossReference;
        agreeing += 1;
      }
    }
  }

  const sorted = [...pairs].sort((a, b) => a[0] - b[0]);
  const columns = {
    first: [] as number[],
    second: [] as number[],
    kinds: [] as number[],
    words: [] as number[],
    quotation: [] as number[],
    meaning: [] as number[],
  };
  const byAgreement = [0, 0, 0, 0, 0];
  for (const [k, pair] of sorted) {
    columns.first.push(Math.floor(k / versification.verseCount));
    columns.second.push(k % versification.verseCount);
    columns.kinds.push(pair.kinds);
    columns.words.push(Math.round(pair.words * 1000));
    columns.quotation.push(pair.quotation);
    columns.meaning.push(Math.round(pair.meaning * 1000));
    let kinds = 0;
    for (let bit = pair.kinds; bit > 0; bit >>= 1) {
      kinds += bit & 1;
    }
    byAgreement[kinds] = (byAgreement[kinds] ?? 0) + 1;
  }

  const notices: ImportNotice[] = [
    { ...createNotice('info', 'Verse pairs sharing rare words', []), count: wordPairs },
    {
      ...createNotice(
        'info',
        'New Testament verses quoting the Septuagint (verse pairs)',
        quotationExamples,
      ),
      count: quotationPairs,
    },
    {
      ...createNotice(
        'info',
        sources.similar
          ? 'Verse pairs close in meaning (the model)'
          : 'No meaning neighbours: data/derived/similar-bsb.json is missing',
        [],
      ),
      count: meaningPairs,
    },
    { ...createNotice('info', 'Of these pairs, also cross-references', []), count: agreeing },
    {
      ...createNotice(
        'info',
        'Pairs by how many kinds link them (1, 2, 3, 4)',
        byAgreement.slice(1).map(String),
      ),
      count: sorted.length,
    },
  ];

  return {
    format: 'evidence',
    schemaVersion: DATASET_SCHEMA_VERSION,
    versification: versification.id,
    provenance: { ...provenance, snapshotDate: null },
    notices,
    license,
    attribution,
    pairs: columns,
  };
}
