import type { VerseIndex } from '../core/bible/verse-ref.ts';
import type { SeptuagintFile } from '../core/datasets/formats.ts';

/** A Greek word of the Septuagint. */
export interface SeptuagintWord {
  /** Position in the dataset. */
  readonly index: number;
  readonly lemma: string;
  /** Plain Strong's number when the New Testament shares the word (`G5046`), else empty. */
  readonly strongs: string;
  /** A few words of English. */
  readonly gloss: string;
}

/** A Hebrew word and a Greek word the Septuagint pairs, and how strongly. */
export interface SeptuagintPair {
  readonly hebrew: string;
  readonly greek: SeptuagintWord;
  /** Lined-up verses with both. */
  readonly count: number;
  /** Lined-up verses with the Hebrew word, and with the Greek one. */
  readonly hebrewVerses: number;
  readonly greekVerses: number;
}

/**
 * The Septuagint as a bridge (see `scripts/data/importers/septuagint.ts`): which Greek word renders
 * which Hebrew one, and where the Septuagint uses a Greek word, as Old Testament (KJV) verses.
 */
export class Septuagint {
  readonly #file: SeptuagintFile;
  readonly #byHebrew = new Map<string, number[]>();
  readonly #byGreek = new Map<number, number[]>();
  readonly #byStrongs = new Map<string, number[]>();
  readonly #greekReference = new Map<VerseIndex, string>();

  constructor(file: SeptuagintFile) {
    this.#file = file;
    const { pairs, greek, alignment } = file;
    pairs.hebrew.forEach((hebrew, at) => {
      this.#byHebrew.set(hebrew, [...(this.#byHebrew.get(hebrew) ?? []), at]);
      const word = pairs.greek[at] ?? -1;
      this.#byGreek.set(word, [...(this.#byGreek.get(word) ?? []), at]);
    });
    greek.strongs.forEach((strongs, index) => {
      if (strongs !== '') {
        this.#byStrongs.set(strongs, [...(this.#byStrongs.get(strongs) ?? []), index]);
      }
    });
    alignment.verses.forEach((verse, at) => {
      if (!this.#greekReference.has(verse)) {
        this.#greekReference.set(verse, alignment.greek[at] ?? '');
      }
    });
  }

  wordAt(index: number): SeptuagintWord {
    const { lemma, strongs, gloss } = this.#file.greek;
    return {
      index,
      lemma: lemma[index] ?? '',
      strongs: strongs[index] ?? '',
      gloss: gloss[index] ?? '',
    };
  }

  /** The Septuagint's words filed under a Greek Strong's number. */
  wordsWithStrongs(strongs: string): readonly SeptuagintWord[] {
    return (this.#byStrongs.get(strongs) ?? []).map((index) => this.wordAt(index));
  }

  /** How the Septuagint renders a Hebrew word (plain Strong's), the most frequent first. */
  renderingsOf(hebrew: string): readonly SeptuagintPair[] {
    return this.#pairs(this.#byHebrew.get(hebrew) ?? []);
  }

  /** The Hebrew words a Greek word renders in the Septuagint, the most frequent first. */
  sourcesOf(word: SeptuagintWord): readonly SeptuagintPair[] {
    return this.#pairs(this.#byGreek.get(word.index) ?? []);
  }

  /** The Old Testament verses (KJV numbering) where the Septuagint uses the word. */
  versesOf(word: SeptuagintWord): readonly VerseIndex[] {
    const { verseOffsets, verses } = this.#file.greek;
    return verses.slice(verseOffsets[word.index] ?? 0, verseOffsets[word.index + 1] ?? 0);
  }

  /** The Septuagint's own reference for a KJV verse (`Ps.50.3` for Psalm 51:1), if lined up. */
  greekReferenceOf(verse: VerseIndex): string | null {
    return this.#greekReference.get(verse) ?? null;
  }

  #pairs(positions: readonly number[]): SeptuagintPair[] {
    const { pairs } = this.#file;
    return positions
      .map((at) => ({
        hebrew: pairs.hebrew[at] ?? '',
        greek: this.wordAt(pairs.greek[at] ?? 0),
        count: pairs.count[at] ?? 0,
        hebrewVerses: pairs.hebrewVerses[at] ?? 0,
        greekVerses: pairs.greekVerses[at] ?? 0,
      }))
      .sort((a, b) => b.count - a.count);
  }
}
