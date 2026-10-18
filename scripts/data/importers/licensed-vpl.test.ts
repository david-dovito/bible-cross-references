// @vitest-environment node
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- matchers return any */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PROVENANCE, verseIndex } from '../../../src/test-utils/fixtures.ts';
import { importLicensedVerseLines } from './licensed-vpl.ts';

// Made-up placeholder text in the shapes such files come in; no real translation is in the repo.
const SAMPLE = readFileSync(new URL('./fixtures/licensed-sample.txt', import.meta.url), 'utf8');

describe('importLicensedVerseLines', () => {
  const file = importLicensedVerseLines(SAMPLE, 'nasb', PROVENANCE);

  it('reads full names, eBible codes and abbreviations onto the KJV versification', () => {
    expect(file).toMatchObject({ translationId: 'nasb', versification: 'kjv' });
    expect(file.verses).toHaveLength(31102);
    expect(file.verses[verseIndex('Gen', 1, 1)]).toBe('Placeholder words for the first verse.');
    expect(file.verses[verseIndex('Gen', 1, 2)]).toBe('Placeholder words for the second verse.');
    expect(file.verses[verseIndex('Ps', 23, 1)]).toBe('Placeholder words for a psalm.');
    expect(file.verses[verseIndex('John', 3, 16)]).toBe('Placeholder words for a gospel verse.');
  });

  it('reports what does not map instead of failing', () => {
    expect(file.notices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'warning',
          message: expect.stringContaining('outside the KJV versification'),
          count: 1,
          examples: ['Rev.22.22'],
        }),
        expect.objectContaining({
          level: 'warning',
          message: expect.stringContaining('does not have'),
          count: 31102 - 4,
        }),
      ]),
    );
  });

  it('reports unreadable lines, unknown books and duplicates', () => {
    const notices = importLicensedVerseLines(
      'A heading line\nNotabook 1:1 Placeholder.\nGEN 1:1 One.\nGenesis 1:1 Two.\n',
      'nasb',
      PROVENANCE,
    ).notices;
    const counts = Object.fromEntries(notices.map(({ message, count }) => [message, count]));
    expect(Object.entries(counts)).toEqual(
      expect.arrayContaining([
        [expect.stringContaining('Lines not in the form'), 1],
        [expect.stringContaining('book the app does not know'), 1],
        [expect.stringContaining('more than once'), 1],
      ]),
    );
  });

  it('never takes a prefix for a book name', () => {
    const notices = importLicensedVerseLines('Jo 1:1 Placeholder.\n', 'nasb', PROVENANCE).notices;
    expect(notices[0]).toMatchObject({
      message: expect.stringContaining('book the app does not know'),
    });
  });
});
