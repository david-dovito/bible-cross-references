import type { VerseIndex } from '../../core/bible/verse-ref.ts';

/**
 * A word opened in the details panel, drawn over the cross-references: from the verse it was
 * opened on to every other verse that uses it (or, as the reader adds them, its family and its
 * counterparts in the other testament's language).
 */
export interface WordLayer {
  readonly verse: VerseIndex;
  /** Every verse using the chosen words, the opened verse included, in canonical order. */
  readonly verses: readonly VerseIndex[];
}

/** Whether two layers draw the same thing, so a state holding one can keep the old object. */
export function sameWordLayer(a: WordLayer | null, b: WordLayer | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.verse !== b.verse || a.verses.length !== b.verses.length) return false;
  return a.verses.every((verse, index) => verse === b.verses[index]);
}
