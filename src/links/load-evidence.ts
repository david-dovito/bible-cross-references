import { CANONICAL_VERSIFICATION } from '../core/bible/versification.ts';
import { parseEvidenceFile } from '../core/datasets/formats.ts';
import { evidenceDatasetPath } from '../core/datasets/paths.ts';
import { fetchDataset } from '../shared/lib/fetch-dataset.ts';
import { Evidence } from './evidence.ts';

export interface EvidenceDataset {
  readonly evidence: Evidence;
  readonly attribution: string;
}

export async function loadEvidence(): Promise<EvidenceDataset> {
  const { json } = await fetchDataset(evidenceDatasetPath());
  const file = parseEvidenceFile(json, CANONICAL_VERSIFICATION.id);
  return {
    evidence: new Evidence(file.pairs, CANONICAL_VERSIFICATION.verseCount),
    attribution: file.attribution,
  };
}
