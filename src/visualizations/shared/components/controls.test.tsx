import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GENRES } from '../../../core/bible/genres.ts';
import { CANONICAL_VERSIFICATION } from '../../../core/bible/versification.ts';
import { verseIndex } from '../../../test-utils/fixtures.ts';
import { GenreToggles } from './GenreToggles.tsx';
import { ReferenceSearch } from './ReferenceSearch.tsx';

describe('ReferenceSearch', () => {
  function renderSearch() {
    const onSelect = vi.fn();
    render(<ReferenceSearch versification={CANONICAL_VERSIFICATION} onSelect={onSelect} />);
    return { onSelect, input: screen.getByRole('searchbox') };
  }

  it('opens a verse that is typed in full', async () => {
    const { onSelect, input } = renderSearch();
    await userEvent.type(input, 'John 3:16{Enter}');
    expect(onSelect).toHaveBeenCalledWith({ kind: 'verse', verse: verseIndex('John', 3, 16) });
  });

  it.each(['jn 3 16', 'Gen.1.1', 'ps 23', 'JOHN 3:16'])(
    'accepts %s, the way a reader actually types it',
    async (typed) => {
      const { onSelect, input } = renderSearch();
      await userEvent.type(input, `${typed}{Enter}`);
      expect(onSelect).toHaveBeenCalled();
    },
  );

  it('opens a whole chapter when no verse is given', async () => {
    const { onSelect, input } = renderSearch();
    await userEvent.type(input, 'Psalm 23{Enter}');
    expect(onSelect).toHaveBeenCalledWith({ kind: 'chapter', book: 'Ps', chapter: 23 });
  });

  it('says what is wrong instead of doing nothing', async () => {
    const { onSelect, input } = renderSearch();
    await userEvent.type(input, 'Hesitations 4:4{Enter}');
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBeTruthy();
  });

  it('points the box at its own message, so it is announced', async () => {
    const { input } = renderSearch();
    await userEvent.type(input, 'nonsense{Enter}');
    const described = input.getAttribute('aria-describedby');
    expect(described).toBeTruthy();
    expect(document.getElementById(described ?? '')).not.toBeNull();
  });

  it('clears the message once the next reference is good', async () => {
    const { input } = renderSearch();
    await userEvent.type(input, 'nonsense{Enter}');
    expect(screen.getByRole('alert')).toBeDefined();
    await userEvent.clear(input);
    await userEvent.type(input, 'John 3:16{Enter}');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does nothing for an empty box', async () => {
    const { onSelect, input } = renderSearch();
    await userEvent.type(input, '{Enter}');
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('GenreToggles', () => {
  it('shows every genre, grouped by testament', () => {
    render(<GenreToggles hiddenGenres={new Set()} onToggle={vi.fn()} />);
    expect(screen.getByText('Old Testament')).toBeDefined();
    expect(screen.getByText('New Testament')).toBeDefined();
    expect(screen.getAllByRole('button')).toHaveLength(GENRES.length);
  });

  it('marks a genre that is showing as pressed', () => {
    render(<GenreToggles hiddenGenres={new Set()} onToggle={vi.fn()} />);
    for (const button of screen.getAllByRole('button')) {
      expect(button.getAttribute('aria-pressed')).toBe('true');
    }
  });

  it('marks a hidden genre as not pressed', () => {
    render(<GenreToggles hiddenGenres={new Set(['law'])} onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Law/ }).getAttribute('aria-pressed')).toBe('false');
  });

  it('reports the genre that was toggled', async () => {
    const onToggle = vi.fn();
    render(<GenreToggles hiddenGenres={new Set()} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('button', { name: /Revelation/ }));
    expect(onToggle).toHaveBeenCalledWith('revelation');
  });
});
