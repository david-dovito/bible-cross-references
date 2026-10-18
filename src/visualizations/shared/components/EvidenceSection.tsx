import { useMemo, useState } from 'react';
import { formatPassage, versePassage, type Passage } from '../../../core/bible/passage.ts';
import type { VerseIndex } from '../../../core/bible/verse-ref.ts';
import { formatInteger } from '../../../shared/lib/format.ts';
import { BothDirectionsIcon } from '../../../shared/ui/icons.tsx';
import { verseTextOrNote } from '../../../translations/verse-text.ts';
import {
  EVIDENCE_KIND_ORDER,
  hasKind,
  type EvidenceKind,
  type EvidenceLink,
} from '../../../links/evidence.ts';
import type { Connection } from '../connections.ts';
import { useEvidence } from '../use-evidence.ts';
import type { VizData } from '../viz-data.ts';
import { PanelSection } from './PanelSection.tsx';
import styles from './PassagePanel.module.css';

/** What each kind is called on its badge, and what it means, in its tooltip. */
const KIND_LABELS: Readonly<
  Record<EvidenceKind, { readonly label: string; readonly title: string }>
> = {
  crossReference: { label: 'Cross-reference', title: 'OpenBible.info lists this link' },
  quotation: { label: 'Quotation', title: 'The New Testament verse uses the Septuagint’s words' },
  words: {
    label: 'Shared words',
    title: 'They share rare Hebrew or Greek words (through the Septuagint across the testaments)',
  },
  meaning: {
    label: 'Meaning (model)',
    title: 'An embedding model finds them close in meaning, whatever their words',
  },
};

const INITIAL_ROWS = 20;

/**
 * The verses linked to this one, and by what: cross-references, quotations, shared rare words and
 * meaning (the one kind a model makes). Each kind is independent of the others, so a pair that
 * several link is linked for more than one reason; those come first, and by default only they
 * show (David, 2026-10-18).
 */
export function EvidenceSection({
  verse,
  data,
  connections,
  onSelect,
}: {
  readonly verse: VerseIndex;
  readonly data: VizData;
  readonly connections: readonly Connection[];
  readonly onSelect: (passage: Passage) => void;
}) {
  const dataset = useEvidence(true);
  const [onlyAgreed, setOnlyAgreed] = useState(true);
  const [all, setAll] = useState(false);
  const links = useMemo((): EvidenceLink[] => {
    if (!dataset) {
      return [];
    }
    const found = dataset.evidence.linksOf(verse);
    // A cross-reference the panel lists above, that nothing else links, is evidence of one kind.
    const listed = new Set(found.map((link) => link.other));
    for (const connection of connections) {
      for (let other = connection.otherStart; other <= connection.otherEnd; other += 1) {
        if (!listed.has(other) && other !== verse) {
          listed.add(other);
          found.push({ other, kinds: 1, agreement: 1, words: 0, quotation: 0, meaning: 0 });
        }
      }
    }
    return found;
  }, [dataset, verse, connections]);

  if (!dataset) {
    return null;
  }
  const agreed = links.filter((link) => link.agreement >= 2);
  const shown = onlyAgreed ? agreed : links.filter((link) => link.kinds !== 1);
  const rows = all ? shown : shown.slice(0, INITIAL_ROWS);
  const { versification, translation } = data;
  return (
    <PanelSection
      id="evidence"
      icon={BothDirectionsIcon}
      title="Agreement"
      description="linked more than one way"
      count={agreed.length}
      countLabel="passages linked more than one way"
    >
      <div className={styles.chips}>
        <button
          type="button"
          className={styles.chip}
          aria-pressed={onlyAgreed}
          onClick={() => {
            setOnlyAgreed(true);
          }}
        >
          Two or more ways · {formatInteger(agreed.length)}
        </button>
        <button
          type="button"
          className={styles.chip}
          aria-pressed={!onlyAgreed}
          onClick={() => {
            setOnlyAgreed(false);
          }}
        >
          Any way but a cross-reference alone
        </button>
      </div>
      {rows.length === 0 && (
        <p className={styles.meaningSummary}>Nothing yet links this verse more than one way.</p>
      )}
      {rows.map((link) => (
        <button
          key={link.other}
          type="button"
          className={styles.item}
          onClick={() => {
            onSelect(versePassage(link.other));
          }}
        >
          <span className={styles.itemRef}>
            <strong>{formatPassage(versePassage(link.other), versification)}</strong>
          </span>
          <span className={styles.badges}>
            {EVIDENCE_KIND_ORDER.filter((kind) => hasKind(link.kinds, kind)).map((kind) => (
              <span
                key={kind}
                className={styles.badge}
                data-kind={kind}
                title={KIND_LABELS[kind].title}
              >
                {KIND_LABELS[kind].label}
              </span>
            ))}
          </span>
          <span className={styles.snippet}>{verseTextOrNote(translation, link.other)}</span>
        </button>
      ))}
      {!all && shown.length > INITIAL_ROWS && (
        <button
          type="button"
          className={styles.more}
          onClick={() => {
            setAll(true);
          }}
        >
          Show all {formatInteger(shown.length)}
        </button>
      )}
      <p className={styles.credit}>{dataset.attribution}</p>
    </PanelSection>
  );
}
