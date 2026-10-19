import { beforeEach, describe, expect, it } from 'vitest';
import { CANONICAL_VERSIFICATION } from '../core/bible/versification.ts';
import { loadOwnText, readOwnTextIds, removeOwnText, saveOwnText } from './own-texts.ts';
import { attributionOf, isTranslationAvailable } from './registry.ts';

/** One line per verse of the canon, in the "<book> <chapter>:<verse> <text>" form. */
function wholeBible(): File {
  const lines = Array.from({ length: CANONICAL_VERSIFICATION.verseCount }, (_, index) => {
    const ref = CANONICAL_VERSIFICATION.refAt(index);
    return `${ref.book} ${String(ref.chapter)}:${String(ref.verse)} Verse ${String(index)}.`;
  });
  return new File([lines.join('\n')], 'bible.txt', { type: 'text/plain' });
}

describe('a reader’s own copy', () => {
  beforeEach(async () => {
    await removeOwnText('nkjv');
  });

  it('is offered once it is on this device, and not before', async () => {
    expect(isTranslationAvailable('nkjv', [], readOwnTextIds())).toBe(false);
    await saveOwnText('nkjv', wholeBible());
    expect(readOwnTextIds()).toEqual(['nkjv']);
    expect(isTranslationAvailable('nkjv', [], readOwnTextIds())).toBe(true);
  });

  it('is read back with its text, and forgotten when removed', async () => {
    await saveOwnText('nkjv', wholeBible());
    const file = await loadOwnText('nkjv');
    expect(file?.verses[0]).toBe('Verse 0.');
    await removeOwnText('nkjv');
    expect(readOwnTextIds()).toEqual([]);
    expect(await loadOwnText('nkjv')).toBeNull();
  });

  it('refuses a file that is not a verse-per-line Bible', async () => {
    const notABible = new File(['Hello\nWorld'], 'notes.txt', { type: 'text/plain' });
    await expect(saveOwnText('nasb', notABible)).rejects.toThrow(/verses could be read/);
    expect(readOwnTextIds()).toEqual([]);
  });

  it('is credited as the reader’s own, not as used by permission', () => {
    expect(attributionOf({ ...nkjvStub(), id: 'nkjv' })).toMatch(/^Your own copy/);
  });
});

function nkjvStub() {
  return {
    id: 'nkjv',
    name: 'New King James Version',
    abbreviation: 'NKJV',
    language: 'en',
    direction: 'ltr',
    versification: 'kjv',
    license: { name: '© Thomas Nelson', url: 'https://example.org' },
    attribution: 'Used by permission.',
    homepage: 'https://example.org',
    access: 'licensed',
  } as const;
}
