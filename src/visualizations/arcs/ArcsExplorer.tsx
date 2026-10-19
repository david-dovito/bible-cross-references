import { useMemo, useState } from 'react';
import {
  ClickIcon,
  DragIcon,
  HoldAndSlideIcon,
  PinchIcon,
  ScrollIcon,
  TapIcon,
} from '../../shared/ui/icons.tsx';
import { Credits } from '../shared/components/Credits.tsx';
import { FiltersMenu } from '../shared/components/FiltersMenu.tsx';
import { GenreLegend } from '../shared/components/GenreLegend.tsx';
import { toggleGenre } from '../shared/components/GenreToggles.tsx';
import { LinkStats } from '../shared/components/LinkStats.tsx';
import { PassagePanel } from '../shared/components/PassagePanel.tsx';
import { ReferenceSearch } from '../shared/components/ReferenceSearch.tsx';
import { VizPage } from '../shared/components/VizPage.tsx';
import { DEFAULT_LINK_FILTER, selectLinks } from '../shared/link-filter.ts';
import { summarizeLinks } from '../shared/link-summary.ts';
import type { Passage } from '../../core/bible/passage.ts';
import type { Connection } from '../shared/connections.ts';
import type { WordLayer } from '../shared/word-layer.ts';
import type { VisualizationProps } from '../visualization.ts';
import { ArcsStage } from './ArcsStage.tsx';
import { useEvidence } from '../shared/use-evidence.ts';
import controls from '../shared/components/controls.module.css';

const INSPIRATION = {
  title: 'Bible Cross-References',
  author: 'Chris Harrison and Christoph Römhild',
  url: 'https://www.chrisharrison.net/index.php/visualizations/BibleViz',
};

export function ArcsExplorer({
  data,
  active,
  passage,
  onNavigate,
  filter,
  onFilterChange,
  masthead,
  translationMenu,
  passageLinks,
  shareUrl,
}: VisualizationProps) {
  const { index } = data.crossReferences;
  // Only the cross-references that another kind of evidence agrees with (shared words, a
  // quotation, the model's meaning): the explorer's own filter, kept out of the address.
  const [agreementOnly, setAgreementOnly] = useState(false);
  const evidence = useEvidence(agreementOnly);
  const filtered = useMemo(
    () => selectLinks(index, data.verseGenres, filter),
    [index, data.verseGenres, filter],
  );
  const linkIds = useMemo(() => {
    if (!agreementOnly || !evidence) {
      return filtered;
    }
    return filtered.filter((id) =>
      evidence.evidence.agrees(
        index.sources[id] ?? 0,
        index.targetStarts[id] ?? 0,
        index.targetEnds[id] ?? 0,
      ),
    );
  }, [agreementOnly, evidence, filtered, index]);
  const summary = useMemo(
    () => summarizeLinks(index, linkIds, data.verseGenres),
    [index, linkIds, data.verseGenres],
  );
  const closePanel = () => {
    onNavigate(null);
  };
  // A connection pointed at in the panel; it belongs to the passage it was pointed at on.
  const [preview, setPreview] = useState<{
    readonly passage: Passage;
    readonly connection: Connection;
  } | null>(null);
  const previewed = preview?.passage === passage ? preview.connection : null;
  // A word opened in the panel, drawn over the arcs; it belongs to the passage it was opened on.
  const [wordLayer, setWordLayer] = useState<WordLayer | null>(null);
  const shownWords =
    wordLayer && passage?.kind === 'verse' && passage.verse === wordLayer.verse ? wordLayer : null;

  return (
    <VizPage
      masthead={masthead}
      credits={<Credits translation={data.translation.manifest} inspiration={INSPIRATION} />}
      onPanelClose={closePanel}
      controls={
        <>
          <ReferenceSearch versification={data.versification} onSelect={onNavigate} />
          {translationMenu}
          <FiltersMenu
            filter={filter}
            defaults={DEFAULT_LINK_FILTER}
            onChange={onFilterChange}
            shownLinks={linkIds.length}
            totalLinks={index.linkCount}
          >
            <label className={controls.choice}>
              <input
                type="checkbox"
                checked={agreementOnly}
                onChange={(event) => {
                  setAgreementOnly(event.target.checked);
                }}
              />
              Only links something else agrees with
            </label>
            <p className={controls.hint}>
              {agreementOnly && !evidence
                ? 'Loading the evidence…'
                : 'Keeps a cross-reference only where the two verses also share rare words, one quotes the other, or the meaning model finds them close.'}
            </p>
          </FiltersMenu>
        </>
      }
      panel={
        passage && (
          <PassagePanel
            data={data}
            passage={passage}
            filter={filter}
            actions={passageLinks(passage)}
            onSelect={onNavigate}
            onClose={closePanel}
            shareUrl={shareUrl}
            onWordLayer={setWordLayer}
            onPreview={(connection) => {
              setPreview(connection && { passage, connection });
            }}
          />
        )
      }
    >
      <ArcsStage
        data={data}
        active={active}
        linkIds={linkIds}
        filter={filter}
        focus={passage}
        preview={previewed}
        wordLayer={shownWords}
        onSelect={onNavigate}
      />
      <LinkStats
        summary={summary}
        hint={{
          pointer: (
            <>
              <ScrollIcon /> to zoom · <DragIcon /> to pan · <ClickIcon /> to focus
            </>
          ),
          touch: (
            <>
              <HoldAndSlideIcon /> hold to preview · <TapIcon /> to focus · <PinchIcon /> to zoom
            </>
          ),
        }}
      />
      <GenreLegend
        hiddenGenres={filter.hiddenGenres}
        onToggle={(genre) => {
          onFilterChange({ ...filter, hiddenGenres: toggleGenre(filter.hiddenGenres, genre) });
        }}
      />
    </VizPage>
  );
}
