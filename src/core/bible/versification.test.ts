import { describe, expect, it } from 'vitest';
import { BOOKS, type BookId } from './books.ts';
import { KJV_VERSIFICATION, Versification } from './versification.ts';

describe('KJV versification', () => {
  const kjv = KJV_VERSIFICATION;

  it('has the standard chapter and verse counts', () => {
    expect(kjv.chapterCount).toBe(1189);
    expect(kjv.verseCount).toBe(31102);
    expect(kjv.chapterCountOf('Ps')).toBe(150);
    expect(kjv.verseCountOf('Ps', 119)).toBe(176);
    expect(kjv.verseCountOf('Gen', 51)).toBeUndefined();
  });

  it('maps references to dense indices in canonical order', () => {
    expect(kjv.indexOf({ book: 'Gen', chapter: 1, verse: 1 })).toBe(0);
    expect(kjv.indexOf({ book: 'Gen', chapter: 2, verse: 1 })).toBe(31);
    expect(kjv.indexOf({ book: 'Rev', chapter: 22, verse: 21 })).toBe(31101);
  });

  it('rejects verses that do not exist', () => {
    expect(kjv.indexOf({ book: 'Gen', chapter: 1, verse: 32 })).toBeUndefined();
    expect(kjv.indexOf({ book: 'Gen', chapter: 0, verse: 1 })).toBeUndefined();
    expect(kjv.indexOf({ book: '3John', chapter: 1, verse: 15 })).toBeUndefined();
  });

  it('round-trips every index', () => {
    for (let index = 0; index < kjv.verseCount; index += 1) {
      expect(kjv.indexOf(kjv.refAt(index))).toBe(index);
    }
  });

  it('reports book membership and ranges', () => {
    const matthew = kjv.bookRange('Matt');
    expect(kjv.bookAt(matthew.start).id).toBe('Matt');
    expect(kjv.bookAt(matthew.start - 1).id).toBe('Mal');
    expect(kjv.refAt(matthew.end)).toEqual({ book: 'Matt', chapter: 28, verse: 20 });
  });

  it('throws for out-of-range indices', () => {
    expect(() => kjv.refAt(-1)).toThrow(RangeError);
    expect(() => kjv.refAt(kjv.verseCount)).toThrow(RangeError);
  });
});

describe('a versification built from a table', () => {
  /** The KJV counts, with one book's replaced. */
  function countsWith(book: BookId, counts: readonly number[]) {
    return Object.fromEntries(
      BOOKS.map(({ id }) => [
        id,
        id === book
          ? counts
          : Array.from({ length: KJV_VERSIFICATION.chapterCountOf(id) }, (_, chapter) =>
              KJV_VERSIFICATION.verseCountOf(id, chapter + 1),
            ),
      ]),
    ) as Readonly<Record<BookId, readonly number[]>>;
  }

  it('refuses a book with no chapters at all', () => {
    expect(() => new Versification('kjv', countsWith('Gen', []))).toThrow(/invalid chapter/);
  });

  it('refuses a chapter with no verses, or a fractional count', () => {
    expect(() => new Versification('kjv', countsWith('Gen', [0]))).toThrow(/invalid chapter/);
    expect(() => new Versification('kjv', countsWith('Gen', [1.5]))).toThrow(/invalid chapter/);
  });

  it('has no range for a chapter the book does not reach', () => {
    expect(KJV_VERSIFICATION.chapterRange('Gen', 999)).toBeUndefined();
  });

  it('gives the range a chapter covers', () => {
    expect(KJV_VERSIFICATION.chapterRange('Gen', 1)).toEqual({ start: 0, end: 30 });
  });

  it('refuses a book it does not know', () => {
    const unknown = 'Nope' as BookId;
    expect(() => KJV_VERSIFICATION.bookRange(unknown)).toThrow(/Unknown book/);
    expect(() => KJV_VERSIFICATION.chapterRange(unknown, 1)).toThrow();
  });

  it('accepts only an index inside the canon', () => {
    expect(KJV_VERSIFICATION.isValidIndex(0)).toBe(true);
    expect(KJV_VERSIFICATION.isValidIndex(KJV_VERSIFICATION.verseCount)).toBe(false);
    expect(KJV_VERSIFICATION.isValidIndex(-1)).toBe(false);
    expect(KJV_VERSIFICATION.isValidIndex(1.5)).toBe(false);
  });
});
