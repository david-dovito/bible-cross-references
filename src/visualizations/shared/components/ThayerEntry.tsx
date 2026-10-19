import { useState } from 'react';
import { thayerLoader } from '../viz-data.ts';
import type { ThayerDataset } from '../../../words/load-thayer.ts';
import styles from './ThayerEntry.module.css';

/**
 * Thayer's entry for a Greek word (1889, public domain), folded away until the reader asks for it:
 * it is long, and it is fetched on first opening.
 */
export function ThayerEntry({ strongs }: { readonly strongs: string }) {
  const [dataset, setDataset] = useState<ThayerDataset | null>(null);
  const [failed, setFailed] = useState(false);

  const load = () => {
    if (dataset) return;
    thayerLoader.load().then(setDataset, () => {
      thayerLoader.reset();
      setFailed(true);
    });
  };

  const entry = dataset?.entryOf(strongs);
  // Hebrew words have no Thayer entry, and a Greek word the lexicon lacks says so once it has loaded.
  if (strongs.startsWith('H')) return null;
  return (
    <details
      className={styles.thayer}
      onToggle={(event) => {
        if (event.currentTarget.open) load();
      }}
    >
      <summary>Thayer’s Lexicon (1889)</summary>
      {failed && <p className={styles.note}>It did not load. Close this and open it again.</p>}
      {dataset && entry === undefined && (
        <p className={styles.note}>Thayer has no entry for this word.</p>
      )}
      {entry !== undefined && <p className={styles.text}>{entry}</p>}
      {dataset && entry !== undefined && <p className={styles.note}>{dataset.attribution}</p>}
    </details>
  );
}
