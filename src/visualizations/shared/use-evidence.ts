import { useEffect, useState } from 'react';
import type { EvidenceDataset } from '../../links/load-evidence.ts';
import { evidenceIfLoaded, evidenceLoader } from './viz-data.ts';

/** The evidence, fetched the first time it is wanted; `null` until then, or if it failed. */
export function useEvidence(wanted: boolean): EvidenceDataset | null {
  const [evidence, setEvidence] = useState<EvidenceDataset | null>(evidenceIfLoaded);
  useEffect(() => {
    if (evidence || !wanted) {
      return undefined;
    }
    let current = true;
    evidenceLoader.load().then(
      (loaded) => {
        if (current) {
          setEvidence(loaded);
        }
      },
      () => {
        // Forgotten, so the next verse opened asks again.
        evidenceLoader.reset();
      },
    );
    return () => {
      current = false;
    };
  }, [evidence, wanted]);
  return evidence;
}
