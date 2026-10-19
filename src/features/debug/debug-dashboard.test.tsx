import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CANONICAL_VERSIFICATION } from '../../core/bible/versification.ts';
import {
  createCrossReferenceDataset,
  createDebugData,
  createLoadReport,
  createWholeBibleDataset,
  FIXTURE_VERSE_COUNT,
} from '../../test-utils/debug-data.ts';
import { verseIndex } from '../../test-utils/fixtures.ts';
import { CrossReferencesSection } from './components/CrossReferencesSection.tsx';
import { DatasetsSection } from './components/DatasetsSection.tsx';
import { TextSearch } from './components/TextSearch.tsx';
import { TranslationSection } from './components/TranslationSection.tsx';
import { VerseInspector } from './components/VerseInspector.tsx';
import { crossReferencesSectionId, DebugDashboard } from './DebugDashboard.tsx';
import { VerseNavigationContext } from './verse-navigation.ts';
import { readVerseFromUrl, writeVerseToUrl } from './verse-url.ts';

const GEN_1_1 = verseIndex('Gen', 1, 1);
const GEN_1_2 = verseIndex('Gen', 1, 2);
const GEN_1_3 = verseIndex('Gen', 1, 3);
const JOHN_3_16 = verseIndex('John', 3, 16);

/** Links inside the fixture's range, with a range link and a negative-voted one. */
const LINKS = [
  { from: GEN_1_1, to: GEN_1_2, toEnd: GEN_1_3, votes: 40 },
  { from: GEN_1_1, to: GEN_1_3, votes: -2 },
  { from: GEN_1_2, to: GEN_1_1, votes: 7 },
];

