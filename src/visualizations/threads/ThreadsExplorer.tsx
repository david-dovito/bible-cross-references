import { useCallback, useMemo, useState } from 'react';
import type { BookId } from '../../core/bible/books.ts';
import { passageRange, type Passage } from '../../core/bible/passage.ts';
import { BothDirectionsIcon, IncomingIcon, OutgoingIcon } from '../../shared/ui/icons.tsx';
import { Credits } from '../shared/components/Credits.tsx';
import { FiltersMenu } from '../shared/components/FiltersMenu.tsx';
import { GenreMenu } from '../shared/components/GenreMenu.tsx';
import { toggleGenre } from '../shared/components/GenreToggles.tsx';
import { PassagePanel } from '../shared/components/PassagePanel.tsx';
import { ReferenceSearch } from '../shared/components/ReferenceSearch.tsx';
import { SegmentedControl } from '../shared/components/SegmentedControl.tsx';
import { VizPage } from '../shared/components/VizPage.tsx';
import type { Connection } from '../shared/connections.ts';
import { DEFAULT_LINK_FILTER, selectLinks } from '../shared/link-filter.ts';
import { sameWordLayer, type WordLayer } from '../shared/word-layer.ts';
import type { VizData } from '../shared/viz-data.ts';
import type { VisualizationProps } from '../visualization.ts';
import { ThreadsStage, type ThreadDirection } from './ThreadsStage.tsx';

/** Where reading starts without a `?ref=`: the Bible's own statement of connection. */
const DEFAULT_CHAPTER = { book: 'John', chapter: 1 } as const satisfies {
  readonly book: BookId;
  readonly chapter: number;
};

const DIRECTIONS = [
  { value: 'outgoing', label: 'Points to', icon: OutgoingIcon },
  { value: 'incoming', label: 'Pointed from', icon: IncomingIcon },
  { value: 'both', label: 'Both', icon: BothDirectionsIcon },
] as const;

function chapterOf(passage: Passage | null, data: VizData): { book: BookId; chapter: number } {
  if (!passage) {
    return DEFAULT_CHAPTER;
  }
  if (passage.kind === 'chapter') {
    return { book: passage.book, chapter: passage.chapter };
  }
  const { book, chapter } = data.versification.refAt(
    passageRange(passage, data.versification).start,
  );
  return { book, chapter };
}

export function ThreadsExplorer({
  data,
  passage,
  onNavigate,
  filter,
  onFilterChange,
  masthead,
  translationMenu,
  passageLinks,
  shareUrl,
}: VisualizationProps) {
  const [direction, setDirection] = useState<ThreadDirection>('outgoing');
  const { book, chapter } = chapterOf(passage, data);
  const selectedVerse = passage?.kind === 'verse' ? passage.verse : null;
  // One object per verse: the panel's effects depend on the passage, and a new one each render loops.
  const versePassageOpen = useMemo<Passage | null>(
    () => (selectedVerse === null ? null : { kind: 'verse', verse: selectedVerse }),
    [selectedVerse],
  );
  const { index } = data.crossReferences;
  const shownLinks = useMemo(
    () => selectLinks(index, data.verseGenres, filter).length,
    [index, data.verseGenres, filter],
  );
  // Closing the details keeps the chapter.
  const closePanel = () => {
    onNavigate({ kind: 'chapter', book, chapter });
  };
  // A connection pointed at in the panel; it belongs to the passage it was pointed at on.
  const [preview, setPreview] = useState<{
    readonly passage: Passage;
    readonly connection: Connection;
  } | null>(null);
  const previewed = preview?.passage === passage ? preview.connection : null;
  // A word opened in the panel, drawn over the threads; it belongs to the verse it was opened on.
  const [wordLayer, setWordLayer] = useState<WordLayer | null>(null);
  // The panel reports its layer from an effect; keeping the old object when nothing changed
  // stops a report from rendering the panel again, and so reporting again.
  const reportWords = useCallback((layer: WordLayer | null) => {
    setWordLayer((current) => (sameWordLayer(current, layer) ? current : layer));
  }, []);
  const shownWords = selectedVerse === wordLayer?.verse ? wordLayer : null;

  return (
    <VizPage
      masthead={masthead}
      credits={<Credits translation={data.translation.manifest} />}
      onPanelClose={closePanel}
      controls={
        <>
          <ReferenceSearch versification={data.versification} onSelect={onNavigate} />
          {translationMenu}
          <SegmentedControl
            label="Thread direction"
            options={DIRECTIONS}
            value={direction}
            onChange={setDirection}
            iconsOnlyWhenNarrow
          />
          <GenreMenu
            hiddenGenres={filter.hiddenGenres}
            onToggle={(genre) => {
              onFilterChange({ ...filter, hiddenGenres: toggleGenre(filter.hiddenGenres, genre) });
            }}
          />
          <FiltersMenu
            filter={filter}
            defaults={DEFAULT_LINK_FILTER}
            onChange={onFilterChange}
            shownLinks={shownLinks}
            totalLinks={index.linkCount}
          />
        </>
      }
      panel={
        selectedVerse !== null &&
        versePassageOpen && (
          <PassagePanel
            data={data}
            passage={versePassageOpen}
            filter={filter}
            actions={passageLinks(versePassageOpen)}
            onSelect={onNavigate}
            onClose={closePanel}
            onWordLayer={reportWords}
            shareUrl={shareUrl}
            onPreview={(connection) => {
              setPreview(connection && passage && { passage, connection });
            }}
          />
        )
      }
    >
      <ThreadsStage
        data={data}
        book={book}
        chapter={chapter}
        selectedVerse={selectedVerse}
        filter={filter}
        direction={direction}
        preview={previewed}
        wordLayer={shownWords}
        onSelect={onNavigate}
      />
    </VizPage>
  );
}
