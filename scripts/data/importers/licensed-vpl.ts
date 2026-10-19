/**
 * Importer for a licensed translation David supplies himself as a verse-per-line text file
 * (`data/private/<id>.txt`, git-ignored, never downloaded). The reading itself is shared with
 * the reader-supplied copies in the browser: see `src/translations/verse-lines.ts`.
 */
export { importVerseLines as importLicensedVerseLines } from '../../../src/translations/verse-lines.ts';
