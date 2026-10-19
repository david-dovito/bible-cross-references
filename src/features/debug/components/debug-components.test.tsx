import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ImportNotice } from '../../../core/datasets/formats.ts';
import { PROVENANCE, verseIndex } from '../../../test-utils/fixtures.ts';
import { VerseNavigationContext } from '../verse-navigation.ts';
import { NoticeList } from './NoticeList.tsx';
import { SourceDetails } from './SourceDetails.tsx';
import { VerseLink } from './VerseLink.tsx';

const NOTICES: readonly ImportNotice[] = [
  { level: 'info', message: 'Verses the translation omits', count: 16, examples: ['Matt 17:21'] },
  { level: 'warning', message: 'Something to look at', count: 1, examples: [] },
];

describe('NoticeList', () => {
  it('shows each notice with its count', () => {
    render(<NoticeList notices={NOTICES} />);
    expect(screen.getByText(/Verses the translation omits/)).toBeDefined();
    expect(screen.getByText(/16/)).toBeDefined();
  });

  it('shows the examples that were kept', () => {
    render(<NoticeList notices={NOTICES} />);
    expect(screen.getByText(/Matt 17:21/)).toBeDefined();
  });

  it('says so when the importer noticed nothing', () => {
    render(<NoticeList notices={[]} />);
    expect(screen.getByText(/No import notices/)).toBeDefined();
  });

  it('marks a warning differently from a note', () => {
    render(<NoticeList notices={NOTICES} />);
    expect(screen.getByText(/Something to look at/)).toBeDefined();
  });
});

describe('SourceDetails', () => {
  function renderDetails() {
    render(
      <SourceDetails
        items={[{ label: 'Verses', value: '31,102' }]}
        license={{ name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' }}
        attribution="Cross-reference data: OpenBible.info (CC BY 4.0)."
        homepage="https://www.openbible.info/"
        provenance={PROVENANCE}
      />,
    );
  }

  it('shows what the caller gave it, beside the licence and the credit', () => {
    renderDetails();
    expect(screen.getByText('Verses')).toBeDefined();
    expect(screen.getByText('31,102')).toBeDefined();
    expect(screen.getByText('CC BY 4.0')).toBeDefined();
    expect(screen.getByText(/OpenBible.info \(CC BY 4.0\)/)).toBeDefined();
  });

  it('shows where the file came from, when, and the checksum the build verified', () => {
    renderDetails();
    expect(screen.getByText(/2026-01-01/)).toBeDefined();
    expect(screen.getByText(new RegExp(PROVENANCE.sha256.slice(0, 12)))).toBeDefined();
  });
});

describe('VerseLink', () => {
  function renderLink(node: React.ReactNode) {
    const selectVerse = vi.fn();
    render(
      <VerseNavigationContext.Provider value={selectVerse}>{node}</VerseNavigationContext.Provider>,
    );
    return selectVerse;
  }

  it('names the verse it points at', () => {
    renderLink(<VerseLink verse={verseIndex('John', 3, 16)} />);
    expect(screen.getByRole('button', { name: /John 3:16/ })).toBeDefined();
  });

  it('names a range by its ends', () => {
    renderLink(
      <VerseLink verse={verseIndex('John', 3, 16)} rangeEnd={verseIndex('John', 3, 17)} />,
    );
    expect(screen.getByRole('button').textContent).toMatch(/John 3:16.+17/);
  });

  it('opens the verse in the inspector', async () => {
    const selectVerse = renderLink(<VerseLink verse={verseIndex('Rom', 5, 8)} />);
    await userEvent.click(screen.getByRole('button'));
    expect(selectVerse).toHaveBeenCalledWith(verseIndex('Rom', 5, 8));
  });

  it('opens the first verse of a range', async () => {
    const selectVerse = renderLink(
      <VerseLink verse={verseIndex('Rom', 5, 8)} rangeEnd={verseIndex('Rom', 5, 10)} />,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(selectVerse).toHaveBeenCalledWith(verseIndex('Rom', 5, 8));
  });

  it('refuses to work outside the inspector, rather than doing nothing', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<VerseLink verse={verseIndex('John', 1, 1)} />)).toThrow(
      /VerseNavigationContext/,
    );
    error.mockRestore();
  });
});
