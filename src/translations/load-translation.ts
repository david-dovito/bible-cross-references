import { CANONICAL_VERSIFICATION } from '../core/bible/versification.ts';
import { parseTranslationTextFile } from '../core/datasets/formats.ts';
import { translationDatasetPath } from '../core/datasets/paths.ts';
import { fetchDataset, measure, type DatasetLoadReport } from '../shared/lib/fetch-dataset.ts';
import { loadOwnText } from './own-texts.ts';
import { isLicensedTextBuilt } from './registry.ts';
import { Translation } from './translation.ts';
import type { TranslationManifest } from './translation-manifest.ts';

export interface LoadedTranslation {
  readonly translation: Translation;
  readonly report: DatasetLoadReport;
}

export async function loadTranslation(manifest: TranslationManifest): Promise<LoadedTranslation> {
  if (manifest.access === 'licensed' && !isLicensedTextBuilt(manifest.id)) {
    // Not part of this build: the reader's own copy, kept in their browser.
    const file = await loadOwnText(manifest.id);
    if (!file) {
      throw new Error(
        `There is no ${manifest.abbreviation} on this device. Add your own copy first.`,
      );
    }
    const translation = new Translation(manifest, CANONICAL_VERSIFICATION, file);
    return {
      translation,
      report: {
        path: 'this device',
        url: 'this device',
        bytes: 0,
        downloadMs: 0,
        parseMs: 0,
        processMs: 0,
      },
    };
  }
  const { json, report } = await fetchDataset(translationDatasetPath(manifest.id));
  const { value: translation, ms } = measure(() => {
    const file = parseTranslationTextFile(json, {
      id: manifest.id,
      versification: CANONICAL_VERSIFICATION.id,
    });
    return new Translation(manifest, CANONICAL_VERSIFICATION, file);
  });
  return { translation, report: { ...report, processMs: ms } };
}
