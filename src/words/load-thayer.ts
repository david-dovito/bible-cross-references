import { CANONICAL_VERSIFICATION } from '../core/bible/versification.ts';
import { parseThayerFile } from '../core/datasets/formats.ts';
import { thayerDatasetPath } from '../core/datasets/paths.ts';
import { fetchDataset } from '../shared/lib/fetch-dataset.ts';

export interface ThayerDataset {
  /** The entry for a plain Strong's number (`G907`), or `undefined`. */
  readonly entryOf: (strongs: string) => string | undefined;
  readonly attribution: string;
}

/** Thayer's Greek-English Lexicon, fetched the first time a reader opens it for a word. */
export async function loadThayer(): Promise<ThayerDataset> {
  const { json } = await fetchDataset(thayerDatasetPath());
  const file = parseThayerFile(json, CANONICAL_VERSIFICATION.id);
  const entries = new Map<string, string>();
  file.strongs.forEach((strongs, index) => {
    const text = file.text[index];
    // Two entries can share a number; the first (the main one) is kept.
    if (text !== undefined && !entries.has(strongs)) {
      entries.set(strongs, text);
    }
  });
  return { entryOf: (strongs) => entries.get(strongs), attribution: file.attribution };
}
