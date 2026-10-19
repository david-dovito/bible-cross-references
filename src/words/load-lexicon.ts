import { CANONICAL_VERSIFICATION } from '../core/bible/versification.ts';
import { parseLexiconFile, parseSeptuagintFile } from '../core/datasets/formats.ts';
import { lexiconDatasetPath, septuagintDatasetPath } from '../core/datasets/paths.ts';
import type { LicenseInfo } from '../core/datasets/metadata.ts';
import { fetchDataset } from '../shared/lib/fetch-dataset.ts';
import { Lexicon } from './lexicon.ts';
import { Septuagint } from './septuagint.ts';

export interface LexiconDataset {
  readonly lexicon: Lexicon;
  readonly septuagint: Septuagint;
  /** Carried in the file: it is CC BY-SA, as Strong's JSON is. */
  readonly license: LicenseInfo;
  readonly attribution: string;
  readonly septuagintAttribution: string;
}

/** The lexicon and the Septuagint, fetched together the first time a word is opened. */
export async function loadLexicon(): Promise<LexiconDataset> {
  const [lexiconJson, septuagintJson] = await Promise.all([
    fetchDataset(lexiconDatasetPath()),
    fetchDataset(septuagintDatasetPath()),
  ]);
  const file = parseLexiconFile(lexiconJson.json, CANONICAL_VERSIFICATION.id);
  const septuagint = parseSeptuagintFile(septuagintJson.json, CANONICAL_VERSIFICATION.id);
  return {
    lexicon: new Lexicon(file.entries),
    septuagint: new Septuagint(septuagint),
    license: file.license,
    attribution: file.attribution,
    septuagintAttribution: septuagint.attribution,
  };
}
