import type { LexiconColumns } from '../core/datasets/formats.ts';

/** What a Hebrew or Greek word means, from the lexicon (see `scripts/data/importers/lexicon.ts`). */
export interface LexiconEntry {
  /** Position in the lexicon. */
  readonly index: number;
  /** Plain Strong's number, e.g. `G5046`. */
  readonly strongs: string;
  readonly lemma: string;
  readonly transliteration: string;
  /** Strong's definition. */
  readonly definition: string;
  /** How the KJV renders it. */
  readonly renderings: string;
  /** Its senses: Abbott-Smith's (Greek) or Brown-Driver-Briggs's outline (Hebrew). */
  readonly senses: string;
  /** How the KJV translates it, with counts: `perfect (17), man (1)`. */
  readonly translations: string;
  /** How many times the KJV translates it. */
  readonly occurrences: number;
}

/** `G0026`, `H1254A` → `G26`, `H1254`: the number a lexicon entry is filed under. */
export function plainStrongs(strongs: string): string {
  const match = /^([GH])0*(\d+)/.exec(strongs);
  return match ? `${match[1] ?? ''}${match[2] ?? ''}` : strongs;
}

/**
 * The lexicon: definitions, word families, and the Hebrew behind a Greek word in the Septuagint
 * (and so, read backwards, the Greek a Hebrew word became). Families and equivalents are positions
 * in the same columns, read through their offsets.
 */
export class Lexicon {
  readonly #columns: LexiconColumns;
  readonly #positions: ReadonlyMap<string, number>;
  /** The Septuagint equivalences read backwards: for a Hebrew word, the Greek that rendered it. */
  readonly #renderedBy: ReadonlyMap<number, readonly number[]>;

  constructor(columns: LexiconColumns) {
    const count = columns.strongs.length;
    if (
      columns.familyOffsets.length !== count + 1 ||
      columns.equivalentOffsets.length !== count + 1
    ) {
      throw new Error('Lexicon: there is not one offset per entry, plus the end.');
    }
    this.#columns = columns;
    this.#positions = new Map(columns.strongs.map((strongs, index) => [strongs, index]));
    const renderedBy = new Map<number, number[]>();
    for (let greek = 0; greek < count; greek += 1) {
      for (const hebrew of this.#slice(columns.equivalentOffsets, columns.equivalents, greek)) {
        renderedBy.set(hebrew, [...(renderedBy.get(hebrew) ?? []), greek]);
      }
    }
    this.#renderedBy = renderedBy;
  }

  /** The entry for a Strong's number in any form (`G5046`, `G05046`, `H1254A`), if there is one. */
  find(strongs: string): LexiconEntry | null {
    const index = this.#positions.get(plainStrongs(strongs));
    return index === undefined ? null : this.entryAt(index);
  }

  entryAt(index: number): LexiconEntry {
    const {
      strongs,
      lemma,
      transliteration,
      definition,
      renderings,
      senses,
      translations,
      occurrences,
    } = this.#columns;
    return {
      index,
      strongs: strongs[index] ?? '',
      lemma: lemma[index] ?? '',
      transliteration: transliteration[index] ?? '',
      definition: definition[index] ?? '',
      renderings: renderings[index] ?? '',
      senses: senses[index] ?? '',
      translations: translations[index] ?? '',
      occurrences: occurrences[index] ?? 0,
    };
  }

  /** The words that share its root, closest first, without the word itself. */
  familyOf(entry: LexiconEntry): readonly LexiconEntry[] {
    const { familyOffsets, family } = this.#columns;
    return this.#slice(familyOffsets, family, entry.index).map((index) => this.entryAt(index));
  }

  /**
   * Its counterparts in the other testament's language: for a Greek word, the Hebrew the
   * Septuagint used it for; for a Hebrew word, the Greek that rendered it there.
   */
  equivalentsOf(entry: LexiconEntry): readonly LexiconEntry[] {
    const { equivalentOffsets, equivalents } = this.#columns;
    const indices = entry.strongs.startsWith('G')
      ? this.#slice(equivalentOffsets, equivalents, entry.index)
      : (this.#renderedBy.get(entry.index) ?? []);
    return indices.map((index) => this.entryAt(index));
  }

  #slice(offsets: readonly number[], values: readonly number[], index: number): number[] {
    const start = offsets[index] ?? 0;
    const end = offsets[index + 1] ?? start;
    return values.slice(start, end).filter((value) => value >= 0);
  }
}
