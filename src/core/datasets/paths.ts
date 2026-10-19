import type { CrossReferenceSourceId, TranslationId, WordSourceId } from './ids.ts';

/**
 * Location of generated dataset files, relative to the site root. The data pipeline writes them
 * under `public/`, from where they are served as static assets.
 */
export const DATASETS_DIRECTORY = 'data';

export function translationDatasetPath(id: TranslationId): string {
  return `${DATASETS_DIRECTORY}/translations/${id}.json`;
}

export function crossReferencesDatasetPath(id: CrossReferenceSourceId): string {
  return `${DATASETS_DIRECTORY}/cross-references/${id}.json`;
}

export function originalWordsDatasetPath(id: WordSourceId): string {
  return `${DATASETS_DIRECTORY}/words/${id}.json`;
}

/** The lexicon behind the original words (definitions, families, Septuagint equivalents). */
export function lexiconDatasetPath(): string {
  return `${DATASETS_DIRECTORY}/words/lexicon.json`;
}

/** Thayer's Greek-English Lexicon (1889), by Strong's number. */
export function thayerDatasetPath(): string {
  return `${DATASETS_DIRECTORY}/words/thayer.json`;
}

/** The Septuagint: its Greek words by KJV verse, and the Hebrew and Greek words it pairs. */
export function septuagintDatasetPath(): string {
  return `${DATASETS_DIRECTORY}/words/septuagint.json`;
}

/** Verse pairs and what links them: shared words, quotations, meaning, cross-references. */
export function evidenceDatasetPath(): string {
  return `${DATASETS_DIRECTORY}/links/evidence.json`;
}
