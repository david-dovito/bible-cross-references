import type { VerseIndex } from '../core/bible/verse-ref.ts';
import { EVIDENCE_KINDS, type EvidenceColumns } from '../core/datasets/formats.ts';

export type EvidenceKind = keyof typeof EVIDENCE_KINDS;

/** Every kind, in the order the app names them. */
export const EVIDENCE_KIND_ORDER: readonly EvidenceKind[] = [
  'crossReference',
  'quotation',
  'words',
  'meaning',
];

/** One verse's link to another, and what links them. */
export interface EvidenceLink {
  readonly other: VerseIndex;
  readonly kinds: number;
  /** How many kinds link them: the agreement. */
  readonly agreement: number;
  /** Shared-word similarity, 0–1. */
  readonly words: number;
  /** Shared Greek runs. */
  readonly quotation: number;
  /** The model's similarity, 0–1. */
  readonly meaning: number;
}

export function hasKind(kinds: number, kind: EvidenceKind): boolean {
  return (kinds & EVIDENCE_KINDS[kind]) !== 0;
}

export function countKinds(kinds: number): number {
  let count = 0;
  for (let bits = kinds; bits > 0; bits >>= 1) {
    count += bits & 1;
  }
  return count;
}

/**
 * The evidence dataset, readable from either verse of a pair (see
 * `scripts/data/importers/evidence.ts`). A cross-reference only appears here where another kind
 * also links the pair; on its own it is in the cross-references dataset.
 */
export class Evidence {
  readonly #columns: EvidenceColumns;
  /** CSR over verses: the pairs a verse is in. */
  readonly #offsets: Int32Array;
  readonly #pairs: Int32Array;

  constructor(columns: EvidenceColumns, verseCount: number) {
    this.#columns = columns;
    const counts = new Int32Array(verseCount + 1);
    const { first, second } = columns;
    for (let at = 0; at < first.length; at += 1) {
      counts[first[at] ?? 0] = (counts[first[at] ?? 0] ?? 0) + 1;
      counts[second[at] ?? 0] = (counts[second[at] ?? 0] ?? 0) + 1;
    }
    const offsets = new Int32Array(verseCount + 1);
    for (let verse = 0; verse < verseCount; verse += 1) {
      offsets[verse + 1] = (offsets[verse] ?? 0) + (counts[verse] ?? 0);
    }
    const pairs = new Int32Array(offsets[verseCount] ?? 0);
    const cursor = Int32Array.from(offsets.subarray(0, verseCount));
    for (let at = 0; at < first.length; at += 1) {
      for (const verse of [first[at] ?? 0, second[at] ?? 0]) {
        const slot = cursor[verse] ?? 0;
        pairs[slot] = at;
        cursor[verse] = slot + 1;
      }
    }
    this.#offsets = offsets;
    this.#pairs = pairs;
  }

  /** Every verse a verse is linked to by evidence, the most agreed on first. */
  linksOf(verse: VerseIndex): EvidenceLink[] {
    const { first, second, kinds, words, quotation, meaning } = this.#columns;
    const links: EvidenceLink[] = [];
    for (let at = this.#offsets[verse] ?? 0; at < (this.#offsets[verse + 1] ?? 0); at += 1) {
      const pair = this.#pairs[at] ?? 0;
      const bits = kinds[pair] ?? 0;
      links.push({
        other: first[pair] === verse ? (second[pair] ?? 0) : (first[pair] ?? 0),
        kinds: bits,
        agreement: countKinds(bits),
        words: (words[pair] ?? 0) / 1000,
        quotation: quotation[pair] ?? 0,
        meaning: (meaning[pair] ?? 0) / 1000,
      });
    }
    return links.sort(
      (a, b) =>
        b.agreement - a.agreement ||
        b.quotation - a.quotation ||
        b.words + b.meaning - (a.words + a.meaning),
    );
  }

  /**
   * Whether anything besides the cross-reference links a verse to a range: what the agreement
   * filter keeps.
   */
  agrees(source: VerseIndex, start: VerseIndex, end: VerseIndex): boolean {
    const { first, second, kinds } = this.#columns;
    for (let at = this.#offsets[source] ?? 0; at < (this.#offsets[source + 1] ?? 0); at += 1) {
      const pair = this.#pairs[at] ?? 0;
      const other = first[pair] === source ? (second[pair] ?? 0) : (first[pair] ?? 0);
      if (
        other >= start &&
        other <= end &&
        ((kinds[pair] ?? 0) & ~EVIDENCE_KINDS.crossReference) !== 0
      ) {
        return true;
      }
    }
    return false;
  }
}
