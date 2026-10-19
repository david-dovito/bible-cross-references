import { BOOKS, type BookId } from '../../../src/core/bible/books.ts';
import { BOOK_CODES } from '../../../src/core/bible/ebible-codes.ts';
import { parseOsisId, toOsisId, type VerseIndex } from '../../../src/core/bible/verse-ref.ts';
import { CANONICAL_VERSIFICATION } from '../../../src/core/bible/versification.ts';
import {
  DATASET_SCHEMA_VERSION,
  type DatasetProvenance,
  type TranslationTextFile,
} from '../../../src/core/datasets/formats.ts';
import type { TranslationId } from '../../../src/core/datasets/ids.ts';
import { stripByteOrderMark } from '../lib/files.ts';
import { createNotice } from '../lib/notices.ts';

/**
 * Importer for eBible.org's verse-per-line editions (`<id>_vpl.zip` → `<id>_vpl.txt`), which every
 * translation there is published in: one line per verse, `<BOOK> <chapter>:<verse> <text>`, text
 * only (eBible strips notes, headings and paragraph formatting from these files).
 *
 * Books are named with the three-letter codes BibleWorks uses, listed below in canonical order.
 */

export { BOOK_CODES };

const BOOK_IDS_BY_CODE: ReadonlyMap<string, BookId> = new Map(
  BOOKS.map((book, index) => [BOOK_CODES[index] ?? '', book.id]),
);

const VERSE_LINE_PATTERN = /^(\S+) (\d+):(\d+) ?(.*)$/;

/**
 * Typographic marks these editions carry, which the app has no place for: pilcrows start a
 * paragraph, and square brackets mark words the translators supplied (the KJV's italics). The
 * wording is left exactly as it is; only the marks go.
 */
function cleanVerseText(text: string): string {
  return text
    .replace(/¶\s*/g, '')
    .replaceAll('[', '')
    .replaceAll(']', '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Verses a translation numbers differently from the KJV, by OSIS ID: where the file has them, and
 * where the KJV has them. The World English Bible, for one, prints the doxology of Romans at
 * 14:24–26 and leaves 16:25 empty; the KJV has it at 16:25–27.
 */
export type VerseRenumbering = Readonly<Record<string, string>>;

export function importEbibleVerseLines(
  text: string,
  translationId: TranslationId,
  provenance: DatasetProvenance,
  renumbering: VerseRenumbering = {},
): TranslationTextFile {
  const versification = CANONICAL_VERSIFICATION;
  const moved: string[] = [];
  const verses = new Array<string | undefined>(versification.verseCount).fill(undefined);

  stripByteOrderMark(text)
    .split(/\r?\n/)
    .forEach((line, offset) => {
      if (line.trim() === '') {
        return;
      }
      const lineNumber = offset + 1;
      const match = VERSE_LINE_PATTERN.exec(line);
      if (!match) {
        throw new Error(
          `${translationId} line ${lineNumber}: unrecognized format: "${line.slice(0, 80)}".`,
        );
      }
      const [, code = '', chapter = '', verse = '', verseText = ''] = match;
      const book = BOOK_IDS_BY_CODE.get(code);
      if (book === undefined) {
        throw new Error(`${translationId} line ${lineNumber}: unknown book code "${code}".`);
      }
      const given = { book, chapter: Number(chapter), verse: Number(verse) };
      const target = renumbering[toOsisId(given)];
      const ref = target === undefined ? given : parseOsisId(target);
      if (ref === undefined) {
        throw new Error(`${translationId}: renumbering target "${target ?? ''}" is not a verse.`);
      }
      if (target !== undefined) {
        moved.push(`${toOsisId(given)} → ${target}`);
      }
      const index = versification.indexOf(ref);
      if (index === undefined) {
        // Translations that number verses differently (e.g. the World English Bible moves the
        // doxology of Romans) need a mapping before they can be added.
        throw new Error(
          `${translationId} line ${lineNumber}: ${toOsisId(ref)} is not in the KJV versification.`,
        );
      }
      if (verses[index] !== undefined && cleanVerseText(verseText) === '' && moved.length > 0) {
        return; // The empty place a renumbered verse was moved out of.
      }
      if (verses[index] !== undefined) {
        throw new Error(`${translationId} line ${lineNumber}: duplicate verse ${toOsisId(ref)}.`);
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
  if (missing.length > 0) {
    throw new Error(
      `${translationId}: ${missing.length} verses are missing, ` +
        `e.g. ${missing.slice(0, 5).map(osisIdAt).join(', ')}.`,
    );
  }

  const omitted = complete.flatMap((verseText, index) =>
    verseText === '' ? [osisIdAt(index)] : [],
  );
  return {
    format: 'translation-text',
    schemaVersion: DATASET_SCHEMA_VERSION,
    versification: versification.id,
    provenance,
    notices: [
      ...(moved.length > 0
        ? [createNotice('info', 'Verses renumbered to the KJV versification.', moved)]
        : []),
      ...(omitted.length > 0
        ? [
            createNotice(
              'info',
              'Verses without text: the translation omits them (they are absent from the ' +
                'earliest manuscripts) and gives them in footnotes instead.',
              omitted,
            ),
          ]
        : []),
    ],
    translationId,
    verses: complete,
  };
}
