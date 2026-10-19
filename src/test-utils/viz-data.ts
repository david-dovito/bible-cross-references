import { CANONICAL_VERSIFICATION } from '../core/bible/versification.ts';
import type { VerseIndex } from '../core/bible/verse-ref.ts';
import { CrossReferenceIndex } from '../cross-references/cross-reference-index.ts';
import { getTranslationManifest } from '../translations/registry.ts';
import { Translation } from '../translations/translation.ts';
import { computeVerseGenres } from '../visualizations/shared/verse-genres.ts';
import type { VizData } from '../visualizations/shared/viz-data.ts';
import {
  createCrossReferenceColumns,
  createTranslationFile,
  PROVENANCE,
  type LinkSpec,
} from './fixtures.ts';

/** A complete `VizData` for component tests: real versification, fixture links and text. */
export function createVizData(
  links: readonly LinkSpec[] = [],
  verses: ReadonlyMap<VerseIndex, string> = new Map(),
): VizData {
  const versification = CANONICAL_VERSIFICATION;
  const columns = createCrossReferenceColumns(links);
  return {
    versification,
    verseGenres: computeVerseGenres(versification),
    translation: new Translation(
      getTranslationManifest('bsb'),
      versification,
      createTranslationFile(verses),
    ),
    crossReferences: {
      manifest: {
        id: 'openbible',
        name: 'OpenBible.info Cross References',
        description: 'Fixture',
        license: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
        attribution: 'Cross-reference data: OpenBible.info (CC BY 4.0).',
        homepage: 'https://www.openbible.info/labs/cross-references/',
        versification: 'kjv',
        enabledByDefault: true,
      },
      provenance: PROVENANCE,
      notices: [],
      sourceRowCount: links.length,
      index: new CrossReferenceIndex(columns, versification.verseCount),
    },
  };
}
