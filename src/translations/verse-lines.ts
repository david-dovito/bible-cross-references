import { BOOKS, getReferenceName, type BookId } from '../core/bible/books.ts';
import { normalizeBookName } from '../core/bible/book-lookup.ts';
import { BOOK_CODES } from '../core/bible/ebible-codes.ts';
import { toOsisId, type VerseIndex } from '../core/bible/verse-ref.ts';
import { CANONICAL_VERSIFICATION } from '../core/bible/versification.ts';
import {
  DATASET_SCHEMA_VERSION,
  type DatasetProvenance,
  type ImportNotice,
  type TranslationTextFile,
} from '../core/datasets/formats.ts';
import type { TranslationId } from '../core/datasets/ids.ts';

/**
 * Reads a verse-per-line text file into a translation: for a licensed text David supplies at build
 * time (`bible/scripts/data/importers/licensed-vpl.ts` uses this) and for a copy a reader loads into
 * their own browser (`own-texts.ts`). Files come from different places, so the book is taken
 * however the file names it:
 *
 *   GEN 1:1 In the beginning…           eBible / BibleWorks code
 *   Genesis 1:1<TAB>In the beginning…   full name (the BSB's layout)
 *   Gen 1:1 In the beginning…           OSIS ID or a common abbreviation
 *
 * It keeps going on anything unexpected and reports it: lines it couldn't read, verses outside the
 * KJV versification, duplicates, missing verses. Missing verses are kept as empty text, the way
 * omitted verses are.
 */

const VERSE_LINE_PATTERN = /^(.+?)\s+(\d+):(\d+)(?:[\t ]+(.*))?$/;

const MAX_EXAMPLES = 5;

const BOOK_IDS_BY_CODE: ReadonlyMap<string, BookId> = new Map(
  BOOKS.map((book, index) => [BOOK_CODES[index] ?? '', book.id]),
);

/**
 * Every exact way to name a book (name, citation name, OSIS ID, aliases), normalized. Prefixes
 * aren't accepted, the way the search box accepts them: "Jo" could put a verse in the wrong book.
 */
const BOOK_IDS_BY_NAME: ReadonlyMap<string, BookId> = new Map(
  BOOKS.flatMap((book) =>
    [book.id, book.name, getReferenceName(book), ...book.aliases].map(
      (name) => [normalizeBookName(name), book.id] as const,
    ),
  ),
);

function bookIdOf(name: string): BookId | undefined {
  return BOOK_IDS_BY_CODE.get(name.toUpperCase()) ?? BOOK_IDS_BY_NAME.get(normalizeBookName(name));
}

/** Pilcrows mark paragraphs, which the app has no place for; the wording stays as it is. */
function cleanVerseText(text: string): string {
  return text.replace(/¶\s*/g, '').replace(/\s+/g, ' ').trim();
}

function notice(
  level: ImportNotice['level'],
  message: string,
  items: readonly string[],
): ImportNotice {
  return { level, message, count: items.length, examples: items.slice(0, MAX_EXAMPLES) };
}

export function importVerseLines(
  text: string,
  translationId: TranslationId,
  provenance: DatasetProvenance,
): TranslationTextFile {
  const versification = CANONICAL_VERSIFICATION;
  const verses = new Array<string | undefined>(versification.verseCount).fill(undefined);
  const unreadable: string[] = [];
  const unknownBooks: string[] = [];
  const outsideVersification: string[] = [];
  const duplicates: string[] = [];

  (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).split(/\r?\n/).forEach((line, offset) => {
    if (line.trim() === '') {
      return;
    }
    const lineNumber = offset + 1;
    const match = VERSE_LINE_PATTERN.exec(line.trim());
    if (!match) {
      unreadable.push(`line ${String(lineNumber)}`);
      return;
    }
    const [, bookName = '', chapter = '', verse = '', verseText = ''] = match;
    const book = bookIdOf(bookName);
    if (book === undefined) {
      unknownBooks.push(`line ${String(lineNumber)} (${bookName})`);
      return;
    }
    const ref = { book, chapter: Number(chapter), verse: Number(verse) };
    const index = versification.indexOf(ref);
    if (index === undefined) {
      outsideVersification.push(toOsisId(ref));
      return;
    }
    if (verses[index] !== undefined) {
      duplicates.push(toOsisId(ref));
      return;
    }
    verses[index] = cleanVerseText(verseText);
  });

  const missing: VerseIndex[] = [];
  const complete = verses.map((verseText, index) => {
    if (verseText === undefined) {
      missing.push(index);
    }
    return verseText ?? '';
  });
  const osisIdAt = (index: VerseIndex) => toOsisId(versification.refAt(index));
  const missingSet = new Set(missing);
  const omitted = complete.flatMap((verseText, index) =>
    verseText === '' && !missingSet.has(index) ? [osisIdAt(index)] : [],
  );

  const notices: ImportNotice[] = [];
  const report = (level: ImportNotice['level'], message: string, items: readonly string[]) => {
    if (items.length > 0) {
      notices.push(notice(level, message, items));
    }
  };
  report(
    'warning',
    'Lines not in the form "<book> <chapter>:<verse> <text>", skipped.',
    unreadable,
  );
  report('warning', 'Lines naming a book the app does not know, skipped.', unknownBooks);
  report(
    'warning',
    'Verses outside the KJV versification, skipped: they need a mapping before they can show.',
    outsideVersification,
  );
  report('warning', 'Verses given more than once; the first was kept.', duplicates);
  report('warning', 'Verses the file does not have, shown without text.', missing.map(osisIdAt));
  report(
    'info',
    'Verses without text: the translation omits them and gives them in footnotes instead.',
    omitted,
  );

  return {
    format: 'translation-text',
    schemaVersion: DATASET_SCHEMA_VERSION,
    versification: versification.id,
    provenance,
    notices,
    translationId,
    verses: complete,
  };
}