function withNavigation(node: React.ReactNode, onSelect = vi.fn()) {
  render(<VerseNavigationContext value={onSelect}>{node}</VerseNavigationContext>);
  return onSelect;
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('verse-url', () => {
  it('reads the verse the address names', () => {
    window.history.replaceState(null, '', '/debug/?verse=John.3.16');
    expect(readVerseFromUrl()).toBe(JOHN_3_16);
  });

  it('has nothing to read when the address names no verse', () => {
    expect(readVerseFromUrl()).toBeUndefined();
  });

  it('has nothing to read from an address it cannot parse', () => {
    window.history.replaceState(null, '', '/debug/?verse=Nope');
    expect(readVerseFromUrl()).toBeUndefined();
  });

  it('writes the verse into the address without adding a history entry', () => {
    writeVerseToUrl(JOHN_3_16);
    expect(window.location.search).toContain('verse=John.3.16');
  });
});

describe('DatasetsSection', () => {
  it('lists every file with its size and timings', () => {
    render(
      <DatasetsSection
        id="datasets"
        reports={[createLoadReport('translations/bsb.json'), createLoadReport('x/y.json')]}
      />,
    );
    expect(screen.getByText('translations/bsb.json')).toBeDefined();
    expect(screen.getByText('x/y.json')).toBeDefined();
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });
});

describe('TranslationSection', () => {
  function renderSection(verses?: ReadonlyMap<number, string>) {
    const { translation } = createDebugData([], verses).translation;
    withNavigation(<TranslationSection id="translation" translation={translation} />);
  }

  it('counts the books, chapters and verses of the text', () => {
    renderSection();
    expect(screen.getByText('Books')).toBeDefined();
    expect(screen.getByText('66')).toBeDefined();
    expect(screen.getByText('31,102')).toBeDefined();
  });

  it('says the translation has no omitted verses when every verse has text', () => {
    renderSection();
    expect(screen.getByText('None.')).toBeDefined();
  });

  it('lists a verse the translation leaves out', () => {
    renderSection(new Map([[GEN_1_2, '']]));
    expect(screen.getByRole('button', { name: 'Genesis 1:2' })).toBeDefined();
  });

  it('credits the source of the text', () => {
    renderSection();
    expect(screen.getAllByText(/Berean/).length).toBeGreaterThan(0);
  });
});

describe('TextSearch', () => {
  function renderSearch() {
    const { translation } = createDebugData(
      [],
      new Map([
        [GEN_1_1, 'Living water for everyone'],
        [GEN_1_2, 'living WATER again'],
      ]),
    ).translation;
    withNavigation(<TextSearch id="search" translation={translation} />);
  }

  it('shows nothing until something is searched for', () => {
    renderSearch();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('finds the verses that contain the phrase, whatever their case', async () => {
    renderSearch();
    await userEvent.type(screen.getByRole('searchbox'), 'living water');
    await userEvent.click(screen.getByRole('button', { name: /Search/ }));
    expect(screen.getByText(/2 verses contain/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Genesis 1:1' })).toBeDefined();
  });

  it('says so when nothing matches', async () => {
    renderSearch();
    await userEvent.type(screen.getByRole('searchbox'), 'zzzz');
    await userEvent.click(screen.getByRole('button', { name: /Search/ }));
    expect(screen.getByText('No verses match.')).toBeDefined();
  });
});

describe('VerseInspector', () => {
  function renderInspector(verse = GEN_1_1, withDatasets = true) {
    const data = createDebugData(LINKS, new Map([[GEN_1_3, '']]));
    const onSelect = vi.fn();
    withNavigation(
      <VerseInspector
        id="inspector"
        verse={verse}
        translation={data.translation.translation}
        datasets={withDatasets ? data.crossReferences.map(({ dataset }) => dataset) : []}
      />,
      onSelect,
    );
    return onSelect;
  }

  it('shows the verse, its text and where it sits in the canon', () => {
    renderInspector();
    expect(screen.getAllByText('Genesis 1:1').length).toBeGreaterThan(0);
    expect(screen.getByText('Gen.1.1')).toBeDefined();
  });

  it('lists the links that leave the verse and the ones that arrive', () => {
    renderInspector();
    expect(screen.getByText(/Outgoing links: 2 of 2/)).toBeDefined();
    expect(screen.getByText(/Incoming links: 1 of 1/)).toBeDefined();
  });

  it('marks how many more verses a range covers', () => {
    renderInspector();
    expect(screen.getByText(/\(\+1 more\)/)).toBeDefined();
  });

  it('says when the other end of a link is omitted in this translation', () => {
    renderInspector();
    expect(screen.getByText('(omitted in this translation)')).toBeDefined();
  });

  it('drops the links below a minimum vote count', async () => {
    renderInspector();
    await userEvent.type(screen.getByLabelText(/Minimum votes/), '10');
    expect(screen.getByText(/Outgoing links: 1 of 2/)).toBeDefined();
  });

  it('goes back to every link when the vote box is emptied', async () => {
    renderInspector();
    const votes = screen.getByLabelText(/Minimum votes/);
    await userEvent.type(votes, '10');
    await userEvent.clear(votes);
    expect(screen.getByText(/Outgoing links: 2 of 2/)).toBeDefined();
  });

  it('opens the verse a reference names', async () => {
    const onSelect = renderInspector();
    const input = screen.getByLabelText('Bible reference');
    await userEvent.clear(input);
    await userEvent.type(input, 'John 3:16');
    await userEvent.click(screen.getByRole('button', { name: /Inspect/ }));
    expect(onSelect).toHaveBeenCalledWith(JOHN_3_16);
  });

  it('opens the first verse of a chapter given without one', async () => {
    const onSelect = renderInspector();
    const input = screen.getByLabelText('Bible reference');
    await userEvent.clear(input);
    await userEvent.type(input, 'Ps 23');
    await userEvent.click(screen.getByRole('button', { name: /Inspect/ }));
    expect(onSelect).toHaveBeenCalledWith(verseIndex('Ps', 23, 1));
  });

  it('explains a reference it cannot read, and opens nothing', async () => {
    const onSelect = renderInspector();
    const input = screen.getByLabelText('Bible reference');
    await userEvent.clear(input);
    await userEvent.type(input, 'Hesitations 4:4');
    await userEvent.click(screen.getByRole('button', { name: /Inspect/ }));
    expect(screen.getByRole('alert')).toBeDefined();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('refuses a verse number the chapter does not reach', async () => {
    const onSelect = renderInspector();
    const input = screen.getByLabelText('Bible reference');
    await userEvent.clear(input);
    await userEvent.type(input, 'John 3:999');
    await userEvent.click(screen.getByRole('button', { name: /Inspect/ }));
    expect(screen.getByRole('alert')).toBeDefined();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('steps to the verse before and the verse after', async () => {
    const onSelect = renderInspector(GEN_1_2);
    await userEvent.click(screen.getByRole('button', { name: /Previous/ }));
    expect(onSelect).toHaveBeenCalledWith(GEN_1_1);
    await userEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(onSelect).toHaveBeenCalledWith(GEN_1_3);
  });

  it('cannot step back from the first verse of the Bible, or on from the last', () => {
    renderInspector(GEN_1_1);
    expect(screen.getByRole('button', { name: /Previous/ })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: /Next/ })).toHaveProperty('disabled', false);
  });

  it('cannot step on from the last verse of the Bible', () => {
    renderInspector(CANONICAL_VERSIFICATION.verseCount - 1, false);
    expect(screen.getByRole('button', { name: /Next/ })).toHaveProperty('disabled', true);
  });
});

describe('CrossReferencesSection', () => {
  function renderSection() {
    const onSelect = vi.fn();
    withNavigation(
      <CrossReferencesSection id="cr" dataset={createCrossReferenceDataset(LINKS)} />,
      onSelect,
    );
    return onSelect;
  }

  it('counts the links and the verses they touch', () => {
    renderSection();
    expect(screen.getAllByText(/Cross-references ·/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
  });

  it('shows the verses with the most links in each direction', () => {
    renderSection();
    expect(screen.getByText('Most outgoing links')).toBeDefined();
    expect(screen.getByText('Most incoming links')).toBeDefined();
  });

  it('breaks the links down by testament', () => {
    renderSection();
    expect(screen.getByText(/Links by testament/)).toBeDefined();
  });

  it('lists the verses that no link touches', () => {
    renderSection();
    // Genesis 1:1 to 1:3 are linked; the rest of the fixture's range is not.
    expect(
      screen.getByText(new RegExp(`Verses without any link \\(${FIXTURE_VERSE_COUNT - 3}\\)`)),
    ).toBeDefined();
  });

  it('opens a verse from one of its tables', async () => {
    const onSelect = renderSection();
    const table = screen.getByText('Most outgoing links').closest('table');
    const [verse] = within(table ?? document.body).getAllByRole('button');
    if (!verse) {
      throw new Error('Expected a verse link in the table.');
    }
    await userEvent.click(verse);
    expect(onSelect).toHaveBeenCalled();
  });

  it('passes on what the importer noticed', () => {
    renderSection();
    expect(screen.getByText(/Rows skipped/)).toBeDefined();
  });
});

describe('DebugDashboard', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/debug/');
  });

  /** The dashboard inspects John 3:16 by default, so its dataset has to reach that far. */
  function renderDashboard() {
    render(<DebugDashboard data={createDebugData([], new Map(), createWholeBibleDataset())} />);
  }

  it('opens on John 3:16, the verse the app is best known by', () => {
    renderDashboard();
    expect(screen.getAllByText('John 3:16').length).toBeGreaterThan(0);
  });

  it('opens the verse the address names instead', () => {
    window.history.replaceState(null, '', '/debug/?verse=Gen.1.1');
    renderDashboard();
    expect(screen.getAllByText('Genesis 1:1').length).toBeGreaterThan(0);
  });

  it('moves the inspector to a verse clicked anywhere on the page, and says so in the address', async () => {
    renderDashboard();
    const [link] = screen.getAllByRole('button', { name: 'Genesis 1:1' });
    await userEvent.click(link ?? screen.getByRole('button', { name: /Inspect/ }));
    await waitFor(() => {
      expect(window.location.search).toContain('verse=Gen.1.1');
    });
  });

  it('gives each cross-reference source its own section id', () => {
    expect(crossReferencesSectionId('openbible')).toBe('cross-references-openbible');
  });
});
